const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class WishlistEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.items = new Map();
    this.categories = new Map();
    this.wishlistDir = path.join(os.homedir(), '.pix/wishlist');
  }

  async initialize() {
    this.logger.info('Initializing Wishlist Engine...');
    await fs.ensureDir(this.wishlistDir);
    await this.loadWishlist();
    this.loadDefaultCategories();
    this.logger.info('Wishlist Engine initialized');
  }

  async loadWishlist() {
    try {
      const files = await fs.readdir(this.wishlistDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.wishlistDir, file));
          if (data.type === 'item') this.items.set(data.id, data);
          else if (data.type === 'category') this.categories.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadDefaultCategories() {
    const defaults = [
      { id: 'electronics', name: 'Electronics', icon: '📱' },
      { id: 'clothing', name: 'Clothing', icon: '👕' },
      { id: 'home', name: 'Home & Garden', icon: '🏠' },
      { id: 'books', name: 'Books & Media', icon: '📚' },
      { id: 'gaming', name: 'Gaming', icon: '🎮' },
      { id: 'fitness', name: 'Fitness', icon: '💪' },
      { id: 'travel', name: 'Travel', icon: '✈️' },
      { id: 'other', name: 'Other', icon: '✨' }
    ];

    defaults.forEach(cat => {
      if (!this.categories.has(cat.id)) {
        this.categories.set(cat.id, {
          ...cat,
          type: 'category',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  async addItem(params) {
    const {
      name,
      category = 'other',
      price = 0,
      url = '',
      imageUrl = '',
      description = '',
      priority = 'medium',
      notes = '',
      store = '',
      gift = false,
      occasion = ''
    } = params;

    const id = uuidv4();
    const item = {
      id,
      name,
      category,
      price,
      url,
      imageUrl,
      description,
      priority,
      notes,
      store,
      gift,
      occasion,
      purchased: false,
      purchasedDate: null,
      purchasedPrice: null,
      type: 'item',
      createdAt: new Date().toISOString()
    };

    this.items.set(id, item);
    return item;
  }

  async updateItem(id, updates) {
    const item = this.items.get(id);
    if (!item) throw new Error(`Item not found: ${id}`);

    const updated = { ...item, ...updates };
    this.items.set(id, updated);
    return updated;
  }

  async markPurchased(id, price = null) {
    const item = this.items.get(id);
    if (!item) throw new Error(`Item not found: ${id}`);

    item.purchased = true;
    item.purchasedDate = new Date().toISOString();
    item.purchasedPrice = price || item.price;
    this.items.set(id, item);
    return item;
  }

  async unmarkPurchased(id) {
    const item = this.items.get(id);
    if (!item) throw new Error(`Item not found: ${id}`);

    item.purchased = false;
    item.purchasedDate = null;
    item.purchasedPrice = null;
    this.items.set(id, item);
    return item;
  }

  async deleteItem(id) {
    this.items.delete(id);
    return { success: true };
  }

  listItems(options = {}) {
    const { category, purchased, priority, search, sort = 'date' } = options;
    let items = Array.from(this.items.values());

    if (category) items = items.filter(i => i.category === category);
    if (purchased !== undefined) items = items.filter(i => i.purchased === purchased);
    if (priority) items = items.filter(i => i.priority === priority);
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(searchLower) ||
        i.description.toLowerCase().includes(searchLower)
      );
    }

    if (sort === 'price') items.sort((a, b) => a.price - b.price);
    else if (sort === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else {
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return items;
  }

  async getItem(id) {
    return this.items.get(id);
  }

  async createCategory(params) {
    const { name, icon = '✨' } = params;
    const id = uuidv4();

    const category = {
      id,
      name,
      icon,
      type: 'category',
      createdAt: new Date().toISOString()
    };

    this.categories.set(id, category);
    return category;
  }

  async updateCategory(id, updates) {
    const category = this.categories.get(id);
    if (!category) throw new Error(`Category not found: ${id}`);

    const updated = { ...category, ...updates };
    this.categories.set(id, updated);
    return updated;
  }

  async deleteCategory(id) {
    this.categories.delete(id);
    return { success: true };
  }

  getCategories() {
    return Array.from(this.categories.values());
  }

  async getStats() {
    const items = Array.from(this.items.values());
    const totalValue = items.reduce((sum, i) => sum + i.price, 0);
    const purchasedTotal = items.filter(i => i.purchased)
      .reduce((sum, i) => sum + (i.purchasedPrice || i.price), 0);

    return {
      totalItems: items.length,
      purchased: items.filter(i => i.purchased).length,
      unpurchased: items.filter(i => !i.purchased).length,
      totalValue,
      purchasedTotal,
      categories: this.categories.size,
      byCategory: this.getItemsByCategory()
    };
  }

  getItemsByCategory() {
    const items = Array.from(this.items.values());
    const byCategory = {};

    for (const item of items) {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    }

    return byCategory;
  }

  async searchWishlist(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, item] of this.items) {
      let score = 0;

      if (item.name.toLowerCase().includes(queryLower)) score += 10;
      if (item.description.toLowerCase().includes(queryLower)) score += 5;
      if (item.store.toLowerCase().includes(queryLower)) score += 3;

      if (score > 0) {
        results.push({ ...item, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async exportWishlist(format = 'json') {
    const data = {
      items: Array.from(this.items.values()),
      categories: Array.from(this.categories.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'csv') {
      const headers = ['name', 'price', 'category', 'purchased', 'priority', 'store'];
      const rows = items.map(i => [
        i.name, i.price, i.category, i.purchased, i.priority, i.store
      ]);
      return [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    }

    return data;
  }
}

module.exports = WishlistEngine;
