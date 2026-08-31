const { v4: uuidv4 } = require('uuid');

class WorkflowBuilderEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.workflows = new Map();
    this.nodes = new Map();
    this.edges = new Map();
    this.executions = new Map();

    this.nodeTypes = [
      { id: 'start', name: 'Start', icon: '▶️', description: 'Workflow start', color: '#4CAF50' },
      { id: 'end', name: 'End', icon: '⏹️', description: 'Workflow end', color: '#F44336' },
      { id: 'action', name: 'Action', icon: '⚡', description: 'Execute action', color: '#2196F3' },
      { id: 'condition', name: 'Condition', icon: '🔀', description: 'If/else branch', color: '#FF9800' },
      { id: 'loop', name: 'Loop', icon: '🔄', description: 'Repeat action', color: '#9C27B0' },
      { id: 'delay', name: 'Delay', icon: '⏳', description: 'Wait/delay', color: '#607D8B' },
      { id: 'parallel', name: 'Parallel', icon: '⚡', description: 'Run in parallel', color: '#E91E63' },
      { id: 'subprocess', name: 'Subprocess', icon: '📁', description: 'Call sub-workflow', color: '#00BCD4' },
      { id: 'notification', name: 'Notification', icon: '🔔', description: 'Send notification', color: '#FF5722' },
      { id: 'approval', name: 'Approval', icon: '✅', description: 'Wait for approval', color: '#8BC34A' }
    ];

    this.triggers = [
      { id: 'manual', name: 'Manual', icon: '🔘', description: 'Manual trigger' },
      { id: 'schedule', name: 'Schedule', icon: '⏰', description: 'Scheduled trigger' },
      { id: 'event', name: 'Event', icon: '📡', description: 'Event-based trigger' },
      { id: 'webhook', name: 'Webhook', icon: '🔗', description: 'Webhook trigger' },
      { id: 'file-change', name: 'File Change', icon: '📁', description: 'File change trigger' },
      { id: 'git-push', name: 'Git Push', icon: '🔀', description: 'Git push trigger' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Workflow Builder Engine...');
    this.loadSettings();
    this.logger.info('Workflow Builder Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, autoSave: true, maxNodes: 100, enableVisual: true };
  }

  createWorkflow(params) {
    const { name, description = '', trigger = 'manual', nodes = [], edges = [] } = params;
    const id = uuidv4();
    const wf = { id, name, description, trigger, nodes, edges, status: 'draft', version: 1, createdAt: new Date().toISOString() };
    this.workflows.set(id, wf);
    return wf;
  }

  addNode(params) {
    const { workflowId, type = 'action', label = '', config = {} } = params;
    const id = uuidv4();
    const node = { id, workflowId, type, label, config, x: 0, y: 0, createdAt: new Date().toISOString() };
    this.nodes.set(id, node);
    const wf = this.workflows.get(workflowId);
    if (wf) { wf.nodes.push(id); this.workflows.set(workflowId, wf); }
    return node;
  }

  addEdge(params) {
    const { workflowId, source, target, label = '' } = params;
    const id = uuidv4();
    const edge = { id, workflowId, source, target, label };
    this.edges.set(id, edge);
    const wf = this.workflows.get(workflowId);
    if (wf) { wf.edges.push(id); this.workflows.set(workflowId, wf); }
    return edge;
  }

  async executeWorkflow(workflowId, params = {}) {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error('Workflow not found');
    const execId = uuidv4();
    const exec = { id: execId, workflowId, params, status: 'running', startedAt: new Date().toISOString(), completedAt: null, result: null };
    this.executions.set(execId, exec);
    exec.status = 'completed';
    exec.completedAt = new Date().toISOString();
    exec.result = { success: true, output: `Workflow "${wf.name}" executed` };
    this.executions.set(execId, exec);
    return exec;
  }

  getWorkflow(id) { return this.workflows.get(id); }
  listWorkflows() { return Array.from(this.workflows.values()); }
  getNodeTypes() { return this.nodeTypes; }
  getTriggers() { return this.triggers; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { workflows: this.workflows.size, nodes: this.nodes.size, edges: this.edges.size, executions: this.executions.size };
  }
}

module.exports = WorkflowBuilderEngine;
