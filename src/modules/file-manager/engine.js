const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class FileManagerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.bookmarks = new Map();
    this.recentFiles = [];
    this.fileTypes = new Map();
    this.fileManagerDir = path.join(os.homedir(), '.pix/filemanager');
  }

  async initialize() {
    this.logger.info('Initializing File Manager Engine...');
    await fs.ensureDir(this.fileManagerDir);
    await this.loadFileManager();
    this.loadDefaultBookmarks();
    this.loadFileTypes();
    this.logger.info('File Manager Engine initialized');
  }

  async loadFileManager() {
    try {
      const files = await fs.readdir(this.fileManagerDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.fileManagerDir, file));
          if (data.type === 'bookmark') this.bookmarks.set(data.id, data);
          else if (data.type === 'recent') this.recentFiles = data.files || [];
        }
      }
    } catch (e) {}
  }

  loadDefaultBookmarks() {
    const defaults = [
      { id: 'home', name: 'Home', path: os.homedir(), icon: '🏠' },
      { id: 'desktop', name: 'Desktop', path: path.join(os.homedir(), 'Desktop'), icon: '🖥️' },
      { id: 'documents', name: 'Documents', path: path.join(os.homedir(), 'Documents'), icon: '📄' },
      { id: 'downloads', name: 'Downloads', path: path.join(os.homedir(), 'Downloads'), icon: '📥' },
      { id: 'pictures', name: 'Pictures', path: path.join(os.homedir(), 'Pictures'), icon: '🖼️' },
      { id: 'music', name: 'Music', path: path.join(os.homedir(), 'Music'), icon: '🎵' },
      { id: 'videos', name: 'Videos', path: path.join(os.homedir(), 'Videos'), icon: '🎬' }
    ];

    defaults.forEach(bookmark => {
      if (!this.bookmarks.has(bookmark.id)) {
        this.bookmarks.set(bookmark.id, {
          ...bookmark,
          type: 'bookmark',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  loadFileTypes() {
    this.extensions = {
      image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico'],
      video: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'],
      audio: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma'],
      document: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx'],
      code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.rb', '.go', '.rs', '.php'],
      archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
      executable: ['.exe', '.msi', '.dmg', '.app', '.deb', '.rpm']
    };
  }

  async addBookmark(params) {
    const { name, path: filePath, icon = '📁' } = params;

    const id = uuidv4();
    const bookmark = {
      id,
      name,
      path: filePath,
      icon,
      type: 'bookmark',
      createdAt: new Date().toISOString()
    };

    this.bookmarks.set(id, bookmark);
    return bookmark;
  }

  async updateBookmark(id, updates) {
    const bookmark = this.bookmarks.get(id);
    if (!bookmark) throw new Error(`Bookmark not found: ${id}`);

    const updated = { ...bookmark, ...updates };
    this.bookmarks.set(id, updated);
    return updated;
  }

  async deleteBookmark(id) {
    this.bookmarks.delete(id);
    return { success: true };
  }

  listBookmarks() {
    return Array.from(this.bookmarks.values());
  }

  async addRecentFile(params) {
    const { path: filePath, name, size = 0, type = 'file' } = params;

    const recentEntry = {
      path: filePath,
      name,
      size,
      type,
      accessedAt: new Date().toISOString()
    };

    this.recentFiles = this.recentFiles.filter(f => f.path !== filePath);
    this.recentFiles.unshift(recentEntry);

    if (this.recentFiles.length > 100) {
      this.recentFiles = this.recentFiles.slice(0, 100);
    }

    return recentEntry;
  }

  getRecentFiles(limit = 50) {
    return this.recentFiles.slice(0, limit);
  }

  clearRecentFiles() {
    this.recentFiles = [];
    return { success: true };
  }

  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();

      let category = 'other';
      for (const [type, extensions] of Object.entries(this.extensions)) {
        if (extensions.includes(ext)) {
          category = type;
          break;
        }
      }

      return {
        name: path.basename(filePath),
        path: filePath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        category,
        extension: ext,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime
      };
    } catch (error) {
      throw new Error(`Cannot access file: ${filePath}`);
    }
  }

  async readDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const items = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stats = await fs.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase();

          let category = 'other';
          for (const [type, extensions] of Object.entries(this.extensions)) {
            if (extensions.includes(ext)) {
              category = type;
              break;
            }
          }

          items.push({
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            category,
            extension: ext,
            modified: stats.mtime
          });
        } catch (e) {
          items.push({
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: 0,
            category: 'other',
            modified: null
          });
        }
      }

      return items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      throw new Error(`Cannot read directory: ${dirPath}`);
    }
  }

  async searchFiles(dirPath, query, options = {}) {
    const { maxDepth = 5, includeHidden = false } = options;
    const results = [];

    const search = async (currentPath, depth) => {
      if (depth > maxDepth) return;

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          if (!includeHidden && entry.name.startsWith('.')) continue;

          const fullPath = path.join(currentPath, entry.name);

          if (entry.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              name: entry.name,
              path: fullPath,
              isDirectory: entry.isDirectory()
            });
          }

          if (entry.isDirectory()) {
            await search(fullPath, depth + 1);
          }
        }
      } catch (e) {}
    };

    await search(dirPath, 0);
    return results;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async getFileStats(dirPath) {
    const items = await this.readDirectory(dirPath);

    const stats = {
      totalItems: items.length,
      directories: items.filter(i => i.isDirectory).length,
      files: items.filter(i => !i.isDirectory).length,
      totalSize: items.reduce((sum, i) => sum + (i.size || 0), 0),
      byCategory: {}
    };

    for (const item of items) {
      if (!item.isDirectory) {
        stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
      }
    }

    stats.totalSizeFormatted = this.formatFileSize(stats.totalSize);

    return stats;
  }

  async getStats() {
    return {
      bookmarks: this.bookmarks.size,
      recentFiles: this.recentFiles.length,
      fileTypes: Object.keys(this.extensions).length
    };
  }

  async exportFileManager(format = 'json') {
    const data = {
      bookmarks: Array.from(this.bookmarks.values()),
      recentFiles: this.recentFiles
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = FileManagerEngine;
