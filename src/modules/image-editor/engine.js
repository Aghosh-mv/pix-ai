const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ImageEditorEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.projects = new Map();
    this.filters = new Map();
    this.imageDir = path.join(os.homedir(), '.pix/image-editor');
  }

  async initialize() {
    this.logger.info('Initializing Image Editor Engine...');
    await fs.ensureDir(this.imageDir);
    await this.loadProjects();
    this.loadFilters();
    this.loadPresets();
    this.logger.info('Image Editor Engine initialized');
  }

  async loadProjects() {
    try {
      const files = await fs.readdir(this.imageDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.imageDir, file));
          if (data.type === 'project') this.projects.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadFilters() {
    this.filterTypes = [
      { id: 'brightness', name: 'Brightness', min: -100, max: 100, default: 0 },
      { id: 'contrast', name: 'Contrast', min: -100, max: 100, default: 0 },
      { id: 'saturation', name: 'Saturation', min: -100, max: 100, default: 0 },
      { id: 'hue', name: 'Hue Rotate', min: 0, max: 360, default: 0 },
      { id: 'blur', name: 'Blur', min: 0, max: 20, default: 0 },
      { id: 'sharpen', name: 'Sharpen', min: 0, max: 100, default: 0 },
      { id: 'grayscale', name: 'Grayscale', min: 0, max: 100, default: 0 },
      { id: 'sepia', name: 'Sepia', min: 0, max: 100, default: 0 },
      { id: 'invert', name: 'Invert', min: 0, max: 100, default: 0 },
      { id: 'opacity', name: 'Opacity', min: 0, max: 100, default: 100 }
    ];
  }

  loadPresets() {
    this.presetFilters = [
      {
        id: 'vintage',
        name: 'Vintage',
        icon: '📷',
        settings: { brightness: 10, contrast: 15, saturation: -30, sepia: 40 }
      },
      {
        id: 'dramatic',
        name: 'Dramatic',
        icon: '🎭',
        settings: { brightness: -10, contrast: 50, saturation: -20 }
      },
      {
        id: 'warm',
        name: 'Warm',
        icon: '☀️',
        settings: { brightness: 5, saturation: 20, hue: 10 }
      },
      {
        id: 'cool',
        name: 'Cool',
        icon: '❄️',
        settings: { brightness: 5, saturation: 10, hue: 180 }
      },
      {
        id: 'blackwhite',
        name: 'Black & White',
        icon: '⚫',
        settings: { grayscale: 100, contrast: 20 }
      },
      {
        id: 'retro',
        name: 'Retro',
        icon: '🎞️',
        settings: { brightness: 10, contrast: -10, saturation: -40, sepia: 20 }
      }
    ];
  }

  async createProject(params) {
    const {
      name,
      imagePath = null,
      width = 800,
      height = 600,
      layers = []
    } = params;

    const id = uuidv4();
    const project = {
      id,
      name,
      imagePath,
      width,
      height,
      layers: layers.length > 0 ? layers : [{
        id: uuidv4(),
        name: 'Background',
        visible: true,
        opacity: 100,
        filters: {},
        type: 'layer',
        createdAt: new Date().toISOString()
      }],
      history: [],
      type: 'project',
      createdAt: new Date().toISOString()
    };

    this.projects.set(id, project);
    return project;
  }

  async updateProject(id, updates) {
    const project = this.projects.get(id);
    if (!project) throw new Error(`Project not found: ${id}`);

    const updated = { ...project, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id) {
    this.projects.delete(id);
    return { success: true };
  }

  async getProject(id) {
    return this.projects.get(id);
  }

  listProjects() {
    return Array.from(this.projects.values());
  }

  async addLayer(params) {
    const { projectId, name, visible = true, opacity = 100 } = params;
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const layer = {
      id: uuidv4(),
      name,
      visible,
      opacity,
      filters: {},
      type: 'layer',
      createdAt: new Date().toISOString()
    };

    project.layers.push(layer);
    this.projects.set(projectId, project);
    return layer;
  }

  async updateLayer(projectId, layerId, updates) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const layerIndex = project.layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) throw new Error(`Layer not found: ${layerId}`);

    project.layers[layerIndex] = { ...project.layers[layerIndex], ...updates };
    this.projects.set(projectId, project);
    return project.layers[layerIndex];
  }

  async deleteLayer(projectId, layerId) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    project.layers = project.layers.filter(l => l.id !== layerId);
    this.projects.set(projectId, project);
    return { success: true };
  }

  async applyFilter(projectId, layerId, filterId, value) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const layer = project.layers.find(l => l.id === layerId);
    if (!layer) throw new Error(`Layer not found: ${layerId}`);

    layer.filters[filterId] = value;
    this.projects.set(projectId, project);
    return layer;
  }

  async applyPreset(projectId, layerId, presetId) {
    const preset = this.presetFilters.find(p => p.id === presetId);
    if (!preset) throw new Error(`Preset not found: ${presetId}`);

    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const layer = project.layers.find(l => l.id === layerId);
    if (!layer) throw new Error(`Layer not found: ${layerId}`);

    layer.filters = { ...layer.filters, ...preset.settings };
    this.projects.set(projectId, project);
    return layer;
  }

  async undo(projectId) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    if (project.history.length === 0) {
      throw new Error('No history to undo');
    }

    const previousState = project.history.pop();
    project.layers = previousState.layers;
    this.projects.set(projectId, project);
    return project;
  }

  async saveToHistory(projectId) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    project.history.push({
      layers: JSON.parse(JSON.stringify(project.layers)),
      timestamp: new Date().toISOString()
    });

    if (project.history.length > 50) {
      project.history = project.history.slice(-50);
    }

    this.projects.set(projectId, project);
    return project;
  }

  getFilters() {
    return this.filterTypes;
  }

  getPresets() {
    return this.presetFilters;
  }

  async getStats() {
    return {
      projects: this.projects.size,
      filters: this.filterTypes.length,
      presets: this.presetFilters.length
    };
  }

  async exportProjects(format = 'json') {
    const projects = Array.from(this.projects.values());

    if (format === 'json') {
      return JSON.stringify(projects, null, 2);
    }

    return projects;
  }
}

module.exports = ImageEditorEngine;
