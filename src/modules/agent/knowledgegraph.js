const { v4: uuidv4 } = require('uuid');

class KnowledgeGraphEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.nodes = new Map();
    this.edges = new Map();
    this.concepts = new Map();

    this.nodeTypes = [
      { id: 'concept', name: 'Concept', icon: '💡', color: '#FFEB3B' },
      { id: 'person', name: 'Person', icon: '👤', color: '#2196F3' },
      { id: 'project', name: 'Project', icon: '📁', color: '#4CAF50' },
      { id: 'file', name: 'File', icon: '📄', color: '#9C27B0' },
      { id: 'function', name: 'Function', icon: '⚡', color: '#FF9800' },
      { id: 'class', name: 'Class', icon: '🏗️', color: '#E91E63' },
      { id: 'variable', name: 'Variable', icon: '📝', color: '#607D8B' },
      { id: 'dependency', name: 'Dependency', icon: '📦', color: '#00BCD4' },
      { id: 'service', name: 'Service', icon: '🌐', color: '#3F51B5' },
      { id: 'decision', name: 'Decision', icon: '🎯', color: '#FF5722' }
    ];

    this.edgeTypes = [
      { id: 'uses', name: 'Uses', icon: '→' },
      { id: 'depends-on', name: 'Depends On', icon: '⬆️' },
      { id: 'implements', name: 'Implements', icon: '🏗️' },
      { id: 'extends', name: 'Extends', icon: '↗️' },
      { id: 'calls', name: 'Calls', icon: '📞' },
      { id: 'imports', name: 'Imports', icon: '📦' },
      { id: 'related-to', name: 'Related To', icon: '🔗' },
      { id: 'created-by', name: 'Created By', icon: '👤' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Knowledge Graph Engine...');
    this.loadSettings();
    this.logger.info('Knowledge Graph Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, maxNodes: 10000, maxEdges: 50000, autoLayout: true };
  }

  addNode(params) {
    const { type = 'concept', label = '', properties = {}, description = '' } = params;
    const id = uuidv4();
    const node = { id, type, label, properties, description, connections: 0, createdAt: new Date().toISOString() };
    this.nodes.set(id, node);
    return node;
  }

  addEdge(params) {
    const { source, target, type = 'related-to', weight = 1, label = '' } = params;
    const id = uuidv4();
    const edge = { id, source, target, type, weight, label };
    this.edges.set(id, edge);
    const sourceNode = this.nodes.get(source);
    if (sourceNode) { sourceNode.connections++; this.nodes.set(source, sourceNode); }
    return edge;
  }

  getNode(id) { return this.nodes.get(id); }
  listNodes(type = null) { let n = Array.from(this.nodes.values()); if (type) n = n.filter(x => x.type === type); return n; }
  getEdge(id) { return this.edges.get(id); }
  getNodeTypes() { return this.nodeTypes; }
  getEdgeTypes() { return this.edgeTypes; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { nodes: this.nodes.size, edges: this.edges.size, avgConnections: this.nodes.size > 0 ? Array.from(this.nodes.values()).reduce((sum, n) => sum + n.connections, 0) / this.nodes.size : 0 };
  }
}

module.exports = KnowledgeGraphEngine;
