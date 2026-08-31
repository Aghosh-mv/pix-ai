const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ColorPaletteEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.palettes = new Map();
    this.favorites = new Set();
    this.paletteDir = path.join(os.homedir(), '.pix/colors');
  }

  async initialize() {
    this.logger.info('Initializing Color Palette Engine...');
    await fs.ensureDir(this.paletteDir);
    await this.loadPalettes();
    this.loadPresets();
    this.logger.info('Color Palette Engine initialized');
  }

  async loadPalettes() {
    try {
      const files = await fs.readdir(this.paletteDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.paletteDir, file));
          if (data.type === 'palette') {
            this.palettes.set(data.id, data);
            if (data.favorite) this.favorites.add(data.id);
          }
        }
      }
    } catch (e) {}
  }

  loadPresets() {
    this.presetPalettes = [
      {
        id: 'material',
        name: 'Material Design',
        colors: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722']
      },
      {
        id: 'pastel',
        name: 'Pastel Colors',
        colors: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E8BAFF', '#FFB3E6', '#B3FFE0']
      },
      {
        id: 'neon',
        name: 'Neon Colors',
        colors: ['#FF00FF', '#00FFFF', '#FF00AA', '#00FF00', '#FFFF00', '#FF6600', '#0066FF', '#FF0066']
      },
      {
        id: 'earth',
        name: 'Earth Tones',
        colors: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#D2B48C', '#BC8F8F', '#F4A460', '#DAA520']
      },
      {
        id: 'ocean',
        name: 'Ocean Blues',
        colors: ['#001F3F', '#003366', '#004080', '#005599', '#006BB3', '#0080CC', '#0099E6', '#00B3FF']
      }
    ];
  }

  async createPalette(params) {
    const {
      name,
      colors,
      description = '',
      tags = [],
      source = 'custom'
    } = params;

    const id = uuidv4();
    const palette = {
      id,
      name,
      colors,
      description,
      tags,
      source,
      favorite: false,
      usedCount: 0,
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
    this.favorites.delete(id);
    return { success: true };
  }

  async getPalette(id) {
    const palette = this.palettes.get(id);
    if (!palette) throw new Error(`Palette not found: ${id}`);

    palette.usedCount = (palette.usedCount || 0) + 1;
    this.palettes.set(id, palette);

    return palette;
  }

  listPalettes(options = {}) {
    const { favorite, tags, search } = options;
    let palettes = Array.from(this.palettes.values());

    if (favorite !== undefined) palettes = palettes.filter(p => p.favorite === favorite);
    if (tags && tags.length > 0) {
      palettes = palettes.filter(p => tags.some(t => p.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      palettes = palettes.filter(p => p.name.toLowerCase().includes(searchLower));
    }

    return palettes;
  }

  async toggleFavorite(id) {
    const palette = this.palettes.get(id);
    if (!palette) throw new Error(`Palette not found: ${id}`);

    palette.favorite = !palette.favorite;
    this.palettes.set(id, palette);

    if (palette.favorite) this.favorites.add(id);
    else this.favorites.delete(id);

    return palette;
  }

  generateRandomPalette(count = 5) {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const hue = Math.floor(Math.random() * 360);
      const saturation = Math.floor(Math.random() * 30 + 70);
      const lightness = Math.floor(Math.random() * 30 + 40);
      colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    return colors;
  }

  generateComplementary(baseColor) {
    return this.adjustHue(baseColor, 180);
  }

  generateAnalogous(baseColor, count = 5) {
    const colors = [baseColor];
    const step = 30;

    for (let i = 1; i < count; i++) {
      colors.push(this.adjustHue(baseColor, step * i));
      if (colors.length < count) {
        colors.unshift(this.adjustHue(baseColor, -step * i));
      }
    }

    return colors.slice(0, count);
  }

  generateTriadic(baseColor) {
    return [
      baseColor,
      this.adjustHue(baseColor, 120),
      this.adjustHue(baseColor, 240)
    ];
  }

  generateSplitComplementary(baseColor) {
    return [
      baseColor,
      this.adjustHue(baseColor, 150),
      this.adjustHue(baseColor, 210)
    ];
  }

  adjustHue(color, degrees) {
    const rgb = this.hexToRgb(color);
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.h = (hsl.h + degrees) % 360;
    if (hsl.h < 0) hsl.h += 360;
    const newRgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
    return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
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

  async getColorStats() {
    const palettes = Array.from(this.palettes.values());

    return {
      total: palettes.length,
      favorites: palettes.filter(p => p.favorite).length,
      presets: this.presetPalettes.length,
      totalColors: palettes.reduce((sum, p) => sum + p.colors.length, 0)
    };
  }

  getPresets() {
    return this.presetPalettes;
  }

  async exportColors(format = 'json') {
    const data = {
      palettes: Array.from(this.palettes.values()),
      presets: this.presetPalettes
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

module.exports = ColorPaletteEngine;
