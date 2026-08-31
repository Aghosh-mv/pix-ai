const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class CalculatorEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.history = new Map();
    this.memory = 0;
    this.calculatorDir = path.join(os.homedir(), '.pix/calculator');
  }

  async initialize() {
    this.logger.info('Initializing Calculator Engine...');
    await fs.ensureDir(this.calculatorDir);
    await this.loadHistory();
    this.logger.info('Calculator Engine initialized');
  }

  async loadHistory() {
    try {
      const files = await fs.readdir(this.calculatorDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.calculatorDir, file));
          if (data.type === 'calculation') this.history.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  async calculate(expression) {
    try {
      let result;

      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      result = Function('"use strict"; return (' + sanitized + ')')();

      const id = uuidv4();
      const calculation = {
        id,
        expression,
        result,
        type: 'calculation',
        timestamp: new Date().toISOString()
      };

      this.history.set(id, calculation);
      return { expression, result };
    } catch (error) {
      throw new Error(`Invalid expression: ${expression}`);
    }
  }

  async add(a, b) {
    const result = a + b;
    await this.saveCalculation(`${a} + ${b}`, result);
    return result;
  }

  async subtract(a, b) {
    const result = a - b;
    await this.saveCalculation(`${a} - ${b}`, result);
    return result;
  }

  async multiply(a, b) {
    const result = a * b;
    await this.saveCalculation(`${a} × ${b}`, result);
    return result;
  }

  async divide(a, b) {
    if (b === 0) throw new Error('Division by zero');
    const result = a / b;
    await this.saveCalculation(`${a} ÷ ${b}`, result);
    return result;
  }

  async power(base, exponent) {
    const result = Math.pow(base, exponent);
    await this.saveCalculation(`${base} ^ ${exponent}`, result);
    return result;
  }

  async squareRoot(value) {
    if (value < 0) throw new Error('Square root of negative number');
    const result = Math.sqrt(value);
    await this.saveCalculation(`√${value}`, result);
    return result;
  }

  async percentage(value, percent) {
    const result = (value * percent) / 100;
    await this.saveCalculation(`${percent}% of ${value}`, result);
    return result;
  }

  async absolute(value) {
    const result = Math.abs(value);
    await this.saveCalculation(`|${value}|`, result);
    return result;
  }

  async sin(value) {
    const result = Math.sin(value * Math.PI / 180);
    await this.saveCalculation(`sin(${value}°)`, result);
    return result;
  }

  async cos(value) {
    const result = Math.cos(value * Math.PI / 180);
    await this.saveCalculation(`cos(${value}°)`, result);
    return result;
  }

  async tan(value) {
    const result = Math.tan(value * Math.PI / 180);
    await this.saveCalculation(`tan(${value}°)`, result);
    return result;
  }

  async log(value) {
    const result = Math.log10(value);
    await this.saveCalculation(`log(${value})`, result);
    return result;
  }

  async ln(value) {
    const result = Math.log(value);
    await this.saveCalculation(`ln(${value})`, result);
    return result;
  }

  async factorial(value) {
    if (value < 0 || !Number.isInteger(value)) {
      throw new Error('Factorial only defined for non-negative integers');
    }
    let result = 1;
    for (let i = 2; i <= value; i++) {
      result *= i;
    }
    await this.saveCalculation(`${value}!`, result);
    return result;
  }

  async saveCalculation(expression, result) {
    const id = uuidv4();
    const calculation = {
      id,
      expression,
      result,
      type: 'calculation',
      timestamp: new Date().toISOString()
    };

    this.history.set(id, calculation);
    return calculation;
  }

  setMemory(value) {
    this.memory = value;
  }

  getMemory() {
    return this.memory;
  }

  clearMemory() {
    this.memory = 0;
  }

  addToMemory(value) {
    this.memory += value;
  }

  subtractFromMemory(value) {
    this.memory -= value;
  }

  getHistory(limit = 50) {
    return Array.from(this.history.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  clearHistory() {
    this.history.clear();
    return { success: true };
  }

  async convertUnit(value, from, to) {
    const conversions = {
      'mm-cm': 0.1,
      'cm-mm': 10,
      'cm-m': 0.01,
      'm-cm': 100,
      'm-km': 0.001,
      'km-m': 1000,
      'in-cm': 2.54,
      'cm-in': 0.393701,
      'ft-m': 0.3048,
      'm-ft': 3.28084,
      'mi-km': 1.60934,
      'km-mi': 0.621371,
      'oz-g': 28.3495,
      'g-oz': 0.035274,
      'lb-kg': 0.453592,
      'kg-lb': 2.20462,
      'gal-l': 3.78541,
      'l-gal': 0.264172,
      'f-c': (v) => (v - 32) * 5/9,
      'c-f': (v) => v * 9/5 + 32,
      'k-c': (v) => v - 273.15,
      'c-k': (v) => v + 273.15
    };

    const key = `${from}-${to}`;
    const conversion = conversions[key];

    if (!conversion) throw new Error(`Conversion from ${from} to ${to} not supported`);

    let result;
    if (typeof conversion === 'function') {
      result = conversion(value);
    } else {
      result = value * conversion;
    }

    await this.saveCalculation(`${value} ${from} = ? ${to}`, result);
    return { from, to, input: value, result };
  }

  getConversions() {
    return [
      'mm', 'cm', 'm', 'km', 'in', 'ft', 'mi',
      'oz', 'g', 'lb', 'kg',
      'gal', 'l',
      'f', 'c', 'k'
    ];
  }

  async getStats() {
    return {
      historySize: this.history.size,
      memory: this.memory,
      recentCalculations: this.getHistory(5)
    };
  }

  async exportHistory(format = 'json') {
    const history = Array.from(this.history.values());

    if (format === 'json') {
      return JSON.stringify(history, null, 2);
    }

    return history;
  }
}

module.exports = CalculatorEngine;
