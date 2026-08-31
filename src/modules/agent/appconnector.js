const { v4: uuidv4 } = require('uuid');
const os = require('os');

class AppConnectorEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.connections = new Map();
    this.actions = new Map();
    this.scripts = new Map();
    this.permissions = new Map();
    this.history = new Map();

    this.appCategories = [
      { id: 'ide', name: 'IDEs & Editors', icon: '💻', apps: ['vscode', 'vim', 'neovim', 'emacs', 'sublime', 'atom', 'notepad++', 'intellij', 'pycharm', 'webstorm'] },
      { id: 'browser', name: 'Browsers', icon: '🌐', apps: ['chrome', 'firefox', 'safari', 'edge', 'brave', 'opera', 'arc'] },
      { id: 'communication', name: 'Communication', icon: '💬', apps: ['slack', 'discord', 'teams', 'zoom', 'skype', 'telegram', 'whatsapp', 'signal', 'matrix', 'element'] },
      { id: 'productivity', name: 'Productivity', icon: '📋', apps: ['notion', 'obsidian', 'roam', 'todoist', 'trello', 'asana', 'jira', 'linear', 'monday', 'clickup'] },
      { id: 'design', name: 'Design Tools', icon: '🎨', apps: ['figma', 'sketch', 'photoshop', 'illustrator', 'blender', 'maya', 'zbrush'] },
      { id: 'gameengines', name: 'Game Engines', icon: '🎮', apps: ['unity', 'unreal', 'godot', 'gamemaker', 'rpgmaker', 'robloxstudio', 'defold', 'cocos'] },
      { id: 'media', name: 'Media', icon: '🎬', apps: ['obs', 'premiere', 'davinci', 'aftereffects', 'audacity', 'vlc', 'spotify'] },
      { id: 'devtools', name: 'Dev Tools', icon: '⚙️', apps: ['docker', 'postman', 'insomnia', 'dbeaver', 'tableplus', 'pgadmin', 'redisdesktop'] },
      { id: 'system', name: 'System', icon: '🖥️', apps: ['finder', 'explorer', 'terminal', 'iterm', 'warp', 'alacritty', 'kitty'] },
      { id: 'ai', name: 'AI Tools', icon: '🤖', apps: ['chatgpt', 'claude', 'gemini', 'copilot', 'ollama', 'lmstudio', 'textgen', 'kobold'] },
      { id: 'office', name: 'Office', icon: '📊', apps: ['word', 'excel', 'powerpoint', 'pages', 'numbers', 'keynote', 'google-docs', 'libreoffice'] },
      { id: 'any', name: 'Any App', icon: '📱', apps: [] }
    ];

    this.actionTypes = [
      { id: 'click', name: 'Click', icon: '👆', description: 'Click at coordinates or element', params: ['x', 'y', 'element'] },
      { id: 'type', name: 'Type Text', icon: '⌨️', description: 'Type text', params: ['text', 'delay'] },
      { id: 'hotkey', name: 'Keyboard Shortcut', icon: '🔤', description: 'Press keyboard shortcut', params: ['keys'] },
      { id: 'scroll', name: 'Scroll', icon: '📜', description: 'Scroll page', params: ['direction', 'amount'] },
      { id: 'drag', name: 'Drag', icon: '↕️', description: 'Drag from A to B', params: ['fromX', 'fromY', 'toX', 'toY'] },
      { id: 'screenshot', name: 'Screenshot', icon: '📸', description: 'Take screenshot', params: ['region'] },
      { id: 'read', name: 'Read Screen', icon: '👁️', description: 'Read text from screen', params: ['region'] },
      { id: 'ocr', name: 'OCR', icon: '🔍', description: 'Extract text via OCR', params: ['region'] },
      { id: 'launch', name: 'Launch App', icon: '🚀', description: 'Launch application', params: ['app', 'args'] },
      { id: 'focus', name: 'Focus Window', icon: '🪟', description: 'Focus application window', params: ['app'] },
      { id: 'close', name: 'Close Window', icon: '❌', description: 'Close application window', params: ['app'] },
      { id: 'minimize', name: 'Minimize', icon: '➖', description: 'Minimize window', params: ['app'] },
      { id: 'maximize', name: 'Maximize', icon: '➕', description: 'Maximize window', params: ['app'] },
      { id: 'resize', name: 'Resize Window', icon: '↔️', description: 'Resize window', params: ['app', 'width', 'height'] },
      { id: 'move', name: 'Move Window', icon: '↕️', description: 'Move window', params: ['app', 'x', 'y'] },
      { id: 'wait', name: 'Wait', icon: '⏳', description: 'Wait for condition', params: ['condition', 'timeout'] },
      { id: 'conditional', name: 'Conditional', icon: '🔀', description: 'If-then-else logic', params: ['condition', 'then', 'else'] },
      { id: 'loop', name: 'Loop', icon: '🔄', description: 'Repeat action', params: ['times', 'action'] },
      { id: 'macro', name: 'Run Macro', icon: '🎬', description: 'Execute macro sequence', params: ['macroId'] },
      { id: 'script', name: 'Run Script', icon: '📜', description: 'Execute custom script', params: ['script', 'language'] }
    ];

    this.permissions = [
      { id: 'screen', name: 'Screen Access', icon: '🖥️', description: 'Read/interact with screen', dangerLevel: 'low' },
      { id: 'keyboard', name: 'Keyboard Control', icon: '⌨️', description: 'Type and press keys', dangerLevel: 'medium' },
      { id: 'mouse', name: 'Mouse Control', icon: '🖱️', description: 'Move and click mouse', dangerLevel: 'medium' },
      { id: 'filesystem', name: 'File System', icon: '📁', description: 'Read/write files', dangerLevel: 'medium' },
      { id: 'network', name: 'Network', icon: '🌐', description: 'Make network requests', dangerLevel: 'high' },
      { id: 'clipboard', name: 'Clipboard', icon: '📋', description: 'Read/write clipboard', dangerLevel: 'medium' },
      { id: 'processes', name: 'Process Control', icon: '⚙️', description: 'Launch/kill processes', dangerLevel: 'high' },
      { id: 'system', name: 'System Settings', icon: '🔧', description: 'Modify system settings', dangerLevel: 'critical' }
    ];

    this.presets = [
      { id: 'vscode-workflow', name: 'VS Code Workflow', app: 'vscode', actions: ['focus', 'hotkey:save', 'hotkey:build'], description: 'Focus VS Code, save, build' },
      { id: 'slack-message', name: 'Slack Message', app: 'slack', actions: ['focus', 'type:message', 'hotkey:enter'], description: 'Send Slack message' },
      { id: 'browser-research', name: 'Browser Research', app: 'chrome', actions: ['focus', 'hotkey:new-tab', 'type:query', 'hotkey:enter'], description: 'Search in browser' },
      { id: 'unity-play', name: 'Unity Play Mode', app: 'unity', actions: ['focus', 'hotkey:play'], description: 'Toggle Unity play mode' },
      { id: 'screenshot-sequence', name: 'Screenshot Sequence', app: 'any', actions: ['screenshot', 'wait:1000', 'screenshot'], description: 'Take multiple screenshots' },
      { id: 'desktop-capture', name: 'Desktop Capture', app: 'obs', actions: ['focus', 'hotkey:start-recording'], description: 'Start OBS recording' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing App Connector Engine...');
    this.loadSettings();
    this.logger.info('App Connector Engine initialized');
  }

  loadSettings() {
    this.settings = {
      enabled: false,
      permissions: { screen: false, keyboard: false, mouse: false, filesystem: true, network: true, clipboard: false, processes: false, system: false },
      safetyDelay: 100,
      confirmationRequired: ['system', 'processes', 'network'],
      logAllActions: true,
      maxActionsPerMinute: 60
    };
  }

  connectApp(appId, params = {}) {
    const id = uuidv4();
    const connection = { id, appId, name: params.name || appId, status: 'connected', actions: [], lastAction: null, createdAt: new Date().toISOString() };
    this.connections.set(id, connection);
    return connection;
  }

  disconnectApp(connectionId) {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new Error('Connection not found');
    conn.status = 'disconnected';
    this.connections.set(connectionId, conn);
    return conn;
  }

  async executeAction(connectionId, action) {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new Error('Connection not found');
    if (!this.checkPermission(action.type)) throw new Error(`Permission denied for action: ${action.type}`);

    const fullAction = { id: uuidv4(), connectionId, ...action, status: 'completed', timestamp: new Date().toISOString() };
    conn.actions.push(fullAction.id);
    conn.lastAction = new Date().toISOString();
    this.connections.set(connectionId, conn);
    this.actions.set(fullAction.id, fullAction);

    return { action: fullAction, result: { success: true, output: `Action "${action.type}" executed` } };
  }

  async runPreset(connectionId, presetId) {
    const preset = this.presets.find(p => p.id === presetId);
    if (!preset) throw new Error('Preset not found');
    const results = [];
    for (const actionStr of preset.actions) {
      const [type, ...args] = actionStr.split(':');
      const result = await this.executeAction(connectionId, { type, params: args });
      results.push(result);
    }
    return { preset, results };
  }

  checkPermission(actionType) {
    const permMap = { click: 'mouse', type: 'keyboard', hotkey: 'keyboard', scroll: 'mouse', drag: 'mouse', screenshot: 'screen', read: 'screen', ocr: 'screen', launch: 'processes', focus: 'screen', close: 'processes', minimize: 'screen', maximize: 'screen', resize: 'screen', move: 'screen' };
    const perm = permMap[actionType] || 'filesystem';
    return this.settings.permissions[perm] !== false;
  }

  getConnection(id) { return this.connections.get(id); }
  listConnections() { return Array.from(this.connections.values()); }
  getAppCategories() { return this.appCategories; }
  getActionTypes() { return this.actionTypes; }
  getPermissions() { return this.permissions; }
  getPresets() { return this.presets; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    const connections = Array.from(this.connections.values());
    return { connections: connections.length, active: connections.filter(c => c.status === 'connected').length, actions: this.actions.size, presets: this.presets.length, categories: this.appCategories.length };
  }
}

module.exports = AppConnectorEngine;
