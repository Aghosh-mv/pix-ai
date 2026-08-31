const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class VehicleEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.vehicles = new Map();
    this.maintenance = new Map();
    this.fuelLogs = new Map();
    this.vehicleDir = path.join(os.homedir(), '.pix/vehicles');
  }

  async initialize() {
    this.logger.info('Initializing Vehicle Engine...');
    await fs.ensureDir(this.vehicleDir);
    await this.loadVehicles();
    this.logger.info('Vehicle Engine initialized');
  }

  async loadVehicles() {
    try {
      const files = await fs.readdir(this.vehicleDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const vehicle = await fs.readJson(path.join(this.vehicleDir, file));
          this.vehicles.set(vehicle.id, vehicle);
        }
      }
    } catch (e) {}
  }

  async createVehicle(params) {
    const {
      name,
      make,
      model,
      year,
      color = '',
      vin = '',
      licensePlate = '',
      mileage = 0,
      fuelType = 'gasoline',
      tankCapacity = 0,
      notes = '',
      photo = null
    } = params;

    const id = uuidv4();
    const vehicle = {
      id,
      name,
      make,
      model,
      year,
      color,
      vin,
      licensePlate,
      mileage,
      fuelType,
      tankCapacity,
      notes,
      photo,
      purchaseDate: null,
      insuranceExpiry: null,
      registrationExpiry: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.vehicles.set(id, vehicle);
    await this.saveVehicle(vehicle);

    this.logger.info(`Vehicle added: ${year} ${make} ${model}`);
    return vehicle;
  }

  async updateVehicle(id, updates) {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) throw new Error(`Vehicle not found: ${id}`);

    const updated = {
      ...vehicle,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.vehicles.set(id, updated);
    await this.saveVehicle(updated);

    return updated;
  }

  async deleteVehicle(id) {
    this.vehicles.delete(id);
    await fs.remove(path.join(this.vehicleDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getVehicle(id) {
    return this.vehicles.get(id);
  }

  listVehicles() {
    return Array.from(this.vehicles.values());
  }

  async addMaintenanceRecord(params) {
    const {
      vehicleId,
      type,
      date,
      mileage,
      cost = 0,
      provider = '',
      notes = '',
      nextServiceDate = null,
      nextServiceMileage = null
    } = params;

    const id = uuidv4();
    const record = {
      id,
      vehicleId,
      type,
      date: new Date(date).toISOString(),
      mileage,
      cost,
      provider,
      notes,
      nextServiceDate: nextServiceDate ? new Date(nextServiceDate).toISOString() : null,
      nextServiceMileage,
      createdAt: new Date().toISOString()
    };

    this.maintenance.set(id, record);
    return record;
  }

  async getMaintenanceRecords(vehicleId) {
    return Array.from(this.maintenance.values())
      .filter(r => r.vehicleId === vehicleId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async getUpcomingMaintenance() {
    const now = new Date();
    return Array.from(this.maintenance.values())
      .filter(r => r.nextServiceDate && new Date(r.nextServiceDate) > now)
      .sort((a, b) => new Date(a.nextServiceDate) - new Date(b.nextServiceDate));
  }

  async addFuelLog(params) {
    const {
      vehicleId,
      date,
      gallons,
      costPerGallon,
      totalCost,
      mileage,
      fuelType,
      fullTank = true
    } = params;

    const id = uuidv4();
    const log = {
      id,
      vehicleId,
      date: new Date(date).toISOString(),
      gallons,
      costPerGallon,
      totalCost,
      mileage,
      fuelType,
      fullTank,
      mpg: 0,
      createdAt: new Date().toISOString()
    };

    const prevLog = await this.getPreviousFuelLog(vehicleId, date);
    if (prevLog && fullTank && prevLog.fullTank) {
      const milesDriven = mileage - prevLog.mileage;
      log.mpg = Math.round((milesDriven / gallons) * 10) / 10;
    }

    this.fuelLogs.set(id, log);
    return log;
  }

  async getPreviousFuelLog(vehicleId, currentDate) {
    const logs = Array.from(this.fuelLogs.values())
      .filter(l => l.vehicleId === vehicleId && new Date(l.date) < new Date(currentDate))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return logs[0] || null;
  }

  async getFuelLogs(vehicleId) {
    return Array.from(this.fuelLogs.values())
      .filter(l => l.vehicleId === vehicleId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async getFuelStats(vehicleId) {
    const logs = await this.getFuelLogs(vehicleId);
    if (logs.length === 0) return null;

    const totalCost = logs.reduce((sum, l) => sum + l.totalCost, 0);
    const totalGallons = logs.reduce((sum, l) => sum + l.gallons, 0);
    const avgMpg = logs.filter(l => l.mpg > 0).reduce((sum, l) => sum + l.mpg, 0) /
      logs.filter(l => l.mpg > 0).length || 0;

    return {
      totalFillups: logs.length,
      totalCost,
      totalGallons,
      averageMpg: Math.round(avgMpg * 10) / 10,
      averageCostPerGallon: totalCost / totalGallons
    };
  }

  async getVehicleStats() {
    const vehicles = Array.from(this.vehicles.values());
    const totalMaintenance = Array.from(this.maintenance.values())
      .reduce((sum, r) => sum + r.cost, 0);

    return {
      totalVehicles: vehicles.length,
      totalMaintenanceCost: totalMaintenance,
      maintenanceRecords: this.maintenance.size,
      fuelLogs: this.fuelLogs.size
    };
  }

  async saveVehicle(vehicle) {
    const filePath = path.join(this.vehicleDir, `${vehicle.id}.json`);
    await fs.writeJson(filePath, vehicle, { spaces: 2 });
  }

  async exportVehicles(format = 'json') {
    const vehicles = Array.from(this.vehicles.values());

    if (format === 'json') {
      return JSON.stringify(vehicles, null, 2);
    }

    return vehicles;
  }
}

module.exports = VehicleEngine;
