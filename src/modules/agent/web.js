const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class WebAutomationEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.actions = new Map();
    this.profiles = new Map();
    this.recording = new Map();
    this.webDir = path.join(os.homedir(), '.pix/web');
  }

  async initialize() {
    this.logger.info('Initializing Web Automation Engine...');
    await fs.ensureDir(this.webDir);
    await this.loadSessions();
    this.loadActions();
    this.loadProfiles();
    this.loadSelectors();
    this.loadStrategies();
    this.logger.info('Web Automation Engine initialized');
  }

  async loadSessions() {
    try {
      const files = await fs.readdir(this.webDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.webDir, file));
          if (data.type === 'session') this.sessions.set(data.id, data);
          else if (data.type === 'profile') this.profiles.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadActions() {
    this.actionTypes = [
      { id: 'navigate', name: 'Navigate', icon: '🌐', description: 'Navigate to a URL' },
      { id: 'click', name: 'Click', icon: '🖱️', description: 'Click an element' },
      { id: 'type', name: 'Type', icon: '⌨️', description: 'Type text into an element' },
      { id: 'press', name: 'Key Press', icon: '🔤', description: 'Press a keyboard key' },
      { id: 'select', name: 'Select', icon: '📋', description: 'Select from dropdown' },
      { id: 'hover', name: 'Hover', icon: '👆', description: 'Hover over element' },
      { id: 'scroll', name: 'Scroll', icon: '📜', description: 'Scroll page or element' },
      { id: 'wait', name: 'Wait', icon: '⏳', description: 'Wait for condition' },
      { id: 'screenshot', name: 'Screenshot', icon: '📸', description: 'Take a screenshot' },
      { id: 'extract', name: 'Extract', icon: '📤', description: 'Extract data from page' },
      { id: 'fill', name: 'Fill Form', icon: '📝', description: 'Fill form fields' },
      { id: 'upload', name: 'Upload', icon: '📤', description: 'Upload a file' },
      { id: 'download', name: 'Download', icon: '📥', description: 'Download a file' },
      { id: 'evaluate', name: 'Evaluate JS', icon: '💻', description: 'Execute JavaScript' },
      { id: 'iframe', name: 'Switch Frame', icon: '🖼️', description: 'Switch to iframe' },
      { id: 'dialog', name: 'Handle Dialog', icon: '💬', description: 'Accept/dismiss dialog' },
      { id: 'cookie', name: 'Cookie', icon: '🍪', description: 'Manage cookies' },
      { id: 'storage', name: 'Local Storage', icon: '💾', description: 'Manage local storage' },
      { id: 'intercept', name: 'Intercept Request', icon: '🕸️', description: 'Intercept network requests' },
      { id: 'mock', name: 'Mock Response', icon: '🎭', description: 'Mock API responses' }
    ];
  }

  loadProfiles() {
    const defaults = [
      { id: 'chrome', name: 'Chrome', icon: '🌐', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', viewport: { width: 1920, height: 1080 } },
      { id: 'firefox', name: 'Firefox', icon: '🦊', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0', viewport: { width: 1920, height: 1080 } },
      { id: 'safari', name: 'Safari', icon: '🧭', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15', viewport: { width: 1440, height: 900 } },
      { id: 'mobile-chrome', name: 'Mobile Chrome', icon: '📱', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', viewport: { width: 412, height: 915 } },
      { id: 'mobile-safari', name: 'Mobile Safari', icon: '📱', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 } }
    ];

    defaults.forEach(profile => {
      if (!this.profiles.has(profile.id)) {
        this.profiles.set(profile.id, { ...profile, type: 'profile', builtin: true });
      }
    });
  }

  loadSelectors() {
    this.selectorStrategies = [
      { id: 'css', name: 'CSS Selector', example: '#button, .class, [data-id="1"]' },
      { id: 'xpath', name: 'XPath', example: '//button[@id="submit"], //div[@class="content"]' },
      { id: 'text', name: 'Text Content', example: 'Submit, Click Here' },
      { id: 'placeholder', name: 'Placeholder', example: 'Enter your email...' },
      { id: 'label', name: 'Label', example: 'Username, Password' },
      { id: 'role', name: 'ARIA Role', example: 'button, textbox, link' },
      { id: 'testid', name: 'Test ID', example: 'submit-btn, email-input' },
      { id: 'name', name: 'Name Attribute', example: 'username, password' }
    ];
  }

  loadStrategies() {
    this.waitStrategies = [
      { id: 'domready', name: 'DOM Ready', description: 'Wait for DOM to be ready' },
      { id: 'networkidle', name: 'Network Idle', description: 'Wait for network to be idle' },
      { id: 'load', name: 'Page Load', description: 'Wait for page to fully load' },
      { id: 'selector', name: 'Selector Visible', description: 'Wait for element to appear' },
      { id: 'timeout', name: 'Timeout', description: 'Wait for specified time' },
      { id: 'navigation', name: 'Navigation', description: 'Wait for navigation to complete' },
      { id: 'response', name: 'Response', description: 'Wait for specific API response' },
      { id: 'function', name: 'Function', description: 'Wait for custom condition' }
    ];

    this.retryStrategies = [
      { id: 'none', name: 'No Retry', description: 'Don\'t retry on failure' },
      { id: 'immediate', name: 'Immediate', description: 'Retry immediately' },
      { id: 'linear', name: 'Linear Backoff', description: 'Increase delay linearly' },
      { id: 'exponential', name: 'Exponential Backoff', description: 'Increase delay exponentially' },
      { id: 'fixed', name: 'Fixed Delay', description: 'Retry with fixed delay' }
    ];
  }

  async createSession(params) {
    const {
      name,
      url = 'about:blank',
      profile = 'chrome',
      headless = false,
      slowMo = 0,
      timeout = 30000,
      viewport = null
    } = params;

    const id = uuidv4();
    const profileData = this.profiles.get(profile) || this.profiles.get('chrome');

    const session = {
      id,
      name: name || `Session ${id.slice(0, 8)}`,
      url,
      profile,
      profileData: { ...profileData, viewport: viewport || profileData.viewport },
      headless,
      slowMo,
      timeout,
      status: 'created',
      cookies: [],
      localStorage: {},
      history: [],
      screenshots: [],
      type: 'session',
      createdAt: new Date().toISOString()
    };

    this.sessions.set(id, session);
    await this.saveSession(session);
    return session;
  }

  async startSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    session.status = 'running';
    session.startedAt = new Date().toISOString();
    this.sessions.set(id, session);

    return session;
  }

  async stopSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    session.status = 'stopped';
    session.stoppedAt = new Date().toISOString();
    this.sessions.set(id, session);

    return session;
  }

  async deleteSession(id) {
    this.sessions.delete(id);
    await fs.remove(path.join(this.webDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getSession(id) {
    return this.sessions.get(id);
  }

  listSessions() {
    return Array.from(this.sessions.values());
  }

  async navigate(sessionId, url, waitUntil = 'load') {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'navigate',
      url,
      waitUntil,
      timestamp: new Date().toISOString()
    };

    session.url = url;
    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async click(sessionId, selector, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'click',
      selector,
      selectorType: options.selectorType || 'css',
      button: options.button || 'left',
      clickCount: options.clickCount || 1,
      delay: options.delay || 0,
      force: options.force || false,
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async type(sessionId, selector, text, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'type',
      selector,
      text,
      selectorType: options.selectorType || 'css',
      delay: options.delay || 50,
      clear: options.clear || false,
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async press(sessionId, key, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'press',
      key,
      modifiers: options.modifiers || [],
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async select(sessionId, selector, values, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'select',
      selector,
      values: Array.isArray(values) ? values : [values],
      selectorType: options.selectorType || 'css',
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async hover(sessionId, selector, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'hover',
      selector,
      selectorType: options.selectorType || 'css',
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async scroll(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'scroll',
      direction: options.direction || 'down',
      amount: options.amount || 500,
      selector: options.selector || null,
      smooth: options.smooth || false,
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async wait(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'wait',
      strategy: options.strategy || 'timeout',
      timeout: options.timeout || 5000,
      selector: options.selector || null,
      url: options.url || null,
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async screenshot(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'screenshot',
      fullPage: options.fullPage || false,
      selector: options.selector || null,
      quality: options.quality || 80,
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    session.screenshots.push(action.id);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async extract(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'extract',
      selector: options.selector || null,
      attribute: options.attribute || 'textContent',
      multiple: options.multiple || false,
      regex: options.regex || null,
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async fill(sessionId, fields, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'fill',
      fields: Array.isArray(fields) ? fields : [fields],
      submit: options.submit || false,
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async evaluate(sessionId, script, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'evaluate',
      script,
      arg: options.arg || null,
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async cookie(sessionId, operation, params = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'cookie',
      operation,
      name: params.name || null,
      value: params.value || null,
      domain: params.domain || null,
      path: params.path || '/',
      expires: params.expires || null,
      httpOnly: params.httpOnly || false,
      secure: params.secure || false,
      sameSite: params.sameSite || 'Lax',
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async storage(sessionId, operation, params = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = {
      id: uuidv4(),
      sessionId,
      type: 'storage',
      operation,
      key: params.key || null,
      value: params.value || null,
      storageType: params.storageType || 'localStorage',
      timestamp: new Date().toISOString()
    };

    session.history.push(action);
    session.localStorage[params.key] = params.value;
    this.sessions.set(sessionId, session);
    this.actions.set(action.id, action);

    return action;
  }

  async createScript(params) {
    const { name, description = '', actions = [], tags = [] } = params;

    const id = uuidv4();
    const script = {
      id,
      name,
      description,
      actions,
      tags,
      variables: {},
      type: 'script',
      createdAt: new Date().toISOString()
    };

    const scriptPath = path.join(this.webDir, 'scripts', `${id}.json`);
    await fs.ensureDir(path.dirname(scriptPath));
    await fs.writeJson(scriptPath, script, { spaces: 2 });

    return script;
  }

  async addScriptAction(scriptId, action) {
    const scriptPath = path.join(this.webDir, 'scripts', `${scriptId}.json`);
    const script = await fs.readJson(scriptPath);

    script.actions.push({
      id: uuidv4(),
      ...action,
      order: script.actions.length + 1
    });

    await fs.writeJson(scriptPath, script, { spaces: 2 });
    return script;
  }

  async executeScript(scriptId, sessionId) {
    const scriptPath = path.join(this.webDir, 'scripts', `${scriptId}.json`);
    const script = await fs.readJson(scriptPath);
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const results = [];

    for (const action of script.actions) {
      try {
        let result;

        switch (action.type) {
          case 'navigate':
            result = await this.navigate(sessionId, action.url, action.waitUntil);
            break;
          case 'click':
            result = await this.click(sessionId, action.selector, action.options);
            break;
          case 'type':
            result = await this.type(sessionId, action.selector, action.text, action.options);
            break;
          case 'wait':
            result = await this.wait(sessionId, action.options);
            break;
          case 'extract':
            result = await this.extract(sessionId, action.options);
            break;
          case 'screenshot':
            result = await this.screenshot(sessionId, action.options);
            break;
          default:
            result = { error: `Unknown action type: ${action.type}` };
        }

        results.push({ actionId: action.id, success: true, result });
      } catch (error) {
        results.push({ actionId: action.id, success: false, error: error.message });
      }
    }

    return {
      scriptId,
      sessionId,
      results,
      completedAt: new Date().toISOString()
    };
  }

  async getHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return session.history;
  }

  async clearHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    session.history = [];
    this.sessions.set(sessionId, session);
    return { success: true };
  }

  getActionTypes() {
    return this.actionTypes;
  }

  getProfiles() {
    return Array.from(this.profiles.values());
  }

  getSelectorStrategies() {
    return this.selectorStrategies;
  }

  getWaitStrategies() {
    return this.waitStrategies;
  }

  getRetryStrategies() {
    return this.retryStrategies;
  }

  async getStats() {
    const sessions = Array.from(this.sessions.values());
    const actions = Array.from(this.actions.values());

    return {
      sessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'running').length,
      totalActions: actions.length,
      actionTypes: [...new Set(actions.map(a => a.type))].length,
      averageActionsPerSession: sessions.length > 0
        ? Math.round(actions.length / sessions.length)
        : 0
    };
  }

  async saveSession(session) {
    const filePath = path.join(this.webDir, `${session.id}.json`);
    await fs.writeJson(filePath, session, { spaces: 2 });
  }

  async exportWeb(format = 'json') {
    const data = {
      sessions: Array.from(this.sessions.values()),
      profiles: Array.from(this.profiles.values()),
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = WebAutomationEngine;
