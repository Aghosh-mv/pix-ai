const { v4: uuidv4 } = require('uuid');

class MindMapEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.mindmaps = new Map();
    this.nodes = new Map();
    this.edges = new Map();

    this.layouts = [
      { id: 'radial', name: 'Radial', icon: '🎯', description: 'Center-out radial layout' },
      { id: 'tree', name: 'Tree', icon: '🌳', description: 'Hierarchical tree layout' },
      { id: 'organic', name: 'Organic', icon: '🌿', description: 'Natural flowing layout' },
      { id: 'grid', name: 'Grid', icon: '⊞', description: 'Grid-based layout' },
      { id: 'force', name: 'Force-Directed', icon: '🧲', description: 'Physics-based layout' }
    ];

    this.nodeTypes = [
      { id: 'idea', name: 'Idea', icon: '💡', color: '#FFEB3B' },
      { id: 'task', name: 'Task', icon: '📋', color: '#4CAF50' },
      { id: 'question', name: 'Question', icon: '❓', color: '#2196F3' },
      { id: 'note', name: 'Note', icon: '📝', color: '#9C27B0' },
      { id: 'link', name: 'Link', icon: '🔗', color: '#FF9800' },
      { id: 'image', name: 'Image', icon: '🖼️', color: '#E91E63' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Mind Map Engine...');
    this.loadSettings();
    this.logger.info('Mind Map Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, defaultLayout: 'radial', autoSave: true };
  }

  createMindMap(params) {
    const { name, description = '', layout = 'radial' } = params;
    const id = uuidv4();
    const map = { id, name, description, layout, nodes: [], edges: [], status: 'active', createdAt: new Date().toISOString() };
    this.mindmaps.set(id, map);
    return map;
  }

  addNode(params) {
    const { mindMapId, type = 'idea', label = '', content = '', parentId = null, x = 0, y = 0 } = params;
    const id = uuidv4();
    const node = { id, mindMapId, type, label, content, parentId, x, y, createdAt: new Date().toISOString() };
    this.nodes.set(id, node);
    const map = this.mindmaps.get(mindMapId);
    if (map) { map.nodes.push(id); this.mindmaps.set(mindMapId, map); }
    if (parentId) { this.addEdge({ mindMapId, source: parentId, target: id, type: 'child' }); }
    return node;
  }

  addEdge(params) {
    const { mindMapId, source, target, type = 'child', label = '' } = params;
    const id = uuidv4();
    const edge = { id, mindMapId, source, target, type, label };
    this.edges.set(id, edge);
    const map = this.mindmaps.get(mindMapId);
    if (map) { map.edges.push(id); this.mindmaps.set(mindMapId, map); }
    return edge;
  }

  getMindMap(id) { return this.mindmaps.get(id); }
  listMindMaps() { return Array.from(this.mindmaps.values()); }
  getNode(id) { return this.nodes.get(id); }
  getLayouts() { return this.layouts; }
  getNodeTypes() { return this.nodeTypes; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { mindmaps: this.mindmaps.size, nodes: this.nodes.size, edges: this.edges.size };
  }
}

module.exports = MindMapEngine;
