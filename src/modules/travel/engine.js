const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class TravelEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.trips = new Map();
    this.destinations = new Map();
    this.packingLists = new Map();
    this.travelDir = path.join(os.homedir(), '.pix/travel');
  }

  async initialize() {
    this.logger.info('Initializing Travel Engine...');
    await fs.ensureDir(this.travelDir);
    await this.loadTrips();
    this.loadDefaultPackingItems();
    this.logger.info('Travel Engine initialized');
  }

  async loadTrips() {
    try {
      const files = await fs.readdir(this.travelDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const trip = await fs.readJson(path.join(this.travelDir, file));
          this.trips.set(trip.id, trip);
        }
      }
    } catch (e) {}
  }

  loadDefaultPackingItems() {
    this.defaultPackingItems = [
      { category: 'clothing', items: ['T-shirts', 'Pants', 'Underwear', 'Socks', 'Jacket', 'Sleepwear', 'Swimsuit'] },
      { category: 'toiletries', items: ['Toothbrush', 'Toothpaste', 'Shampoo', 'Deodorant', 'Sunscreen', 'Medications'] },
      { category: 'electronics', items: ['Phone charger', 'Power bank', 'Adapter', 'Headphones', 'Camera'] },
      { category: 'documents', items: ['Passport', 'ID', 'Travel insurance', 'Tickets', 'Hotel reservations'] },
      { category: 'miscellaneous', items: ['Money', 'Keys', 'Snacks', 'Water bottle', 'Book']
      }
    ];
  }

  async createTrip(params) {
    const {
      name,
      destination,
      startDate,
      endDate,
      description = '',
      budget = 0,
      travelers = 1,
      accommodation = '',
      transportation = '',
      activities = [],
      notes = ''
    } = params;

    const id = uuidv4();
    const trip = {
      id,
      name,
      destination,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      description,
      budget,
      spent: 0,
      travelers,
      accommodation,
      transportation,
      activities,
      notes,
      status: 'planned',
      documents: [],
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.trips.set(id, trip);
    await this.saveTrip(trip);

    this.logger.info(`Trip created: ${name}`);
    return trip;
  }

  async updateTrip(id, updates) {
    const trip = this.trips.get(id);
    if (!trip) throw new Error(`Trip not found: ${id}`);

    const updated = {
      ...trip,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.trips.set(id, updated);
    await this.saveTrip(updated);

    return updated;
  }

  async deleteTrip(id) {
    this.trips.delete(id);
    await fs.remove(path.join(this.travelDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getTrip(id) {
    return this.trips.get(id);
  }

  listTrips(options = {}) {
    const { status, destination, limit = 50 } = options;

    let trips = Array.from(this.trips.values());

    if (status) trips = trips.filter(t => t.status === status);
    if (destination) {
      const destLower = destination.toLowerCase();
      trips = trips.filter(t => t.destination.toLowerCase().includes(destLower));
    }

    trips.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    return trips.slice(0, limit);
  }

  async getUpcomingTrips() {
    const now = new Date();
    return Array.from(this.trips.values())
      .filter(t => new Date(t.startDate) > now && t.status !== 'cancelled')
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  }

  async getPastTrips() {
    const now = new Date();
    return Array.from(this.trips.values())
      .filter(t => new Date(t.endDate) < now)
      .sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
  }

  async createPackingList(tripId, params = {}) {
    const trip = this.trips.get(tripId);
    if (!trip) throw new Error(`Trip not found: ${tripId}`);

    const { customItems = [] } = params;

    const items = [];

    for (const category of this.defaultPackingItems) {
      for (const item of category.items) {
        items.push({
          id: uuidv4(),
          name: item,
          category: category.category,
          packed: false,
          quantity: 1
        });
      }
    }

    for (const item of customItems) {
      items.push({
        id: uuidv4(),
        name: item.name,
        category: item.category || 'miscellaneous',
        packed: false,
        quantity: item.quantity || 1
      });
    }

    const packingList = {
      id: uuidv4(),
      tripId,
      items,
      createdAt: new Date().toISOString()
    };

    this.packingLists.set(packingList.id, packingList);
    return packingList;
  }

  async togglePackedItem(packingListId, itemId) {
    const packingList = this.packingLists.get(packingListId);
    if (!packingList) throw new Error(`Packing list not found: ${packingListId}`);

    const item = packingList.items.find(i => i.id === itemId);
    if (item) {
      item.packed = !item.packed;
    }

    return packingList;
  }

  async getPackingList(tripId) {
    for (const [, list] of this.packingLists) {
      if (list.tripId === tripId) {
        return list;
      }
    }
    return null;
  }

  async addExpense(tripId, params) {
    const trip = this.trips.get(tripId);
    if (!trip) throw new Error(`Trip not found: ${tripId}`);

    const { amount, category, description, date = new Date().toISOString() } = params;

    if (!trip.expenses) trip.expenses = [];

    trip.expenses.push({
      id: uuidv4(),
      amount,
      category,
      description,
      date: new Date(date).toISOString()
    });

    trip.spent = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
    trip.updatedAt = new Date().toISOString();

    this.trips.set(tripId, trip);
    await this.saveTrip(trip);

    return trip;
  }

  async addActivity(tripId, params) {
    const trip = this.trips.get(tripId);
    if (!trip) throw new Error(`Trip not found: ${tripId}`);

    const { name, date, time, location, cost = 0, notes = '' } = params;

    trip.activities.push({
      id: uuidv4(),
      name,
      date: date ? new Date(date).toISOString() : null,
      time,
      location,
      cost,
      notes
    });

    trip.updatedAt = new Date().toISOString();
    this.trips.set(tripId, trip);
    await this.saveTrip(trip);

    return trip;
  }

  async addDocument(tripId, params) {
    const trip = this.trips.get(tripId);
    if (!trip) throw new Error(`Trip not found: ${tripId}`);

    const { name, type, filePath } = params;

    trip.documents.push({
      id: uuidv4(),
      name,
      type,
      filePath,
      addedAt: new Date().toISOString()
    });

    trip.updatedAt = new Date().toISOString();
    this.trips.set(tripId, trip);
    await this.saveTrip(trip);

    return trip;
  }

  async getTripStats(tripId) {
    const trip = this.trips.get(tripId);
    if (!trip) throw new Error(`Trip not found: ${tripId}`);

    const duration = Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24));

    return {
      duration,
      budget: trip.budget,
      spent: trip.spent,
      remaining: trip.budget - trip.spent,
      activities: trip.activities?.length || 0,
      documents: trip.documents?.length || 0,
      percentBudgetUsed: trip.budget > 0 ? Math.round((trip.spent / trip.budget) * 100) : 0
    };
  }

  async getOverallStats() {
    const trips = Array.from(this.trips.values());
    const totalSpent = trips.reduce((sum, t) => sum + (t.spent || 0), 0);
    const totalBudget = trips.reduce((sum, t) => sum + (t.budget || 0), 0);

    return {
      totalTrips: trips.length,
      upcoming: trips.filter(t => new Date(t.startDate) > new Date()).length,
      completed: trips.filter(t => t.status === 'completed').length,
      totalSpent,
      totalBudget,
      destinations: new Set(trips.map(t => t.destination)).size
    };
  }

  async saveTrip(trip) {
    const filePath = path.join(this.travelDir, `${trip.id}.json`);
    await fs.writeJson(filePath, trip, { spaces: 2 });
  }

  async exportTrips(format = 'json') {
    const trips = Array.from(this.trips.values());

    if (format === 'json') {
      return JSON.stringify(trips, null, 2);
    }

    return trips;
  }
}

module.exports = TravelEngine;
