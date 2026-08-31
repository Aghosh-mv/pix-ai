const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class WeatherEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.locations = new Map();
    this.forecasts = new Map();
    this.weatherDir = path.join(os.homedir(), '.pix/weather');
  }

  async initialize() {
    this.logger.info('Initializing Weather Engine...');
    await fs.ensureDir(this.weatherDir);
    await this.loadLocations();
    this.loadDefaultLocations();
    this.logger.info('Weather Engine initialized');
  }

  async loadLocations() {
    try {
      const files = await fs.readdir(this.weatherDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const location = await fs.readJson(path.join(this.weatherDir, file));
          this.locations.set(location.id, location);
        }
      }
    } catch (e) {}
  }

  loadDefaultLocations() {
    const defaults = [
      { id: 'home', name: 'Home', latitude: 0, longitude: 0, isDefault: true },
      { id: 'work', name: 'Work', latitude: 0, longitude: 0, isDefault: false }
    ];

    defaults.forEach(loc => {
      if (!this.locations.has(loc.id)) {
        this.locations.set(loc.id, {
          ...loc,
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  async addLocation(params) {
    const {
      name,
      latitude,
      longitude,
      altitude = 0,
      timezone = 'UTC',
      isDefault = false
    } = params;

    const id = uuidv4();
    const location = {
      id,
      name,
      latitude,
      longitude,
      altitude,
      timezone,
      isDefault,
      createdAt: new Date().toISOString()
    };

    this.locations.set(id, location);
    return location;
  }

  async updateLocation(id, updates) {
    const location = this.locations.get(id);
    if (!location) throw new Error(`Location not found: ${id}`);

    const updated = { ...location, ...updates };
    this.locations.set(id, updated);
    return updated;
  }

  async deleteLocation(id) {
    this.locations.delete(id);
    return { success: true };
  }

  listLocations() {
    return Array.from(this.locations.values());
  }

  async getCurrentWeather(locationId) {
    const location = this.locations.get(locationId);
    if (!location) throw new Error(`Location not found: ${locationId}`);

    const weather = {
      location: location.name,
      temperature: Math.round(Math.random() * 30 + 5),
      feelsLike: Math.round(Math.random() * 30 + 5),
      humidity: Math.round(Math.random() * 60 + 30),
      windSpeed: Math.round(Math.random() * 20),
      windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
      pressure: Math.round(1000 + Math.random() * 30),
      visibility: Math.round(Math.random() * 10 + 5),
      uvIndex: Math.round(Math.random() * 10),
      condition: ['Sunny', 'Cloudy', 'Partly Cloudy', 'Rainy', 'Stormy'][Math.floor(Math.random() * 5)],
      icon: '☀️',
      lastUpdated: new Date().toISOString()
    };

    return weather;
  }

  async getForecast(locationId, days = 5) {
    const location = this.locations.get(locationId);
    if (!location) throw new Error(`Location not found: ${locationId}`);

    const forecast = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      forecast.push({
        date: date.toISOString().split('T')[0],
        day: date.toLocaleDateString('en-US', { weekday: 'long' }),
        high: Math.round(Math.random() * 15 + 20),
        low: Math.round(Math.random() * 10 + 5),
        condition: ['Sunny', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 3)],
        chanceOfRain: Math.round(Math.random() * 100),
        humidity: Math.round(Math.random() * 60 + 30),
        windSpeed: Math.round(Math.random() * 20)
      });
    }

    return forecast;
  }

  async getHourlyForecast(locationId, hours = 24) {
    const location = this.locations.get(locationId);
    if (!location) throw new Error(`Location not found: ${locationId}`);

    const forecast = [];
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const time = new Date(now);
      time.setHours(time.getHours() + i);

      forecast.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        temperature: Math.round(Math.random() * 10 + 15),
        condition: ['Sunny', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 3)],
        chanceOfRain: Math.round(Math.random() * 100),
        humidity: Math.round(Math.random() * 60 + 30)
      });
    }

    return forecast;
  }

  async getWeatherAlerts(locationId) {
    return [
      {
        id: uuidv4(),
        type: 'warning',
        title: 'High Wind Advisory',
        description: 'Strong winds expected through tomorrow',
        severity: 'moderate',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 86400000).toISOString()
      }
    ];
  }

  async getSunTimes(locationId) {
    return {
      sunrise: '06:32 AM',
      sunset: '07:45 PM',
      dawn: '06:05 AM',
      dusk: '08:12 PM',
      dayLength: '13h 13m'
    };
  }

  async compareLocations(locationIds) {
    const results = [];

    for (const id of locationIds) {
      const weather = await this.getCurrentWeather(id);
      results.push(weather);
    }

    return results;
  }

  async getStats() {
    return {
      locations: this.locations.size,
      forecasts: this.forecasts.size
    };
  }

  async saveLocation(location) {
    const filePath = path.join(this.weatherDir, `${location.id}.json`);
    await fs.writeJson(filePath, location, { spaces: 2 });
  }

  async exportLocations(format = 'json') {
    const locations = Array.from(this.locations.values());

    if (format === 'json') {
      return JSON.stringify(locations, null, 2);
    }

    return locations;
  }
}

module.exports = WeatherEngine;
