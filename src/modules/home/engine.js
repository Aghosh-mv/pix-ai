const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class HomeEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.rooms = new Map();
    this.items = new Map();
    this.maintenance = new Map();
    this.homeDir = path.join(os.homedir(), '.pix/home');
  }

  async initialize() {
    this.logger.info('Initializing Home Engine...');
    await fs.ensureDir(this.homeDir);
    await this.loadRooms();
    this.loadDefaultRooms();
    this.logger.info('Home Engine initialized');
  }

  async loadRooms() {
    try {
      const files = await fs.readdir(this.homeDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const room = await fs.readJson(path.join(this.homeDir, file));
          this.rooms.set(room.id, room);
        }
      }
    } catch (e) {}
  }

  loadDefaultRooms() {
    const defaultRooms = [
      { id: 'living-room', name: 'Living Room', icon: '🛋️', floor: 'ground' },
      { id: 'kitchen', name: 'Kitchen', icon: '🍳', floor: 'ground' },
      { id: 'bedroom', name: 'Bedroom', icon: '🛏️', floor: 'first' },
      { id: 'bathroom', name: 'Bathroom', icon: '🚿', floor: 'first' },
      { id: 'garage', name: 'Garage', icon: '🚗', floor: 'ground' },
      { id: 'office', name: 'Office', icon: '💼', floor: 'first' }
    ];

    defaultRooms.forEach(room => {
      if (!this.rooms.has(room.id)) {
        this.rooms.set(room.id, {
          ...room,
          items: [],
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  async createRoom(params) {
    const { name, icon = '🏠', floor = 'ground', notes = '' } = params;
    const id = uuidv4();

    const room = {
      id,
      name,
      icon,
      floor,
      notes,
      items: [],
      createdAt: new Date().toISOString()
    };

    this.rooms.set(id, room);
    return room;
  }

  async updateRoom(id, updates) {
    const room = this.rooms.get(id);
    if (!room) throw new Error(`Room not found: ${id}`);

    const updated = { ...room, ...updates };
    this.rooms.set(id, updated);
    return updated;
  }

  async deleteRoom(id) {
    this.rooms.delete(id);
    return { success: true };
  }

  listRooms() {
    return Array.from(this.rooms.values());
  }

  async addItem(params) {
    const {
      roomId,
      name,
      category = 'furniture',
      purchaseDate = null,
      purchasePrice = 0,
      warrantyExpiry = null,
      location = '',
      notes = '',
      photo = null,
      serialNumber = ''
    } = params;

    const id = uuidv4();
    const item = {
      id,
      roomId,
      name,
      category,
      purchaseDate: purchaseDate ? new Date(purchaseDate).toISOString() : null,
      purchasePrice,
      warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry).toISOString() : null,
      location,
      notes,
      photo,
      serialNumber,
      createdAt: new Date().toISOString()
    };

    this.items.set(id, item);

    const room = this.rooms.get(roomId);
    if (room) {
      room.items.push(id);
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

  async deleteItem(id) {
    const item = this.items.get(id);
    if (item) {
      const room = this.rooms.get(item.roomId);
      if (room) {
        room.items = room.items.filter(itemId => itemId !== id);
      }
    }

    this.items.delete(id);
    return { success: true };
  }

  async getItem(id) {
    return this.items.get(id);
  }

  listItems(options = {}) {
    const { roomId, category, search } = options;

    let items = Array.from(this.items.values());

    if (roomId) items = items.filter(i => i.roomId === roomId);
    if (category) items = items.filter(i => i.category === category);
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(searchLower));
    }

    return items;
  }

  async addMaintenanceTask(params) {
    const {
      itemId,
      title,
      description = '',
      frequency = 'monthly',
      lastCompleted = null,
      nextDue = null,
      cost = 0,
      provider = ''
    } = params;

    const id = uuidv4();
    const task = {
      id,
      itemId,
      title,
      description,
      frequency,
      lastCompleted: lastCompleted ? new Date(lastCompleted).toISOString() : null,
      nextDue: nextDue ? new Date(nextDue).toISOString() : null,
      cost,
      provider,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.maintenance.set(id, task);
    return task;
  }

  async completeMaintenance(id) {
    const task = this.maintenance.get(id);
    if (!task) throw new Error(`Maintenance task not found: ${id}`);

    task.completed = true;
    task.lastCompleted = new Date().toISOString();

    const frequencyDays = {
      weekly: 7,
      biweekly: 14,
      monthly: 30,
      quarterly: 90,
      semiannual: 180,
      annual: 365
    };

    const days = frequencyDays[task.frequency] || 30;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    task.nextDue = nextDate.toISOString();

    this.maintenance.set(id, task);
    return task;
  }

  async getUpcomingMaintenance() {
    const now = new Date();
    return Array.from(this.maintenance.values())
      .filter(t => t.nextDue && new Date(t.nextDue) > now)
      .sort((a, b) => new Date(a.nextDue) - new Date(b.nextDue));
  }

  async getOverdueMaintenance() {
    const now = new Date();
    return Array.from(this.maintenance.values())
      .filter(t => t.nextDue && new Date(t.nextDue) < now && !t.completed);
  }

  async getHomeStats() {
    const rooms = Array.from(this.rooms.values());
    const items = Array.from(this.items.values());
    const totalValue = items.reduce((sum, i) => sum + (i.purchasePrice || 0), 0);

    return {
      totalRooms: rooms.length,
      totalItems: items.length,
      totalValue,
      maintenanceTasks: this.maintenance.size,
      overdueTasks: (await this.getOverdueMaintenance()).length
    };
  }

  async exportHome(format = 'json') {
    const data = {
      rooms: Array.from(this.rooms.values()),
      items: Array.from(this.items.values()),
      maintenance: Array.from(this.maintenance.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = HomeEngine;
