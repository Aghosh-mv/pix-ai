const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ShoppingEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.lists = new Map();
    this.items = new Map();
    this.stores = new Map();
    this.history = new Map();
    this.shoppingDir = path.join(os.homedir(), '.pix/shopping');
  }

  async initialize() {
    this.logger.info('Initializing Shopping Engine...');
    await fs.ensureDir(this.shoppingDir);
    await this.loadShopping();
    this.loadCategories();
    this.logger.info('Shopping Engine initialized');
  }

  async loadShopping() {
    try {
      const files = await fs.readdir(this.shoppingDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.shoppingDir, file));
          if (data.type === 'list') this.lists.set(data.id, data);
          else if (data.type === 'item') this.items.set(data.id, data);
          else if (data.type === 'store') this.stores.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadCategories() {
    this.categories = [
      { id: 'groceries', name: 'Groceries', icon: '🛒' },
      { id: 'household', name: 'Household', icon: '🏠' },
      { id: 'electronics', name: 'Electronics', icon: '📱' },
      { id: 'clothing', name: 'Clothing', icon: '👕' },
      { id: 'health', name: 'Health & Beauty', icon: '💊' },
      { id: 'office', name: 'Office', icon: '💼' },
      { id: 'sports', name: 'Sports & Outdoors', icon: '⚽' },
      { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
      { id: 'other', name: 'Other', icon: '📦' }
    ];
  }

  async createList(params) {
    const {
      name,
      category = 'groceries',
      notes = '',
      budget = 0,
      storeId = null
    } = params;

    const id = uuidv4();
    const list = {
      id,
      name,
      category,
      notes,
      budget,
      storeId,
      itemIds: [],
      completed: false,
      type: 'list',
      createdAt: new Date().toISOString()
    };

    this.lists.set(id, list);
    return list;
  }

  async updateList(id, updates) {
    const list = this.lists.get(id);
    if (!list) throw new Error(`List not found: ${id}`);

    const updated = { ...list, ...updates };
    this.lists.set(id, updated);
    return updated;
  }

  async completeList(id) {
    const list = this.lists.get(id);
    if (!list) throw new Error(`List not found: ${id}`);

    list.completed = true;
    list.completedAt = new Date().toISOString();
    this.lists.set(id, list);

    this.history.set(id, { listId: id, completedAt: list.completedAt });
    return list;
  }

  async deleteList(id) {
    this.lists.delete(id);
    this.history.delete(id);

    for (const [itemId, item] of this.items) {
      if (item.listId === id) this.items.delete(itemId);
    }

    return { success: true };
  }

  listLists(options = {}) {
    const { category, completed, search } = options;
    let lists = Array.from(this.lists.values());

    if (category) lists = lists.filter(l => l.category === category);
    if (completed !== undefined) lists = lists.filter(l => l.completed === completed);
    if (search) {
      const searchLower = search.toLowerCase();
      lists = lists.filter(l => l.name.toLowerCase().includes(searchLower));
    }

    return lists;
  }

  async addItem(params) {
    const {
      listId,
      name,
      quantity = 1,
      unit = '',
      price = 0,
      notes = '',
      brand = '',
      priority = 'medium'
    } = params;

    const id = uuidv4();
    const item = {
      id,
      listId,
      name,
      quantity,
      unit,
      price,
      notes,
      brand,
      priority,
      checked: false,
      type: 'item',
      createdAt: new Date().toISOString()
    };

    this.items.set(id, item);

    const list = this.lists.get(listId);
    if (list) {
      list.itemIds.push(id);
    }

    return item;
  }

  async updateItem(id, updates) {
    const item = this.items.get(id);
    if (!item) throw new Error(`Item not found: ${id}`);

    const updated = { ...item, ...updates };
    this.items.set(id, updated);
    return updated;
  }

  async checkItem(id) {
    const item = this.items.get(id);
    if (!item) throw new Error(`Item not found: ${id}`);

    item.checked = !item.checked;
    item.checkedAt = item.checked ? new Date().toISOString() : null;
    this.items.set(id, item);
    return item;
  }

  async deleteItem(id) {
    const item = this.items.get(id);
    if (item) {
      const list = this.lists.get(item.listId);
      if (list) {
        list.itemIds = list.itemIds.filter(itemId => itemId !== id);
      }
    }

    this.items.delete(id);
    return { success: true };
  }

  async getItems(listId) {
    return Array.from(this.items.values())
      .filter(item => item.listId === listId)
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  async getListTotal(listId) {
    const items = await this.getItems(listId);
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  async addStore(params) {
    const { name, address = '', phone = '', notes = '' } = params;
    const id = uuidv4();

    const store = {
      id,
      name,
      address,
      phone,
      notes,
      visits: 0,
      totalSpent: 0,
      type: 'store',
      createdAt: new Date().toISOString()
    };

    this.stores.set(id, store);
    return store;
  }

  async updateStore(id, updates) {
    const store = this.stores.get(id);
    if (!store) throw new Error(`Store not found: ${id}`);

    const updated = { ...store, ...updates };
    this.stores.set(id, updated);
    return updated;
  }

  async deleteStore(id) {
    this.stores.delete(id);
    return { success: true };
  }

  listStores() {
    return Array.from(this.stores.values());
  }

  async getShoppingStats() {
    const lists = Array.from(this.lists.values());
    const items = Array.from(this.items.values());
    const totalSpent = items.reduce((sum, item) => sum + item.price, 0);

    return {
      totalLists: lists.length,
      activeLists: lists.filter(l => !l.completed).length,
      completedLists: lists.filter(l => l.completed).length,
      totalItems: items.length,
      checkedItems: items.filter(i => i.checked).length,
      totalSpent,
      stores: this.stores.size
    };
  }

  async getShoppingHistory() {
    return Array.from(this.history.values())
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 20);
  }

  async getCategories() {
    return this.categories;
  }

  async exportShopping(format = 'json') {
    const data = {
      lists: Array.from(this.lists.values()),
      items: Array.from(this.items.values()),
      stores: Array.from(this.stores.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = ShoppingEngine;
