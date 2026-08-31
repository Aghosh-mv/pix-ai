const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class FileSystemOpsEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.bookmarks = new Map();
    this.recentFiles = new Map();
    this.watches = new Map();
    this.fsDir = path.join(os.homedir(), '.pix/filesystem');
  }

  async initialize() {
    this.logger.info('Initializing File System Operations Engine...');
    await fs.ensureDir(this.fsDir);
    await this.loadBookmarks();
    this.loadRecentFiles();
    this.logger.info('File System Operations Engine initialized');
  }

  async loadBookmarks() {
    try {
      const files = await fs.readdir(this.fsDir);
      for (const file of files) {
        if (file.startsWith('bookmark-') && file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.fsDir, file));
          this.bookmarks.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadRecentFiles() {
    try {
      const historyPath = path.join(this.fsDir, 'recent.json');
      if (fs.existsSync(historyPath)) {
        const data = fs.readJsonSync(historyPath);
        if (Array.isArray(data)) {
          data.forEach(file => this.recentFiles.set(file.id, file));
        }
      }
    } catch (e) {}
  }

  async readFile(filePath, options = {}) {
    const { encoding = 'utf-8', flag = 'r' } = options;
    const stats = await fs.stat(filePath);

    if (stats.isDirectory()) {
      throw new Error(`Cannot read directory as file: ${filePath}`);
    }

    if (stats.size > 10 * 1024 * 1024) {
      throw new Error(`File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Use stream for large files.`);
    }

    const content = await fs.readFile(filePath, { encoding, flag });

    this.addToRecent(filePath, stats);

    return {
      path: filePath,
      content,
      size: stats.size,
      modified: stats.mtime,
      created: stats.birthtime
    };
  }

  async writeFile(filePath, content, options = {}) {
    const { encoding = 'utf-8', flag = 'w', mkdirp = true } = options;

    if (mkdirp) {
      await fs.ensureDir(path.dirname(filePath));
    }

    await fs.writeFile(filePath, content, { encoding, flag });

    const stats = await fs.stat(filePath);
    this.addToRecent(filePath, stats);

    return {
      path: filePath,
      size: stats.size,
      modified: stats.mtime,
      success: true
    };
  }

  async appendFile(filePath, content, options = {}) {
    const { encoding = 'utf-8' } = options;
    await fs.appendFile(filePath, content, { encoding });

    const stats = await fs.stat(filePath);
    return {
      path: filePath,
      size: stats.size,
      modified: stats.mtime,
      success: true
    };
  }

  async deleteFile(filePath) {
    const exists = await fs.pathExists(filePath);
    if (!exists) throw new Error(`File not found: ${filePath}`);

    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      await fs.remove(filePath);
    } else {
      await fs.unlink(filePath);
    }

    this.removeFromRecent(filePath);

    return { path: filePath, success: true };
  }

  async moveFile(source, destination) {
    await fs.move(source, destination, { overwrite: true });

    this.removeFromRecent(source);

    return {
      source,
      destination,
      success: true
    };
  }

  async copyFile(source, destination, options = {}) {
    const { overwrite = true } = options;
    await fs.copy(source, destination, { overwrite });

    return {
      source,
      destination,
      success: true
    };
  }

  async renameFile(oldPath, newPath) {
    await fs.rename(oldPath, newPath);

    this.removeFromRecent(oldPath);

    return {
      oldPath,
      newPath,
      success: true
    };
  }

  async createDirectory(dirPath, options = {}) {
    const { recursive = true } = options;
    await fs.ensureDir(dirPath);

    return {
      path: dirPath,
      success: true
    };
  }

  async deleteDirectory(dirPath) {
    const exists = await fs.pathExists(dirPath);
    if (!exists) throw new Error(`Directory not found: ${dirPath}`);

    await fs.remove(dirPath);

    return { path: dirPath, success: true };
  }

  async listDirectory(dirPath, options = {}) {
    const { showHidden = false, recursive = false, pattern = null } = options;

    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const results = [];

    for (const item of items) {
      if (!showHidden && item.name.startsWith('.')) continue;

      const itemPath = path.join(dirPath, item.name);
      const stats = await fs.stat(itemPath);

      const result = {
        name: item.name,
        path: itemPath,
        isDirectory: item.isDirectory(),
        isFile: item.isFile(),
        isSymlink: item.isSymbolicLink ? item.isSymbolicLink() : false,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        permissions: stats.mode.toString(8).slice(-3)
      };

      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        if (!regex.test(item.name)) continue;
      }

      results.push(result);

      if (recursive && item.isDirectory()) {
        try {
          const subItems = await this.listDirectory(itemPath, options);
          results.push(...subItems);
        } catch (e) {}
      }
    }

    return results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async getFileInfo(filePath) {
    const stats = await fs.stat(filePath);

    return {
      path: filePath,
      name: path.basename(filePath),
      directory: path.dirname(filePath),
      extension: path.extname(filePath),
      basename: path.basename(filePath, path.extname(filePath)),
      size: stats.size,
      sizeFormatted: this.formatSize(stats.size),
      modified: stats.mtime,
      created: stats.birthtime,
      accessed: stats.atime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymlink: stats.isSymbolicLink(),
      permissions: stats.mode.toString(8).slice(-3),
      owner: stats.uid,
      group: stats.gid
    };
  }

  async searchFiles(dirPath, query, options = {}) {
    const { maxDepth = 10, maxResults = 100 } = options;
    const results = [];

    const search = async (currentPath, depth) => {
      if (depth > maxDepth || results.length >= maxResults) return;

      try {
        const items = await fs.readdir(currentPath, { withFileTypes: true });

        for (const item of items) {
          if (results.length >= maxResults) break;

          const itemPath = path.join(currentPath, item.name);

          if (item.name.toLowerCase().includes(query.toLowerCase())) {
            const stats = await fs.stat(itemPath);
            results.push({
              name: item.name,
              path: itemPath,
              isDirectory: item.isDirectory(),
              size: stats.size,
              modified: stats.mtime
            });
          }

          if (item.isDirectory()) {
            await search(itemPath, depth + 1);
          }
        }
      } catch (e) {}
    };

    await search(dirPath, 0);
    return results;
  }

  async watchDirectory(dirPath, callback) {
    const watcherId = uuidv4();

    const watcher = fs.watch(dirPath, { recursive: true }, (event, filename) => {
      this.watches.set(watcherId, {
        path: dirPath,
        event,
        filename,
        timestamp: new Date().toISOString()
      });

      if (callback) {
        callback({ event, filename, path: dirPath });
      }
    });

    this.watches.set(watcherId, {
      id: watcherId,
      path: dirPath,
      watcher,
      status: 'active',
      startedAt: new Date().toISOString()
    });

    return watcherId;
  }

  async stopWatch(watcherId) {
    const watch = this.watches.get(watcherId);
    if (!watch) throw new Error(`Watch not found: ${watcherId}`);

    if (watch.watcher) {
      watch.watcher.close();
    }

    this.watches.delete(watcherId);
    return { success: true };
  }

  async getDiskUsage(dirPath) {
    const usage = {
      total: 0,
      directories: 0,
      files: 0,
      byExtension: {}
    };

    const calculate = async (currentPath) => {
      try {
        const items = await fs.readdir(currentPath, { withFileTypes: true });

        for (const item of items) {
          const itemPath = path.join(currentPath, item.name);

          if (item.isDirectory()) {
            usage.directories++;
            await calculate(itemPath);
          } else {
            const stats = await fs.stat(itemPath);
            usage.total += stats.size;
            usage.files++;

            const ext = path.extname(item.name).toLowerCase() || 'no-extension';
            if (!usage.byExtension[ext]) {
              usage.byExtension[ext] = { count: 0, size: 0 };
            }
            usage.byExtension[ext].count++;
            usage.byExtension[ext].size += stats.size;
          }
        }
      } catch (e) {}
    };

    await calculate(dirPath);

    usage.totalFormatted = this.formatSize(usage.total);
    for (const ext of Object.keys(usage.byExtension)) {
      usage.byExtension[ext].sizeFormatted = this.formatSize(usage.byExtension[ext].size);
    }

    return usage;
  }

  async backupFile(filePath, backupDir) {
    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${fileName}.${timestamp}.backup`;
    const backupPath = path.join(backupDir || path.dirname(filePath), backupName);

    await fs.copy(filePath, backupPath);

    return {
      original: filePath,
      backup: backupPath,
      success: true
    };
  }

  async getRecentFiles(limit = 50) {
    return Array.from(this.recentFiles.values())
      .sort((a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed))
      .slice(0, limit);
  }

  async addBookmark(name, filePath) {
    const id = uuidv4();
    const bookmark = {
      id,
      name,
      path: filePath,
      createdAt: new Date().toISOString()
    };

    this.bookmarks.set(id, bookmark);
    await this.saveBookmark(bookmark);

    return bookmark;
  }

  async removeBookmark(id) {
    this.bookmarks.delete(id);
    await fs.remove(path.join(this.fsDir, `bookmark-${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getBookmarks() {
    return Array.from(this.bookmarks.values());
  }

  async compareFiles(file1, file2) {
    const content1 = await fs.readFile(file1, 'utf-8');
    const content2 = await fs.readFile(file2, 'utf-8');

    const stats1 = await fs.stat(file1);
    const stats2 = await fs.stat(file2);

    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    const differences = [];
    const maxLines = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLines; i++) {
      if (lines1[i] !== lines2[i]) {
        differences.push({
          line: i + 1,
          file1: lines1[i] || '(missing)',
          file2: lines2[i] || '(missing)'
        });
      }
    }

    return {
      identical: differences.length === 0,
      differences,
      stats: {
        file1: { size: stats1.size, lines: lines1.length },
        file2: { size: stats2.size, lines: lines2.length }
      }
    };
  }

  async getDirectoryTree(dirPath, options = {}) {
    const { maxDepth = 3, showFiles = true, ignore = [] } = options;

    const buildTree = async (currentPath, depth) => {
      if (depth > maxDepth) return null;

      const items = await fs.readdir(currentPath, { withFileTypes: true });
      const children = [];

      for (const item of items) {
        if (ignore.includes(item.name)) continue;

        const itemPath = path.join(currentPath, item.name);

        if (item.isDirectory()) {
          const subtree = await buildTree(itemPath, depth + 1);
          children.push({
            name: item.name,
            path: itemPath,
            type: 'directory',
            children: subtree?.children || []
          });
        } else if (showFiles) {
          children.push({
            name: item.name,
            path: itemPath,
            type: 'file'
          });
        }
      }

      return {
        name: path.basename(currentPath),
        path: currentPath,
        type: 'directory',
        children: children.sort((a, b) => {
          if (a.type === 'directory' && b.type !== 'directory') return -1;
          if (a.type !== 'directory' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        })
      };
    };

    return buildTree(dirPath, 0);
  }

  addToRecent(filePath, stats) {
    const id = Buffer.from(filePath).toString('base64');
    this.recentFiles.set(id, {
      id,
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
      modified: stats.mtime,
      lastAccessed: new Date().toISOString()
    });

    this.saveRecent();
  }

  removeFromRecent(filePath) {
    const id = Buffer.from(filePath).toString('base64');
    this.recentFiles.delete(id);
    this.saveRecent();
  }

  async saveRecent() {
    const filePath = path.join(this.fsDir, 'recent.json');
    const recentArray = Array.from(this.recentFiles.values()).slice(-200);
    await fs.writeJson(filePath, recentArray, { spaces: 2 });
  }

  async saveBookmark(bookmark) {
    const filePath = path.join(this.fsDir, `bookmark-${bookmark.id}.json`);
    await fs.writeJson(filePath, bookmark, { spaces: 2 });
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async getStats() {
    return {
      bookmarks: this.bookmarks.size,
      recentFiles: this.recentFiles.size,
      watches: this.watches.size
    };
  }
}

module.exports = FileSystemOpsEngine;
