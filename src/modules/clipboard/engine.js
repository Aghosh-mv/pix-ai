const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ClipboardEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.items = new Map();
    this.favorites = new Set();
    this.clipboardDir = path.join(os.homedir(), '.pix/clipboard');
  }

  async initialize() {
    this.logger.info('Initializing Clipboard Engine...');
    await fs.ensureDir(this.clipboardDir);
    await this.loadClipboard();
    this.logger.info('Clipboard Engine initialized');
  }

  async loadClipboard() {
    try {
      const files = await fs.readdir(this.clipboardDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.clipboardDir, file));
          if (data.type === 'item') {
            this.items.set(data.id, data);
            if (data.favorite) this.favorites.add(data.id);
          }
        }
      }
    } catch (e) {}
  }

  async addItem(params) {
    const {
      content,
      type = 'text',
      category = 'general',
      title = '',
      tags = [],
      pinned = false
    } = params;

    const id = uuidv4();
    const item = {
      id,
      content,
      type,
      category,
      title,
      tags,
      pinned,
      favorite: false,
      copyCount: 0,
      lastCopied: null,
      type: 'item',
      createdAt: new Date().toISOString()
    };

    this.items.set(id, item);
    return item;
  }

  async updateItem(id, updates) {
    const item = this.items.get(id);
    if (!item) throw new Error(`Clipboard item not found: ${id}`);

    const updated = { ...item, ...updates };
    this.items.set(id, updated);
    return updated;
  }

  async deleteItem(id) {
    this.items.delete(id);
    this.favorites.delete(id);
    return { success: true };
  }

  async getItem(id) {
    const item = this.items.get(id);
    if (!item) throw new Error(`Clipboard item not found: ${id}`);

    item.copyCount = (item.copyCount || 0) + 1;
    item.lastCopied = new Date().toISOString();
    this.items.set(id, item);

    return item;
  }

  async copyItem(id) {
    return this.getItem(id);
  }

  listItems(options = {}) {
    const { type, category, pinned, favorite, search } = options;
    let items = Array.from(this.items.values());

    if (type) items = items.filter(i => i.type === type);
    if (category) items = items.filter(i => i.category === category);
    if (pinned !== undefined) items = items.filter(i => i.pinned === pinned);
    if (favorite !== undefined) items = items.filter(i => i.favorite === favorite);
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(i =>
        (i.content && i.content.toLowerCase().includes(searchLower)) ||
        (i.title && i.title.toLowerCase().includes(searchLower))
      );
    }

    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async toggleFavorite(id) {
    const item = this.items.get(id);
    if (!item) throw new Error(`Clipboard item not found: ${id}`);

    item.favorite = !item.favorite;
    this.items.set(id, item);

    if (item.favorite) this.favorites.add(id);
    else this.favorites.delete(id);

    return item;
  }

  async togglePin(id) {
    const item = this.items.get(id);
    if (!item) throw new Error(`Clipboard item not found: ${id}`);

    item.pinned = !item.pinned;
    this.items.set(id, item);
    return item;
  }

  async searchClipboard(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, item] of this.items) {
      let score = 0;

      if (item.content && item.content.toLowerCase().includes(queryLower)) score += 10;
      if (item.title && item.title.toLowerCase().includes(queryLower)) score += 5;
      if (item.tags && item.tags.some(t => t.toLowerCase().includes(queryLower))) score += 3;

      if (score > 0) {
        results.push({ ...item, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getStats() {
    const items = Array.from(this.items.values());

    return {
      total: items.length,
      favorites: items.filter(i => i.favorite).length,
      pinned: items.filter(i => i.pinned).length,
      byType: this.getItemsByType(),
      byCategory: this.getItemsByCategory()
    };
  }

  getItemsByType() {
    const items = Array.from(this.items.values());
    const byType = {};

    for (const item of items) {
      byType[item.type] = (byType[item.type] || 0) + 1;
    }

    return byType;
  }

  getItemsByCategory() {
    const items = Array.from(this.items.values());
    const byCategory = {};

    for (const item of items) {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    }

    return byCategory;
  }

  async saveItem(item) {
    const filePath = path.join(this.clipboardDir, `${item.id}.json`);
    await fs.writeJson(filePath, item, { spaces: 2 });
  }

  async exportClipboard(format = 'json') {
    const items = Array.from(this.items.values());

    if (format === 'json') {
      return JSON.stringify(items, null, 2);
    }

    if (format === 'text') {
      return items.map(i => i.content).join('\n\n---\n\n');
    }

    return items;
  }
}

module.exports = ClipboardEngine;
