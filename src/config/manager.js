const path = require('path');
const fs = require('fs-extra');
const os = require('os');

class ConfigManager {
  constructor(store) {
    this.store = store;
    this.configDir = path.join(os.homedir(), '.pix');
    this.configFile = path.join(this.configDir, 'config.json');
    this.apiKeysFile = path.join(this.configDir, 'api-keys.json');
    this.defaults = {
      general: {
        appName: 'Pix',
        version: '1.0.0',
        theme: 'dark',
        language: 'en',
        autoSave: true,
        autoUpdate: true,
        notifications: true,
        minimizeToTray: true,
        startMinimized: false
      },
      ai: {
        defaultProvider: 'gemini',
        defaultModel: 'gemini-pro',
        temperature: 0.7,
        maxTokens: 4096,
        streamResponses: true,
        saveHistory: true,
        historyLimit: 100
      },
      automation: {
        screenshotQuality: 100,
        screenshotFormat: 'png',
        mouseDelay: 50,
        typeDelay: 50,
        animationDuration: 0.5,
        recordingEnabled: false
      },
      sandbox: {
        defaultLanguage: 'javascript',
        maxSandboxes: 10,
        defaultTimeout: 300000,
        defaultMemoryLimit: 512,
        networkAccess: false,
        autoCleanup: true
      },
      storage: {
        maxFiles: 100000,
        maxFileSize: 100 * 1024 * 1024,
        compressionEnabled: true,
        backupEnabled: true,
        backupInterval: '24h',
        retentionDays: 30
      },
      learning: {
        autoObserve: true,
        patternDetection: true,
        skillCaching: true,
        maxObservations: 10000
      },
      knowledge: {
        defaultCountry: 'us',
        defaultLanguage: 'en',
        cacheEnabled: true,
        cacheTimeout: 3600,
        safeSearch: 'moderate'
      },
      ui: {
        sidebarWidth: 280,
        editorFontSize: 14,
        editorFontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
        editorTabSize: 2,
        editorWordWrap: 'on',
        showLineNumbers: true,
        minimapEnabled: true
      }
    };
  }

  async initialize() {
    await fs.ensureDir(this.configDir);

    if (!await fs.pathExists(this.configFile)) {
      await fs.writeJson(this.configFile, this.defaults, { spaces: 2 });
    }

    if (!await fs.pathExists(this.apiKeysFile)) {
      await fs.writeJson(this.apiKeysFile, {}, { spaces: 2 });
    }
  }

  get(key) {
    const keys = key.split('.');
    let value = this.defaults;

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return undefined;
      }
    }

    try {
      const stored = this.store.get(key);
      return stored !== undefined ? stored : value;
    } catch (e) {
      return value;
    }
  }

  set(key, value) {
    this.store.set(key, value);
  }

  getAll() {
    const config = { ...this.defaults };
    const stored = this.store.store;

    for (const [key, value] of Object.entries(stored)) {
      const keys = key.split('.');
      let current = config;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    }

    return config;
  }

  getApiKey(provider) {
    try {
      const keys = this.store.get('apiKeys') || {};
      return keys[provider];
    } catch (e) {
      return undefined;
    }
  }

  setApiKeys(keys) {
    this.store.set('apiKeys', keys);
  }

  async reset() {
    this.store.clear();
    await fs.writeJson(this.configFile, this.defaults, { spaces: 2 });
    await fs.writeJson(this.apiKeysFile, {}, { spaces: 2 });
  }

  async export() {
    return {
      config: this.getAll(),
      apiKeys: this.store.get('apiKeys') || {}
    };
  }

  async import(data) {
    if (data.config) {
      for (const [key, value] of Object.entries(data.config)) {
        this.set(key, value);
      }
    }
    if (data.apiKeys) {
      this.setApiKeys(data.apiKeys);
    }
  }
}

module.exports = ConfigManager;
