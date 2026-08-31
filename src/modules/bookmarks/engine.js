const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class BookmarkEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.bookmarks = new Map();
    this.collections = new Map();
    this.tags = new Set();
    this.bookmarkDir = path.join(os.homedir(), '.pix/bookmarks');
  }

  async initialize() {
    this.logger.info('Initializing Bookmark Engine...');
    await fs.ensureDir(this.bookmarkDir);
    await this.loadBookmarks();
    this.loadDefaultCollections();
    this.logger.info('Bookmark Engine initialized');
  }

  async loadBookmarks() {
    try {
      const files = await fs.readdir(this.bookmarkDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const bookmark = await fs.readJson(path.join(this.bookmarkDir, file));
          this.bookmarks.set(bookmark.id, bookmark);
          if (bookmark.tags) bookmark.tags.forEach(t => this.tags.add(t));
        }
      }
    } catch (e) {}
  }

  loadDefaultCollections() {
    const collections = [
      { id: 'favorites', name: 'Favorites', icon: '⭐', color: '#fbbc04' },
      { id: 'reading-list', name: 'Reading List', icon: '📚', color: '#4285f4' },
      { id: 'work', name: 'Work', icon: '💼', color: '#34a853' },
      { id: 'personal', name: 'Personal', icon: '🏠', color: '#ea4335' },
      { id: 'research', name: 'Research', icon: '🔬', color: '#9c27b0' }
    ];

    collections.forEach(col => {
      this.collections.set(col.id, col);
    });
  }

  async create(params) {
    const {
      url,
      title,
      description = '',
      favicon = null,
      collectionId = 'favorites',
      tags = [],
      notes = '',
      isPrivate = false
    } = params;

    const id = uuidv4();
    const bookmark = {
      id,
      url,
      title,
      description,
      favicon,
      collectionId,
      tags,
      notes,
      isPrivate,
      visitCount: 0,
      lastVisited: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.bookmarks.set(id, bookmark);
    tags.forEach(t => this.tags.add(t));

    await this.saveBookmark(bookmark);

    this.logger.info(`Bookmark created: ${title}`);
    return bookmark;
  }

  async update(id, updates) {
    const bookmark = this.bookmarks.get(id);
    if (!bookmark) throw new Error(`Bookmark not found: ${id}`);

    const updated = {
      ...bookmark,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    if (updates.tags) {
      updates.tags.forEach(t => this.tags.add(t));
    }

    this.bookmarks.set(id, updated);
    await this.saveBookmark(updated);

    return updated;
  }

  async delete(id) {
    this.bookmarks.delete(id);
    await fs.remove(path.join(this.bookmarkDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async get(id) {
    const bookmark = this.bookmarks.get(id);
    if (bookmark) {
      bookmark.visitCount++;
      bookmark.lastVisited = new Date().toISOString();
      this.bookmarks.set(id, bookmark);
      await this.saveBookmark(bookmark);
    }
    return bookmark;
  }

  list(options = {}) {
    const { collectionId, tags, search, limit = 100, offset = 0 } = options;

    let bookmarks = Array.from(this.bookmarks.values());

    if (collectionId) bookmarks = bookmarks.filter(b => b.collectionId === collectionId);
    if (tags && tags.length > 0) bookmarks = bookmarks.filter(b => tags.some(t => b.tags.includes(t)));
    if (search) {
      const searchLower = search.toLowerCase();
      bookmarks = bookmarks.filter(b =>
        b.title.toLowerCase().includes(searchLower) ||
        b.url.toLowerCase().includes(searchLower) ||
        b.description.toLowerCase().includes(searchLower)
      );
    }

    bookmarks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return {
      bookmarks: bookmarks.slice(offset, offset + limit),
      total: bookmarks.length
    };
  }

  async search(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, bookmark] of this.bookmarks) {
      let score = 0;

      if (bookmark.title.toLowerCase().includes(queryLower)) score += 10;
      if (bookmark.url.toLowerCase().includes(queryLower)) score += 8;
      if (bookmark.description.toLowerCase().includes(queryLower)) score += 5;
      if (bookmark.tags.some(t => t.toLowerCase().includes(queryLower))) score += 3;

      if (score > 0) {
        results.push({ ...bookmark, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async visit(id) {
    const bookmark = this.bookmarks.get(id);
    if (!bookmark) throw new Error(`Bookmark not found: ${id}`);

    bookmark.visitCount++;
    bookmark.lastVisited = new Date().toISOString();
    this.bookmarks.set(id, bookmark);
    await this.saveBookmark(bookmark);

    return bookmark;
  }

  async addTag(id, tag) {
    const bookmark = this.bookmarks.get(id);
    if (!bookmark) throw new Error(`Bookmark not found: ${id}`);

    if (!bookmark.tags.includes(tag)) {
      bookmark.tags.push(tag);
      this.tags.add(tag);
      bookmark.updatedAt = new Date().toISOString();
      this.bookmarks.set(id, bookmark);
      await this.saveBookmark(bookmark);
    }

    return bookmark;
  }

  async removeTag(id, tag) {
    const bookmark = this.bookmarks.get(id);
    if (!bookmark) throw new Error(`Bookmark not found: ${id}`);

    bookmark.tags = bookmark.tags.filter(t => t !== tag);
    bookmark.updatedAt = new Date().toISOString();
    this.bookmarks.set(id, bookmark);
    await this.saveBookmark(bookmark);

    return bookmark;
  }

  async moveToCollection(id, collectionId) {
    const bookmark = this.bookmarks.get(id);
    if (!bookmark) throw new Error(`Bookmark not found: ${id}`);

    bookmark.collectionId = collectionId;
    bookmark.updatedAt = new Date().toISOString();
    this.bookmarks.set(id, bookmark);
    await this.saveBookmark(bookmark);

    return bookmark;
  }

  createCollection(params) {
    const { id, name, icon = '📁', color = '#4285f4', description = '' } = params;
    const collection = { id, name, icon, color, description, createdAt: new Date().toISOString() };
    this.collections.set(id, collection);
    return collection;
  }

  updateCollection(id, updates) {
    const collection = this.collections.get(id);
    if (!collection) throw new Error(`Collection not found: ${id}`);

    const updated = { ...collection, ...updates };
    this.collections.set(id, updated);
    return updated;
  }

  deleteCollection(id) {
    this.collections.delete(id);
    return { success: true };
  }

  listCollections() {
    return Array.from(this.collections.values());
  }

  getAllTags() {
    return Array.from(this.tags);
  }

  async getMostVisited(limit = 10) {
    return Array.from(this.bookmarks.values())
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, limit);
  }

  async getRecent(limit = 10) {
    return Array.from(this.bookmarks.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async getStats() {
    const bookmarks = Array.from(this.bookmarks.values());
    const totalVisits = bookmarks.reduce((sum, b) => sum + b.visitCount, 0);

    return {
      totalBookmarks: bookmarks.length,
      totalCollections: this.collections.size,
      totalTags: this.tags.size,
      totalVisits,
      mostVisited: (await this.getMostVisited(1))[0] || null
    };
  }

  async exportBookmarks(format = 'json') {
    const bookmarks = Array.from(this.bookmarks.values());

    if (format === 'json') {
      return JSON.stringify(bookmarks, null, 2);
    }

    if (format === 'html') {
      let html = '<!DOCTYPE html>\n<html>\n<head><title>Bookmarks</title></head>\n<body>\n';
      for (const bookmark of bookmarks) {
        html += `<a href="${bookmark.url}">${bookmark.title}</a><br>\n`;
      }
      html += '</body>\n</html>';
      return html;
    }

    return bookmarks;
  }

  async importBookmarks(data) {
    const bookmarks = Array.isArray(data) ? data : JSON.parse(data);
    let imported = 0;

    for (const bookmark of bookmarks) {
      await this.create({
        url: bookmark.url,
        title: bookmark.title,
        description: bookmark.description,
        tags: bookmark.tags || [],
        collectionId: bookmark.collectionId || 'favorites'
      });
      imported++;
    }

    return { imported };
  }

  async saveBookmark(bookmark) {
    const filePath = path.join(this.bookmarkDir, `${bookmark.id}.json`);
    await fs.writeJson(filePath, bookmark, { spaces: 2 });
  }
}

module.exports = BookmarkEngine;
