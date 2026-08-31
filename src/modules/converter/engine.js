const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class UnitConverterEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.conversions = new Map();
    this.favorites = new Set();
    this.converterDir = path.join(os.homedir(), '.pix/converter');
  }

  async initialize() {
    this.logger.info('Initializing Unit Converter Engine...');
    await fs.ensureDir(this.converterDir);
    await this.loadConversions();
    this.loadCategories();
    this.loadCommonConversions();
    this.logger.info('Unit Converter Engine initialized');
  }

  async loadConversions() {
    try {
      const files = await fs.readdir(this.converterDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.converterDir, file));
          if (data.type === 'conversion') {
            this.conversions.set(data.id, data);
            if (data.favorite) this.favorites.add(data.id);
          }
        }
      }
    } catch (e) {}
  }

  loadCategories() {
    this.categories = [
      { id: 'length', name: 'Length', icon: '📏', units: ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'] },
      { id: 'weight', name: 'Weight', icon: '⚖️', units: ['mg', 'g', 'kg', 'oz', 'lb', 't'] },
      { id: 'temperature', name: 'Temperature', icon: '🌡️', units: ['c', 'f', 'k'] },
      { id: 'volume', name: 'Volume', icon: '🧪', units: ['ml', 'l', 'gal', 'qt', 'pt', 'cup', 'fl oz'] },
      { id: 'area', name: 'Area', icon: '📐', units: ['mm²', 'cm²', 'm²', 'km²', 'in²', 'ft²', 'yd²', 'mi²'] },
      { id: 'speed', name: 'Speed', icon: '🏃', units: ['m/s', 'km/h', 'mph', 'knot'] },
      { id: 'time', name: 'Time', icon: '⏱️', units: ['ms', 's', 'min', 'hr', 'day', 'week', 'month', 'year'] },
      { id: 'digital', name: 'Digital Storage', icon: '💾', units: ['bit', 'byte', 'kb', 'mb', 'gb', 'tb', 'pb'] }
    ];
  }

  loadCommonConversions() {
    this.commonConversions = [
      { id: 'length-m-ft', category: 'length', from: 'm', to: 'ft', factor: 3.28084 },
      { id: 'length-km-mi', category: 'length', from: 'km', to: 'mi', factor: 0.621371 },
      { id: 'length-cm-in', category: 'length', from: 'cm', to: 'in', factor: 0.393701 },
      { id: 'weight-kg-lb', category: 'weight', from: 'kg', to: 'lb', factor: 2.20462 },
      { id: 'weight-g-oz', category: 'weight', from: 'g', to: 'oz', factor: 0.035274 },
      { id: 'volume-l-gal', category: 'volume', from: 'l', to: 'gal', factor: 0.264172 },
      { id: 'speed-kmh-mph', category: 'speed', from: 'km/h', to: 'mph', factor: 0.621371 },
      { id: 'digital-mb-gb', category: 'digital', from: 'mb', to: 'gb', factor: 0.001 },
      { id: 'digital-gb-tb', category: 'digital', from: 'gb', to: 'tb', factor: 0.001 }
    ];
  }

  async convert(params) {
    const { value, from, to, category } = params;

    if (category === 'temperature') {
      return this.convertTemperature(value, from, to);
    }

    const conversionKey = `${from}-${to}`;
    let factor = this.findConversionFactor(from, to);

    if (!factor) {
      throw new Error(`Conversion from ${from} to ${to} not supported`);
    }

    const result = value * factor;

    await this.saveConversion({
      value,
      from,
      to,
      result,
      category
    });

    return { value, from, to, result, factor };
  }

  convertTemperature(value, from, to) {
    let celsius;

    switch (from.toLowerCase()) {
      case 'c': celsius = value; break;
      case 'f': celsius = (value - 32) * 5/9; break;
      case 'k': celsius = value - 273.15; break;
      default: throw new Error(`Unknown temperature unit: ${from}`);
    }

    let result;
    switch (to.toLowerCase()) {
      case 'c': result = celsius; break;
      case 'f': result = celsius * 9/5 + 32; break;
      case 'k': result = celsius + 273.15; break;
      default: throw new Error(`Unknown temperature unit: ${to}`);
    }

    return { value, from, to, result };
  }

  findConversionFactor(from, to) {
    const factors = {
      'mm-cm': 0.1, 'cm-mm': 10,
      'cm-m': 0.01, 'm-cm': 100,
      'm-km': 0.001, 'km-m': 1000,
      'in-cm': 2.54, 'cm-in': 0.393701,
      'ft-m': 0.3048, 'm-ft': 3.28084,
      'yd-m': 0.9144, 'm-yd': 1.09361,
      'mi-km': 1.60934, 'km-mi': 0.621371,
      'mg-g': 0.001, 'g-mg': 1000,
      'g-kg': 0.001, 'kg-g': 1000,
      'oz-g': 28.3495, 'g-oz': 0.035274,
      'lb-kg': 0.453592, 'kg-lb': 2.20462,
      't-kg': 1000, 'kg-t': 0.001,
      'ml-l': 0.001, 'l-ml': 1000,
      'l-gal': 0.264172, 'gal-l': 3.78541,
      'l-qt': 1.05669, 'qt-l': 0.946353,
      'l-pt': 2.11338, 'pt-l': 0.473176,
      'l-cup': 4.22675, 'cup-l': 0.236588,
      'l-floz': 33.814, 'floz-l': 0.0295735,
      'mm2-cm2': 0.01, 'cm2-mm2': 100,
      'cm2-m2': 0.0001, 'm2-cm2': 10000,
      'm2-km2': 0.000001, 'km2-m2': 1000000,
      'in2-cm2': 6.4516, 'cm2-in2': 0.155,
      'ft2-m2': 0.092903, 'm2-ft2': 10.7639,
      'yd2-m2': 0.836127, 'm2-yd2': 1.19599,
      'mi2-km2': 2.58999, 'km2-mi2': 0.386102,
      'ms-s': 0.001, 's-ms': 1000,
      's-min': 0.016667, 'min-s': 60,
      'min-hr': 0.016667, 'hr-min': 60,
      'hr-day': 0.041667, 'day-hr': 24,
      'day-week': 0.142857, 'week-day': 7,
      'bit-byte': 0.125, 'byte-bit': 8,
      'byte-kb': 0.001, 'kb-byte': 1000,
      'kb-mb': 0.001, 'mb-kb': 1000,
      'mb-gb': 0.001, 'gb-mb': 1000,
      'gb-tb': 0.001, 'tb-gb': 1000,
      'tb-pb': 0.001, 'pb-tb': 1000,
      'm/s-km/h': 3.6, 'km/h-m/s': 0.277778,
      'm/s-mph': 2.23694, 'mph-m/s': 0.44704,
      'km/h-mph': 0.621371, 'mph-km/h': 1.60934,
      'knot-m/s': 0.514444, 'm/s-knot': 1.94384,
      'knot-km/h': 1.852, 'km/h-knot': 0.539957,
      'knot-mph': 1.15078, 'mph-knot': 0.868976
    };

    return factors[`${from}-${to}`] || null;
  }

  async saveConversion(data) {
    const id = uuidv4();
    const conversion = {
      id,
      ...data,
      type: 'conversion',
      timestamp: new Date().toISOString()
    };

    this.conversions.set(id, conversion);
    return conversion;
  }

  async toggleFavorite(id) {
    const conversion = this.conversions.get(id);
    if (!conversion) throw new Error(`Conversion not found: ${id}`);

    conversion.favorite = !conversion.favorite;
    this.conversions.set(id, conversion);

    if (conversion.favorite) this.favorites.add(id);
    else this.favorites.delete(id);

    return conversion;
  }

  getHistory(limit = 50) {
    return Array.from(this.conversions.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  clearHistory() {
    this.conversions.clear();
    return { success: true };
  }

  getCategories() {
    return this.categories;
  }

  getCategory(id) {
    return this.categories.find(c => c.id === id);
  }

  getCommonConversions() {
    return this.commonConversions;
  }

  async getStats() {
    return {
      totalConversions: this.conversions.size,
      favorites: this.favorites.size,
      categories: this.categories.length,
      recentConversions: this.getHistory(5)
    };
  }

  async exportConversions(format = 'json') {
    const conversions = Array.from(this.conversions.values());

    if (format === 'json') {
      return JSON.stringify(conversions, null, 2);
    }

    return conversions;
  }
}

module.exports = UnitConverterEngine;
