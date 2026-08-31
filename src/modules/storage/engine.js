const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const decompress = require('decompress');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const { gzip, gunzip } = require('zlib');
const { promisify } = require('util');
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

class StorageEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.baseDir = path.join(os.homedir(), '.pix/storage');
    this.codeDir = path.join(this.baseDir, 'code');
    this.screenshotsDir = path.join(this.baseDir, 'screenshots');
    this.dataDir = path.join(this.baseDir, 'data');
    this.logsDir = path.join(this.baseDir, 'logs');
    this.backupsDir = path.join(this.baseDir, 'backups');
    this.exportsDir = path.join(this.baseDir, 'exports');
    this.index = new Map();
    this.indexFile = path.join(this.baseDir, 'index.json');
    this.stats = {
      totalFiles: 0,
      totalSize: 0,
      totalLines: 0,
      lastUpdated: null
    };
  }

  async initialize() {
    this.logger.info('Initializing Storage Engine...');

    await fs.ensureDir(this.baseDir);
    await fs.ensureDir(this.codeDir);
    await fs.ensureDir(this.screenshotsDir);
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.logsDir);
    await fs.ensureDir(this.backupsDir);
    await fs.ensureDir(this.exportsDir);

    await this.loadIndex();
    await this.calculateStats();

    this.logger.info('Storage Engine initialized');
    this.logger.info(`Storage stats: ${this.stats.totalFiles} files, ${this.formatSize(this.stats.totalSize)}`);
  }

  async save(params) {
    const {
      name,
      content,
      language = 'text',
      category = 'code',
      tags = [],
      metadata = {},
      compress = false,
      encrypt = false
    } = params;

    const id = uuidv4();
    const timestamp = Date.now();

    let targetDir;
    switch (category) {
      case 'code': targetDir = this.codeDir; break;
      case 'screenshot': targetDir = this.screenshotsDir; break;
      case 'data': targetDir = this.dataDir; break;
      case 'log': targetDir = this.logsDir; break;
      default: targetDir = this.codeDir;
    }

    const extensions = {
      javascript: '.js', typescript: '.ts', python: '.py',
      ruby: '.rb', go: '.go', rust: '.rs', html: '.html',
      css: '.css', json: '.json', markdown: '.md',
      text: '.txt', bash: '.sh', yaml: '.yml',
      xml: '.xml', csv: '.csv', sql: '.sql'
    };

    const ext = extensions[language] || '.txt';
    const filename = `${name || id}${ext}`;
    const filepath = path.join(targetDir, filename);

    this.logger.info(`Saving: ${filename} (${category})`);

    let saveContent = content;
    if (compress) {
      const compressed = await gzipAsync(Buffer.from(content));
      saveContent = compressed.toString('base64');
    }

    await fs.writeFile(filepath, saveContent);

    const lines = content.split('\n').length;
    const stats = await fs.stat(filepath);

    const entry = {
      id,
      name,
      filename,
      filepath,
      language,
      category,
      tags,
      metadata,
      compressed,
      encrypted: encrypt,
      lines,
      size: stats.size,
      createdAt: new Date(timestamp).toISOString(),
      updatedAt: new Date(timestamp).toISOString()
    };

    this.index.set(id, entry);
    await this.saveIndex();
    await this.updateStats(entry);

    return entry;
  }

  async load(params) {
    const { id, decompress: shouldDecompress = false } = params;
    const entry = this.index.get(id);

    if (!entry) throw new Error(`File not found: ${id}`);

    let content = await fs.readFile(entry.filepath, 'utf8');

    if (entry.compressed && shouldDecompress) {
      const buffer = Buffer.from(content, 'base64');
      const decompressed = await gunzipAsync(buffer);
      content = decompressed.toString('utf8');
    }

    return {
      ...entry,
      content
    };
  }

  async list(params = {}) {
    const { category, language, tags, limit = 100, offset = 0, sortBy = 'updatedAt', sortOrder = 'desc' } = params;

    let entries = Array.from(this.index.values());

    if (category) {
      entries = entries.filter(e => e.category === category);
    }
    if (language) {
      entries = entries.filter(e => e.language === language);
    }
    if (tags && tags.length > 0) {
      entries = entries.filter(e => tags.some(t => e.tags.includes(t)));
    }

    entries.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === 'desc'
        ? bVal > aVal ? 1 : -1
        : aVal > bVal ? 1 : -1;
    });

    const total = entries.length;
    entries = entries.slice(offset, offset + limit);

    return {
      entries,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  async delete(params) {
    const { id } = params;
    const entry = this.index.get(id);

    if (!entry) throw new Error(`File not found: ${id}`);

    await fs.remove(entry.filepath).catch(() => {});
    this.index.delete(id);
    await this.saveIndex();

    return { success: true, deleted: entry };
  }

  async search(params) {
    const { query, category, language, limit = 50 } = params;

    const results = [];
    const queryLower = query.toLowerCase();

    for (const entry of this.index.values()) {
      if (category && entry.category !== category) continue;
      if (language && entry.language !== language) continue;

      let score = 0;

      if (entry.name.toLowerCase().includes(queryLower)) score += 10;
      if (entry.filename.toLowerCase().includes(queryLower)) score += 8;
      if (entry.tags.some(t => t.toLowerCase().includes(queryLower))) score += 6;
      if (entry.language.toLowerCase().includes(queryLower)) score += 4;

      if (score > 0) {
        results.push({ ...entry, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async stats() {
    await this.calculateStats();
    return {
      ...this.stats,
      byCategory: this.getStatsByCategory(),
      byLanguage: this.getStatsByLanguage(),
      recentFiles: this.getRecentFiles(10),
      largestFiles: this.getLargestFiles(10)
    };
  }

  async export(params) {
    const { ids, format = 'zip', filename } = params;
    const exportId = uuidv4();
    const exportPath = path.join(this.exportsDir, `${filename || exportId}.${format}`);

    this.logger.info(`Exporting ${ids.length} files to ${exportPath}`);

    if (format === 'zip') {
      const output = createWriteStream(exportPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.pipe(output);

      for (const id of ids) {
        const entry = this.index.get(id);
        if (entry) {
          const content = await fs.readFile(entry.filepath);
          archive.append(content, { name: entry.filename });
        }
      }

      await archive.finalize();
    } else if (format === 'tar.gz') {
      const output = createWriteStream(exportPath);
      const archive = archiver('tar', { gzip: true, gzipOptions: { level: 9 } });

      archive.pipe(output);

      for (const id of ids) {
        const entry = this.index.get(id);
        if (entry) {
          const content = await fs.readFile(entry.filepath);
          archive.append(content, { name: entry.filename });
        }
      }

      await archive.finalize();
    }

    const stats = await fs.stat(exportPath);
    return {
      path: exportPath,
      size: stats.size,
      files: ids.length
    };
  }

  async import(params) {
    const { filepath, category = 'code' } = params;

    this.logger.info(`Importing from ${filepath}`);

    const files = await decompress(filepath);
    const imported = [];

    for (const file of files) {
      if (file.type === 'file') {
        const ext = path.extname(file.path);
        const language = this.getLanguageFromExt(ext);

        const entry = await this.save({
          name: path.basename(file.path, ext),
          content: file.data.toString('utf8'),
          language,
          category
        });

        imported.push(entry);
      }
    }

    return { imported: imported.length, files: imported };
  }

  async update(params) {
    const { id, content, tags, metadata } = params;
    const entry = this.index.get(id);

    if (!entry) throw new Error(`File not found: ${id}`);

    if (content !== undefined) {
      await fs.writeFile(entry.filepath, content);
      entry.lines = content.split('\n').length;
      const stats = await fs.stat(entry.filepath);
      entry.size = stats.size;
    }

    if (tags !== undefined) entry.tags = tags;
    if (metadata !== undefined) entry.metadata = { ...entry.metadata, ...metadata };

    entry.updatedAt = new Date().toISOString();

    this.index.set(id, entry);
    await this.saveIndex();

    return entry;
  }

  async backup(params) {
    const { name } = params;
    const backupId = uuidv4();
    const backupPath = path.join(this.backupsDir, `backup-${backupId}.zip`);

    this.logger.info(`Creating backup: ${backupPath}`);

    const output = createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    for (const [id, entry] of this.index) {
      const content = await fs.readFile(entry.filepath);
      archive.append(content, { name: entry.filename });
    }

    await archive.finalize();

    const stats = await fs.stat(backupPath);
    return {
      id: backupId,
      path: backupPath,
      size: stats.size,
      files: this.index.size,
      createdAt: new Date().toISOString()
    };
  }

  async restore(params) {
    const { backupId } = params;
    const backupPath = path.join(this.backupsDir, `backup-${backupId}.zip`);

    if (!await fs.pathExists(backupPath)) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const files = await decompress(backupPath);
    let restored = 0;

    for (const file of files) {
      if (file.type === 'file') {
        const ext = path.extname(file.path);
        const language = this.getLanguageFromExt(ext);

        await this.save({
          name: path.basename(file.path, ext),
          content: file.data.toString('utf8'),
          language,
          category: 'code'
        });

        restored++;
      }
    }

    return { restored };
  }

  async loadIndex() {
    try {
      if (await fs.pathExists(this.indexFile)) {
        const data = await fs.readJson(this.indexFile);
        this.index = new Map(Object.entries(data));
      }
    } catch (e) {
      this.logger.warn('Failed to load index, starting fresh');
      this.index = new Map();
    }
  }

  async saveIndex() {
    const data = Object.fromEntries(this.index);
    await fs.writeJson(this.indexFile, data, { spaces: 2 });
  }

  async calculateStats() {
    let totalFiles = 0;
    let totalSize = 0;
    let totalLines = 0;

    for (const entry of this.index.values()) {
      totalFiles++;
      totalSize += entry.size || 0;
      totalLines += entry.lines || 0;
    }

    this.stats = {
      totalFiles,
      totalSize,
      totalLines,
      lastUpdated: new Date().toISOString()
    };
  }

  async updateStats(entry) {
    this.stats.totalFiles++;
    this.stats.totalSize += entry.size || 0;
    this.stats.totalLines += entry.lines || 0;
    this.stats.lastUpdated = new Date().toISOString();
  }

  getStatsByCategory() {
    const byCategory = {};
    for (const entry of this.index.values()) {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = { count: 0, size: 0, lines: 0 };
      }
      byCategory[entry.category].count++;
      byCategory[entry.category].size += entry.size || 0;
      byCategory[entry.category].lines += entry.lines || 0;
    }
    return byCategory;
  }

  getStatsByLanguage() {
    const byLanguage = {};
    for (const entry of this.index.values()) {
      if (!byLanguage[entry.language]) {
        byLanguage[entry.language] = { count: 0, size: 0, lines: 0 };
      }
      byLanguage[entry.language].count++;
      byLanguage[entry.language].size += entry.size || 0;
      byLanguage[entry.language].lines += entry.lines || 0;
    }
    return byLanguage;
  }

  getRecentFiles(limit) {
    return Array.from(this.index.values())
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, limit);
  }

  getLargestFiles(limit) {
    return Array.from(this.index.values())
      .sort((a, b) => b.size - a.size)
      .slice(0, limit);
  }

  getLanguageFromExt(ext) {
    const extMap = {
      '.js': 'javascript', '.ts': 'typescript', '.py': 'python',
      '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.html': 'html',
      '.css': 'css', '.json': 'json', '.md': 'markdown',
      '.txt': 'text', '.sh': 'bash', '.yml': 'yaml',
      '.xml': 'xml', '.csv': 'csv', '.sql': 'sql'
    };
    return extMap[ext] || 'text';
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async cleanup() {
    this.logger.info('Storage Engine cleanup complete');
  }
}

module.exports = StorageEngine;
