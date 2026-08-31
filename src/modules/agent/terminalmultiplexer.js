const { v4: uuidv4 } = require('uuid');
const os = require('os');

class TerminalMultiplexerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.windows = new Map();
    this.panes = new Map();
    this.layouts = new Map();
    this.macros = new Map();

    this.layoutPresets = [
      { id: 'full', name: 'Full Screen', icon: '🖥️', panes: 1, description: 'Single full pane' },
      { id: 'horizontal-2', name: '2 Horizontal', icon: '📊', panes: 2, description: 'Two horizontal panes' },
      { id: 'vertical-2', name: '2 Vertical', icon: '📋', panes: 2, description: 'Two vertical panes' },
      { id: 'grid-4', name: '4 Grid', icon: '⊞', panes: 4, description: 'Four equal panes' },
      { id: 'main-side', name: 'Main + Side', icon: '◧', panes: 2, description: 'Large main, small side' },
      { id: 'main-top', name: 'Main + Bottom', icon: '⬓', panes: 2, description: 'Large main, small bottom' },
      { id: 'triple', name: 'Triple Stack', icon: '☰', panes: 3, description: 'Three vertical panes' },
      { id: 'quad-plus', name: '4+1', icon: '⊡', panes: 5, description: 'Four grid + one large' },
      { id: 'editor-layout', name: 'Editor Layout', icon: '📝', panes: 3, description: 'Code, terminal, output' },
      { id: 'devops-layout', name: 'DevOps Layout', icon: '🚀', panes: 4, description: 'Code, logs, monitor, deploy' }
    ];

    this.commands = [
      { id: 'new-session', name: 'New Session', shortcut: 'Ctrl+B C', description: 'Create new session' },
      { id: 'detach', name: 'Detach', shortcut: 'Ctrl+B D', description: 'Detach from session' },
      { id: 'attach', name: 'Attach', shortcut: 'tmux attach', description: 'Attach to session' },
      { id: 'new-window', name: 'New Window', shortcut: 'Ctrl+B C', description: 'New window in session' },
      { id: 'split-h', name: 'Split Horizontal', shortcut: 'Ctrl+B %', description: 'Split pane horizontally' },
      { id: 'split-v', name: 'Split Vertical', shortcut: 'Ctrl+B "', description: 'Split pane vertically' },
      { id: 'next-window', name: 'Next Window', shortcut: 'Ctrl+B N', description: 'Switch to next window' },
      { id: 'prev-window', name: 'Prev Window', shortcut: 'Ctrl+B P', description: 'Switch to prev window' },
      { id: 'select-pane', name: 'Select Pane', shortcut: 'Ctrl+B O', description: 'Cycle through panes' },
      { id: 'resize', name: 'Resize Pane', shortcut: 'Ctrl+B Arrow', description: 'Resize current pane' },
      { id: 'kill-pane', name: 'Kill Pane', shortcut: 'Ctrl+B X', description: 'Close current pane' },
      { id: 'kill-window', name: 'Kill Window', shortcut: 'Ctrl+B &', description: 'Close current window' },
      { id: 'swap-pane', name: 'Swap Pane', shortcut: 'Ctrl+B {', description: 'Swap pane with previous' },
      { id: 'break-pane', name: 'Break Pane', shortcut: 'Ctrl+B !', description: 'Break pane to window' },
      { id: 'join-pane', name: 'Join Pane', shortcut: 'Ctrl+B }', description: 'Join pane from window' },
      { id: 'rename-window', name: 'Rename Window', shortcut: 'Ctrl+B ,', description: 'Rename current window' },
      { id: 'rename-session', name: 'Rename Session', shortcut: 'Ctrl+B $', description: 'Rename current session' },
      { id: 'list-sessions', name: 'List Sessions', shortcut: 'tmux ls', description: 'List all sessions' },
      { id: 'capture-pane', name: 'Capture Pane', shortcut: 'Ctrl+B [', description: 'Capture pane content' },
      { id: 'scroll-mode', name: 'Scroll Mode', shortcut: 'Ctrl+B [', description: 'Enter scroll mode' }
    ];

    this.macros = [
      { id: 'setup-dev', name: 'Dev Setup', description: '3-pane dev layout', commands: ['split-h', 'split-v', 'select-pane 0'] },
      { id: 'server-monitor', name: 'Server Monitor', description: '4-pane server view', commands: ['split-h', 'split-v', 'next-window', 'split-v'] },
      { id: 'code-review', name: 'Code Review', description: 'Side-by-side code', commands: ['split-v', 'select-pane 0'] },
      { id: 'deploy-pipeline', name: 'Deploy Pipeline', description: 'Build, test, deploy', commands: ['split-h', 'split-h', 'select-pane 0'] }
    ];

    this.statusFormats = [
      { id: 'default', name: 'Default', format: '#S #W:#P' },
      { id: 'minimal', name: 'Minimal', format: '#S' },
      { id: 'detailed', name: 'Detailed', format: '#S | #W | #P | %H:%M' },
      { id: 'git', name: 'Git Branch', format: '#S (#I:#P) #{pane_current_path}' },
      { id: 'custom', name: 'Custom', format: '' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Terminal Multiplexer Engine...');
    this.loadSettings();
    this.logger.info('Terminal Multiplexer Engine initialized');
  }

  loadSettings() {
    this.settings = {
      enabled: true,
      backend: 'tmux',
      defaultLayout: 'editor-layout',
      mouseSupport: true,
      scrollbackLines: 50000,
      statusInterval: 5,
      defaultShell: process.env.SHELL || '/bin/zsh',
      startupCommand: ''
    };
  }

  createSession(name, params = {}) {
    const id = uuidv4();
    const session = {
      id,
      name: name || `session-${id.slice(0, 6)}`,
      backend: params.backend || this.settings.backend,
      layout: params.layout || this.settings.defaultLayout,
      windows: [],
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const windowId = this.createWindow(id, { name: 'main' });
    session.windows.push(windowId);

    this.sessions.set(id, session);
    return session;
  }

  createWindow(sessionId, params = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const id = uuidv4();
    const window = {
      id,
      sessionId,
      name: params.name || `window-${session.windows.length}`,
      index: session.windows.length,
      panes: [],
      activePane: null,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const paneId = this.createPane(id, {});
    window.panes.push(paneId);
    window.activePane = paneId;

    this.windows.set(id, window);
    return id;
  }

  createPane(windowId, params = {}) {
    const window = this.windows.get(windowId);
    if (!window) throw new Error(`Window not found: ${windowId}`);

    const id = uuidv4();
    const pane = {
      id,
      windowId,
      index: window.panes.length,
      size: params.size || 100,
      command: params.command || this.settings.defaultShell,
      history: [],
      status: 'active',
      createdAt: new Date().toISOString()
    };

    this.panes.set(id, pane);
    return id;
  }

  splitPane(paneId, direction = 'horizontal', params = {}) {
    const pane = this.panes.get(paneId);
    if (!pane) throw new Error(`Pane not found: ${paneId}`);

    const window = this.windows.get(pane.windowId);
    if (!window) throw new Error(`Window not found: ${pane.windowId}`);

    const newPaneId = this.createPane(pane.windowId, { command: params.command });
    window.panes.push(newPaneId);

    const splitSize = Math.floor(pane.size / 2);
    pane.size = splitSize;
    this.panes.set(paneId, pane);

    return { original: pane, new: this.panes.get(newPaneId) };
  }

  killPane(paneId) {
    const pane = this.panes.get(paneId);
    if (!pane) throw new Error(`Pane not found: ${paneId}`);

    const window = this.windows.get(pane.windowId);
    if (window) {
      window.panes = window.panes.filter(id => id !== paneId);
      if (window.activePane === paneId) {
        window.activePane = window.panes[0] || null;
      }
      this.windows.set(pane.windowId, window);
    }

    this.panes.delete(paneId);
    return { success: true };
  }

  killWindow(windowId) {
    const window = this.windows.get(windowId);
    if (!window) throw new Error(`Window not found: ${windowId}`);

    window.panes.forEach(paneId => this.panes.delete(paneId));

    const session = this.sessions.get(window.sessionId);
    if (session) {
      session.windows = session.windows.filter(id => id !== windowId);
      this.sessions.set(window.sessionId, session);
    }

    this.windows.delete(windowId);
    return { success: true };
  }

  killSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.windows.forEach(windowId => this.killWindow(windowId));
    this.sessions.delete(sessionId);
    return { success: true };
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  listSessions() {
    return Array.from(this.sessions.values());
  }

  getWindow(id) {
    return this.windows.get(id);
  }

  getPane(id) {
    return this.panes.get(id);
  }

  applyLayout(sessionId, layoutId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const layout = this.layoutPresets.find(l => l.id === layoutId);
    if (!layout) throw new Error(`Layout not found: ${layoutId}`);

    session.layout = layoutId;
    this.sessions.set(sessionId, session);

    return { session, layout };
  }

  runMacro(sessionId, macroId) {
    const macro = this.macros.find(m => m.id === macroId);
    if (!macro) throw new Error(`Macro not found: ${macroId}`);

    return { session: this.sessions.get(sessionId), macro, applied: true };
  }

  getLayoutPresets() {
    return this.layoutPresets;
  }

  getCommands() {
    return this.commands;
  }

  getMacros() {
    return this.macros;
  }

  getStatusFormats() {
    return this.statusFormats;
  }

  async getStats() {
    const sessions = Array.from(this.sessions.values());
    const windows = Array.from(this.windows.values());
    const panes = Array.from(this.panes.values());

    return {
      sessions: sessions.length,
      windows: windows.length,
      panes: panes.length,
      activeSessions: sessions.filter(s => s.status === 'active').length
    };
  }

  async getSettings() {
    return this.settings;
  }

  async updateSettings(updates) {
    this.settings = { ...this.settings, ...updates };
    return this.settings;
  }
}

module.exports = TerminalMultiplexerEngine;
