const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class GardenEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.plants = new Map();
    this.gardens = new Map();
    this.tasks = new Map();
    this.journal = new Map();
    this.gardenDir = path.join(os.homedir(), '.pix/garden');
  }

  async initialize() {
    this.logger.info('Initializing Garden Engine...');
    await fs.ensureDir(this.gardenDir);
    await this.loadPlants();
    this.loadPlantDatabase();
    this.logger.info('Garden Engine initialized');
  }

  async loadPlants() {
    try {
      const files = await fs.readdir(this.gardenDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const plant = await fs.readJson(path.join(this.gardenDir, file));
          this.plants.set(plant.id, plant);
        }
      }
    } catch (e) {}
  }

  loadPlantDatabase() {
    this.plantDatabase = [
      { id: 'tomato', name: 'Tomato', type: 'vegetable', sunlight: 'full', water: 'regular', difficulty: 'medium' },
      { id: 'basil', name: 'Basil', type: 'herb', sunlight: 'full', water: 'regular', difficulty: 'easy' },
      { id: 'rose', name: 'Rose', type: 'flower', sunlight: 'full', water: 'regular', difficulty: 'medium' },
      { id: 'succulent', name: 'Succulent', type: 'indoor', sunlight: 'indirect', water: 'minimal', difficulty: 'easy' },
      { id: 'fern', name: 'Fern', type: 'indoor', sunlight: 'indirect', water: 'regular', difficulty: 'easy' },
      { id: 'lavender', name: 'Lavender', type: 'herb', sunlight: 'full', water: 'minimal', difficulty: 'easy' },
      { id: 'pepper', name: 'Pepper', type: 'vegetable', sunlight: 'full', water: 'regular', difficulty: 'medium' },
      { id: 'sunflower', name: 'Sunflower', type: 'flower', sunlight: 'full', water: 'regular', difficulty: 'easy' },
      { id: 'mint', name: 'Mint', type: 'herb', sunlight: 'partial', water: 'regular', difficulty: 'easy' },
      { id: 'orchid', name: 'Orchid', type: 'flower', sunlight: 'indirect', water: 'weekly', difficulty: 'hard' }
    ];
  }

  async createPlant(params) {
    const {
      name,
      species,
      type = 'other',
      location = '',
      acquiredDate = new Date().toISOString(),
      notes = '',
      photo = null,
      wateringFrequency = 'weekly',
      sunlightNeeds = 'partial'
    } = params;

    const id = uuidv4();
    const plant = {
      id,
      name,
      species,
      type,
      location,
      acquiredDate: new Date(acquiredDate).toISOString(),
      lastWatered: null,
      nextWatering: null,
      notes,
      photo,
      wateringFrequency,
      sunlightNeeds,
      health: 'good',
      growthLog: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.plants.set(id, plant);
    await this.savePlant(plant);

    this.logger.info(`Plant added: ${name}`);
    return plant;
  }

  async updatePlant(id, updates) {
    const plant = this.plants.get(id);
    if (!plant) throw new Error(`Plant not found: ${id}`);

    const updated = {
      ...plant,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.plants.set(id, updated);
    await this.savePlant(updated);

    return updated;
  }

  async deletePlant(id) {
    this.plants.delete(id);
    await fs.remove(path.join(this.gardenDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getPlant(id) {
    return this.plants.get(id);
  }

  listPlants(options = {}) {
    const { type, location, health, search } = options;

    let plants = Array.from(this.plants.values());

    if (type) plants = plants.filter(p => p.type === type);
    if (location) plants = plants.filter(p => p.location === location);
    if (health) plants = plants.filter(p => p.health === health);
    if (search) {
      const searchLower = search.toLowerCase();
      plants = plants.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.species.toLowerCase().includes(searchLower)
      );
    }

    return plants;
  }

  async waterPlant(id) {
    const plant = this.plants.get(id);
    if (!plant) throw new Error(`Plant not found: ${id}`);

    plant.lastWatered = new Date().toISOString();
    plant.updatedAt = new Date().toISOString();

    const frequency = {
      daily: 1,
      'twice-daily': 0.5,
      regular: 3,
      weekly: 7,
      biweekly: 14,
      monthly: 30
    };

    const days = frequency[plant.wateringFrequency] || 7;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    plant.nextWatering = nextDate.toISOString();

    this.plants.set(id, plant);
    await this.savePlant(plant);

    return plant;
  }

  async addToGrowthLog(id, entry) {
    const plant = this.plants.get(id);
    if (!plant) throw new Error(`Plant not found: ${id}`);

    plant.growthLog.push({
      id: uuidv4(),
      date: new Date().toISOString(),
      ...entry
    });

    plant.updatedAt = new Date().toISOString();
    this.plants.set(id, plant);
    await this.savePlant(plant);

    return plant;
  }

  async getPlantsNeedingWater() {
    const now = new Date();
    return Array.from(this.plants.values())
      .filter(p => !p.nextWatering || new Date(p.nextWatering) <= now)
      .sort((a, b) => {
        if (!a.nextWatering) return -1;
        if (!b.nextWatering) return 1;
        return new Date(a.nextWatering) - new Date(b.nextWatering);
      });
  }

  async createGarden(params) {
    const { name, location, size = '', type = 'outdoor', notes = '' } = params;
    const id = uuidv4();

    const garden = {
      id,
      name,
      location,
      size,
      type,
      notes,
      plantIds: [],
      createdAt: new Date().toISOString()
    };

    this.gardens.set(id, garden);
    return garden;
  }

  async addPlantToGarden(gardenId, plantId) {
    const garden = this.gardens.get(gardenId);
    if (!garden) throw new Error(`Garden not found: ${gardenId}`);

    if (!garden.plantIds.includes(plantId)) {
      garden.plantIds.push(plantId);
    }

    return garden;
  }

  async removePlantFromGarden(gardenId, plantId) {
    const garden = this.gardens.get(gardenId);
    if (!garden) throw new Error(`Garden not found: ${gardenId}`);

    garden.plantIds = garden.plantIds.filter(id => id !== plantId);
    return garden;
  }

  listGardens() {
    return Array.from(this.gardens.values());
  }

  async createTask(params) {
    const { title, description = '', dueDate = null, priority = 'medium', plantId = null } = params;
    const id = uuidv4();

    const task = {
      id,
      title,
      description,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      priority,
      plantId,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.tasks.set(id, task);
    return task;
  }

  async completeTask(id) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);

    task.completed = true;
    task.completedAt = new Date().toISOString();
    return task;
  }

  async getTasks(options = {}) {
    const { completed, plantId } = options;

    let tasks = Array.from(this.tasks.values());

    if (completed !== undefined) tasks = tasks.filter(t => t.completed === completed);
    if (plantId) tasks = tasks.filter(t => t.plantId === plantId);

    return tasks.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }

  async addJournalEntry(params) {
    const { gardenId, title, content, date = new Date().toISOString() } = params;
    const id = uuidv4();

    const entry = {
      id,
      gardenId,
      title,
      content,
      date: new Date(date).toISOString(),
      createdAt: new Date().toISOString()
    };

    this.journal.set(id, entry);
    return entry;
  }

  async getJournalEntries(gardenId) {
    return Array.from(this.journal.values())
      .filter(e => e.gardenId === gardenId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  getPlantDatabase() {
    return this.plantDatabase;
  }

  async getStats() {
    const plants = Array.from(this.plants.values());
    const needingWater = await this.getPlantsNeedingWater();

    return {
      totalPlants: plants.length,
      gardens: this.gardens.size,
      tasks: this.tasks.size,
      needingWater: needingWater.length,
      byType: this.getPlantsByType()
    };
  }

  getPlantsByType() {
    const plants = Array.from(this.plants.values());
    const byType = {};

    for (const plant of plants) {
      byType[plant.type] = (byType[plant.type] || 0) + 1;
    }

    return byType;
  }

  async savePlant(plant) {
    const filePath = path.join(this.gardenDir, `${plant.id}.json`);
    await fs.writeJson(filePath, plant, { spaces: 2 });
  }

  async exportPlants(format = 'json') {
    const plants = Array.from(this.plants.values());

    if (format === 'json') {
      return JSON.stringify(plants, null, 2);
    }

    return plants;
  }
}

module.exports = GardenEngine;
