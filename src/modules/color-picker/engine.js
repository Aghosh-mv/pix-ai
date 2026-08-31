const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ColorPickerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.palettes = new Map();
    this.history = new Map();
    this.colorDir = path.join(os.homedir(), '.pix/color-picker');
  }

  async initialize() {
    this.logger.info('Initializing Color Picker Engine...');
    await fs.ensureDir(this.colorDir);
    await this.loadColorPicker();
    this.loadPresets();
    this.loadHarmonies();
    this.logger.info('Color Picker Engine initialized');
  }

  async loadColorPicker() {
    try {
      const files = await fs.readdir(this.colorDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.colorDir, file));
          if (data.type === 'palette') this.palettes.set(data.id, data);
          else if (data.type === 'history') this.history.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadPresets() {
    this.presetColors = [
      { name: 'Red', hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } },
      { name: 'Green', hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } },
      { name: 'Blue', hex: '#0000FF', rgb: { r: 0, g: 0, b: 255 } },
      { name: 'Yellow', hex: '#FFFF00', rgb: { r: 255, g: 255, b: 0 } },
      { name: 'Cyan', hex: '#00FFFF', rgb: { r: 0, g: 255, b: 255 } },
      { name: 'Magenta', hex: '#FF00FF', rgb: { r: 255, g: 0, b: 255 } },
      { name: 'White', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } },
      { name: 'Black', hex: '#000000', rgb: { r: 0, g: 0, b: 0 } },
      { name: 'Orange', hex: '#FFA500', rgb: { r: 255, g: 165, b: 0 } },
      { name: 'Purple', hex: '#800080', rgb: { r: 128, g: 0, b: 128 } },
      { name: 'Pink', hex: '#FFC0CB', rgb: { r: 255, g: 192, b: 203 } },
      { name: 'Brown', hex: '#A52A2A', rgb: { r: 165, g: 42, b: 42 } }
    ];
  }

  loadHarmonies() {
    this.harmonyTypes = [
      { id: 'complementary', name: 'Complementary', description: 'Colors opposite on the color wheel', icon: '🔄' },
      { id: 'analogous', name: 'Analogous', description: 'Colors adjacent on the color wheel', icon: '➡️' },
      { id: 'triadic', name: 'Triadic', description: 'Three colors equally spaced', icon: '🔺' },
      { id: 'split-complementary', name: 'Split Complementary', description: 'Base color plus two adjacent to complement', icon: '🔱' },
      { id: 'tetradic', name: 'Tetradic', description: 'Four colors forming a rectangle', icon: '⬛' },
      { id: 'square', name: 'Square', description: 'Four colors equally spaced', icon: '⬜' }
    ];
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  async getColorInfo(hex) {
    const rgb = this.hexToRgb(hex);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

    const id = uuidv4();
    const colorInfo = {
      id,
      hex,
      rgb,
      hsl,
      type: 'history',
      timestamp: new Date().toISOString()
    };

    this.history.set(id, colorInfo);

    return {
      hex,
      rgb,
      hsl,
      name: this.getColorName(hex),
      luminance: (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255,
      isLight: (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) > 186
    };
  }

  getColorName(hex) {
    const colorNames = {
      '#FF0000': 'Red', '#00FF00': 'Green', '#0000FF': 'Blue',
      '#FFFF00': 'Yellow', '#00FFFF': 'Cyan', '#FF00FF': 'Magenta',
      '#FFFFFF': 'White', '#000000': 'Black', '#FFA500': 'Orange',
      '#800080': 'Purple', '#FFC0CB': 'Pink', '#A52A2A': 'Brown'
    };

    return colorNames[hex.toUpperCase()] || 'Custom Color';
  }

  generateComplementary(hex) {
    const rgb = this.hexToRgb(hex);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const compHue = (hsl.h + 180) % 360;
    const compRgb = this.hslToRgb(compHue, hsl.s, hsl.l);

    return [
      hex,
      this.rgbToHex(compRgb.r, compRgb.g, compRgb.b)
    ];
  }

  generateAnalogous(hex, count = 5) {
    const rgb = this.hexToRgb(hex);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colors = [];
    const step = 30;

    for (let i = -Math.floor(count / 2); i <= Math.floor(count / 2); i++) {
      const hue = (hsl.h + step * i + 360) % 360;
      const newRgb = this.hslToRgb(hue, hsl.s, hsl.l);
      colors.push(this.rgbToHex(newRgb.r, newRgb.g, newRgb.b));
    }

    return colors;
  }

  generateTriadic(hex) {
    const rgb = this.hexToRgb(hex);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

    return [0, 120, 240].map(offset => {
      const hue = (hsl.h + offset) % 360;
      const newRgb = this.hslToRgb(hue, hsl.s, hsl.l);
      return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    });
  }

  generateSplitComplementary(hex) {
    const rgb = this.hexToRgb(hex);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

    return [0, 150, 210].map(offset => {
      const hue = (hsl.h + offset) % 360;
      const newRgb = this.hslToRgb(hue, hsl.s, hsl.l);
      return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    });
  }

  async createPalette(params) {
    const { name, colors, description = '', tags = [] } = params;

    const id = uuidv4();
    const palette = {
      id,
      name,
      colors,
      description,
      tags,
      type: 'palette',
      createdAt: new Date().toISOString()
    };

    this.palettes.set(id, palette);
    return palette;
  }

  async updatePalette(id, updates) {
    const palette = this.palettes.get(id);
    if (!palette) throw new Error(`Palette not found: ${id}`);

    const updated = { ...palette, ...updates };
    this.palettes.set(id, updated);
    return updated;
  }

  async deletePalette(id) {
    this.palettes.delete(id);
    return { success: true };
  }

  listPalettes() {
    return Array.from(this.palettes.values());
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

  getPresetColors() {
    return this.presetColors;
  }

  getHarmonies() {
    return this.harmonyTypes;
  }

  async getStats() {
    return {
      palettes: this.palettes.size,
      history: this.history.size,
      presets: this.presetColors.length,
      harmonies: this.harmonyTypes.length
    };
  }

  async exportColors(format = 'json') {
    const data = {
      palettes: Array.from(this.palettes.values()),
      history: Array.from(this.history.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'css') {
      let css = ':root {\n';
      for (const palette of this.palettes.values()) {
        palette.colors.forEach((color, i) => {
          css += `  --${palette.name.toLowerCase().replace(/\s+/g, '-')}-${i + 1}: ${color};\n`;
        });
      }
      css += '}';
      return css;
    }

    return data;
  }
}

module.exports = ColorPickerEngine;
