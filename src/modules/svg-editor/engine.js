const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class SVGEditorEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.projects = new Map();
    this.templates = new Map();
    this.svgDir = path.join(os.homedir(), '.pix/svg-editor');
  }

  async initialize() {
    this.logger.info('Initializing SVG Editor Engine...');
    await fs.ensureDir(this.svgDir);
    await this.loadProjects();
    this.loadTemplates();
    this.loadShapes();
    this.logger.info('SVG Editor Engine initialized');
  }

  async loadProjects() {
    try {
      const files = await fs.readdir(this.svgDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.svgDir, file));
          if (data.type === 'project') this.projects.set(data.id, data);
          else if (data.type === 'template') this.templates.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadTemplates() {
    const defaultTemplates = [
      {
        id: 'icon-circle',
        name: 'Circle Icon',
        content: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#4285F4"/></svg>',
        icon: '⭕'
      },
      {
        id: 'icon-square',
        name: 'Square Icon',
        content: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="90" height="90" rx="10" fill="#34A853"/></svg>',
        icon: '⬜'
      },
      {
        id: 'icon-triangle',
        name: 'Triangle Icon',
        content: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 95,95 5,95" fill="#FBBC05"/></svg>',
        icon: '🔺'
      },
      {
        id: 'icon-star',
        name: 'Star Icon',
        content: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="#EA4335"/></svg>',
        icon: '⭐'
      },
      {
        id: 'chart-bar',
        name: 'Bar Chart',
        content: '<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="80" width="30" height="60" fill="#4285F4"/><rect x="60" y="50" width="30" height="90" fill="#34A853"/><rect x="100" y="30" width="30" height="110" fill="#FBBC05"/><rect x="140" y="60" width="30" height="80" fill="#EA4335"/></svg>',
        icon: '📊'
      },
      {
        id: 'flowchart-process',
        name: 'Process Box',
        content: '<svg viewBox="0 0 150 80" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="130" height="60" rx="8" fill="#4285F4" stroke="#2196F3" stroke-width="2"/></svg>',
        icon: '📦'
      }
    ];

    defaultTemplates.forEach(template => {
      if (!this.templates.has(template.id)) {
        this.templates.set(template.id, {
          ...template,
          type: 'template',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  loadShapes() {
    this.shapes = [
      { id: 'rect', name: 'Rectangle', icon: '⬜', tag: 'rect' },
      { id: 'circle', name: 'Circle', icon: '⭕', tag: 'circle' },
      { id: 'ellipse', name: 'Ellipse', icon: '⬭', tag: 'ellipse' },
      { id: 'line', name: 'Line', icon: '📏', tag: 'line' },
      { id: 'polyline', name: 'Polyline', icon: '📈', tag: 'polyline' },
      { id: 'polygon', name: 'Polygon', icon: '🔺', tag: 'polygon' },
      { id: 'path', name: 'Path', icon: '✏️', tag: 'path' },
      { id: 'text', name: 'Text', icon: 'T', tag: 'text' },
      { id: 'g', name: 'Group', icon: '📁', tag: 'g' }
    ];
  }

  async createProject(params) {
    const {
      name,
      width = 200,
      height = 200,
      viewBox = null,
      background = 'transparent',
      elements = []
    } = params;

    const id = uuidv4();
    const project = {
      id,
      name,
      width,
      height,
      viewBox: viewBox || `0 0 ${width} ${height}`,
      background,
      elements: elements.length > 0 ? elements : [],
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

  async addElement(projectId, element) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const newElement = {
      id: uuidv4(),
      ...element,
      type: 'element',
      createdAt: new Date().toISOString()
    };

    project.elements.push(newElement);
    this.projects.set(projectId, project);
    return newElement;
  }

  async updateElement(projectId, elementId, updates) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const elementIndex = project.elements.findIndex(e => e.id === elementId);
    if (elementIndex === -1) throw new Error(`Element not found: ${elementId}`);

    project.elements[elementIndex] = { ...project.elements[elementIndex], ...updates };
    this.projects.set(projectId, project);
    return project.elements[elementIndex];
  }

  async deleteElement(projectId, elementId) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    project.elements = project.elements.filter(e => e.id !== elementId);
    this.projects.set(projectId, project);
    return { success: true };
  }

  async moveElement(projectId, elementId, direction) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const elementIndex = project.elements.findIndex(e => e.id === elementId);
    if (elementIndex === -1) throw new Error(`Element not found: ${elementId}`);

    const step = 10;
    const element = project.elements[elementIndex];

    switch (direction) {
      case 'up':
        element.y = (element.y || 0) - step;
        break;
      case 'down':
        element.y = (element.y || 0) + step;
        break;
      case 'left':
        element.x = (element.x || 0) - step;
        break;
      case 'right':
        element.x = (element.x || 0) + step;
        break;
    }

    this.projects.set(projectId, project);
    return element;
  }

  async saveToHistory(projectId) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    project.history.push({
      elements: JSON.parse(JSON.stringify(project.elements)),
      timestamp: new Date().toISOString()
    });

    if (project.history.length > 50) {
      project.history = project.history.slice(-50);
    }

    this.projects.set(projectId, project);
    return project;
  }

  async undo(projectId) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    if (project.history.length === 0) {
      throw new Error('No history to undo');
    }

    const previousState = project.history.pop();
    project.elements = previousState.elements;
    this.projects.set(projectId, project);
    return project;
  }

  generateSVG(projectId) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    let svg = `<svg viewBox="${project.viewBox}" xmlns="http://www.w3.org/2000/svg" width="${project.width}" height="${project.height}">`;

    if (project.background && project.background !== 'transparent') {
      svg += `<rect width="100%" height="100%" fill="${project.background}"/>`;
    }

    for (const element of project.elements) {
      svg += this.elementToSVG(element);
    }

    svg += '</svg>';
    return svg;
  }

  elementToSVG(element) {
    const style = this.buildStyle(element.style);

    switch (element.tag) {
      case 'rect':
        return `<rect x="${element.x || 0}" y="${element.y || 0}" width="${element.width || 100}" height="${element.height || 100}" rx="${element.rx || 0}"${style}/>`;
      case 'circle':
        return `<circle cx="${element.cx || 50}" cy="${element.cy || 50}" r="${element.r || 50}"${style}/>`;
      case 'ellipse':
        return `<ellipse cx="${element.cx || 50}" cy="${element.cy || 50}" rx="${element.rx || 50}" ry="${element.ry || 30}"${style}/>`;
      case 'line':
        return `<line x1="${element.x1 || 0}" y1="${element.y1 || 0}" x2="${element.x2 || 100}" y2="${element.y2 || 100}"${style}/>`;
      case 'polygon':
        return `<polygon points="${element.points || '50,5 95,95 5,95'}"${style}/>`;
      case 'text':
        return `<text x="${element.x || 0}" y="${element.y || 0}" font-size="${element.fontSize || 16}"${style}>${element.text || ''}</text>`;
      default:
        return '';
    }
  }

  buildStyle(styleObj) {
    if (!styleObj || Object.keys(styleObj).length === 0) return '';

    const styles = Object.entries(styleObj)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');

    return ` style="${styles}"`;
  }

  getShapes() {
    return this.shapes;
  }

  getTemplates() {
    return Array.from(this.templates.values());
  }

  async getStats() {
    return {
      projects: this.projects.size,
      templates: this.templates.size,
      shapes: this.shapes.length
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

module.exports = SVGEditorEngine;
