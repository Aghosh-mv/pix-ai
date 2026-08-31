const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class TerminalEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.history = new Map();
    this.aliases = new Map();
    this.scripts = new Map();
    this.terminalDir = path.join(os.homedir(), '.pix/terminal');
  }

  async initialize() {
    this.logger.info('Initializing Terminal Engine...');
    await fs.ensureDir(this.terminalDir);
    await this.loadTerminal();
    this.loadDefaultAliases();
    this.loadDefaultScripts();
    this.logger.info('Terminal Engine initialized');
  }

  async loadTerminal() {
    try {
      const files = await fs.readdir(this.terminalDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.terminalDir, file));
          if (data.type === 'history') this.history.set(data.id, data);
          else if (data.type === 'alias') this.aliases.set(data.id, data);
          else if (data.type === 'script') this.scripts.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadDefaultAliases() {
    const defaults = [
      { id: 'll', command: 'ls -la', description: 'List all files with details' },
      { id: 'la', command: 'ls -A', description: 'List all files including hidden' },
      { id: 'l', command: 'ls -CF', description: 'List files in columns' },
      { id: '..', command: 'cd ..', description: 'Go up one directory' },
      { id: '...', command: 'cd ../..', description: 'Go up two directories' },
      { id: 'gst', command: 'git status', description: 'Git status' },
      { id: 'gco', command: 'git checkout', description: 'Git checkout' },
      { id: 'gcm', command: 'git commit -m', description: 'Git commit with message' },
      { id: 'gp', command: 'git push', description: 'Git push' },
      { id: 'gl', command: 'git log --oneline -10', description: 'Git log last 10 commits' }
    ];

    defaults.forEach(alias => {
      if (!this.aliases.has(alias.id)) {
        this.aliases.set(alias.id, {
          ...alias,
          type: 'alias',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  loadDefaultScripts() {
    const defaults = [
      {
        id: 'update-system',
        name: 'Update System',
        description: 'Update system packages',
        commands: [
          'sudo apt update',
          'sudo apt upgrade -y',
          'sudo apt autoremove -y'
        ],
        platform: 'linux'
      },
      {
        id: 'clean-docker',
        name: 'Clean Docker',
        description: 'Clean up Docker resources',
        commands: [
          'docker system prune -f',
          'docker volume prune -f',
          'docker network prune -f'
        ],
        platform: 'all'
      },
      {
        id: 'git-cleanup',
        name: 'Git Cleanup',
        description: 'Clean up merged branches',
        commands: [
          'git fetch --prune',
          'git branch --merged | grep -v "\\*\\|main\\|master" | xargs -n 1 git branch -d'
        ],
        platform: 'all'
      }
    ];

    defaults.forEach(script => {
      if (!this.scripts.has(script.id)) {
        this.scripts.set(script.id, {
          ...script,
          type: 'script',
          runCount: 0,
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  async addHistory(params) {
    const { command, output = '', exitCode = 0, duration = 0 } = params;

    const id = uuidv4();
    const entry = {
      id,
      command,
      output,
      exitCode,
      duration,
      type: 'history',
      timestamp: new Date().toISOString()
    };

    this.history.set(id, entry);
    return entry;
  }

  getHistory(options = {}) {
    const { limit = 100, search, exitCode } = options;
    let entries = Array.from(this.history.values());

    if (search) {
      const searchLower = search.toLowerCase();
      entries = entries.filter(e => e.command.toLowerCase().includes(searchLower));
    }
    if (exitCode !== undefined) {
      entries = entries.filter(e => e.exitCode === exitCode);
    }

    return entries
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  clearHistory() {
    this.history.clear();
    return { success: true };
  }

  async addAlias(params) {
    const { alias, command, description = '' } = params;

    const id = uuidv4();
    const aliasEntry = {
      id,
      alias,
      command,
      description,
      type: 'alias',
      createdAt: new Date().toISOString()
    };

    this.aliases.set(id, aliasEntry);
    return aliasEntry;
  }

  async updateAlias(id, updates) {
    const alias = this.aliases.get(id);
    if (!alias) throw new Error(`Alias not found: ${id}`);

    const updated = { ...alias, ...updates };
    this.aliases.set(id, updated);
    return updated;
  }

  async deleteAlias(id) {
    this.aliases.delete(id);
    return { success: true };
  }

  listAliases() {
    return Array.from(this.aliases.values());
  }

  async resolveAlias(input) {
    const parts = input.trim().split(/\s+/);
    const aliasName = parts[0];

    for (const [, alias] of this.aliases) {
      if (alias.alias === aliasName) {
        return {
          resolved: true,
          command: alias.command + ' ' + parts.slice(1).join(' '),
          original: input
        };
      }
    }

    return { resolved: false, command: input, original: input };
  }

  async addScript(params) {
    const { name, description = '', commands = [], platform = 'all' } = params;

    const id = uuidv4();
    const script = {
      id,
      name,
      description,
      commands,
      platform,
      runCount: 0,
      lastRun: null,
      type: 'script',
      createdAt: new Date().toISOString()
    };

    this.scripts.set(id, script);
    return script;
  }

  async updateScript(id, updates) {
    const script = this.scripts.get(id);
    if (!script) throw new Error(`Script not found: ${id}`);

    const updated = { ...script, ...updates };
    this.scripts.set(id, updated);
    return updated;
  }

  async deleteScript(id) {
    this.scripts.delete(id);
    return { success: true };
  }

  async runScript(id) {
    const script = this.scripts.get(id);
    if (!script) throw new Error(`Script not found: ${id}`);

    script.runCount = (script.runCount || 0) + 1;
    script.lastRun = new Date().toISOString();
    this.scripts.set(id, script);

    return {
      script,
      commands: script.commands
    };
  }

  listScripts(options = {}) {
    const { platform } = options;
    let scripts = Array.from(this.scripts.values());

    if (platform) {
      scripts = scripts.filter(s => s.platform === 'all' || s.platform === platform);
    }

    return scripts;
  }

  getCommonCommands() {
    return [
      { category: 'Navigation', commands: [
        { cmd: 'ls', desc: 'List directory contents' },
        { cmd: 'cd', desc: 'Change directory' },
        { cmd: 'pwd', desc: 'Print working directory' },
        { cmd: 'find', desc: 'Find files' }
      ]},
      { category: 'File Operations', commands: [
        { cmd: 'cp', desc: 'Copy files' },
        { cmd: 'mv', desc: 'Move files' },
        { cmd: 'rm', desc: 'Remove files' },
        { cmd: 'mkdir', desc: 'Create directory' },
        { cmd: 'touch', desc: 'Create empty file' }
      ]},
      { category: 'Text Processing', commands: [
        { cmd: 'cat', desc: 'Display file contents' },
        { cmd: 'grep', desc: 'Search text' },
        { cmd: 'sed', desc: 'Stream editor' },
        { cmd: 'awk', desc: 'Pattern scanning' }
      ]},
      { category: 'System', commands: [
        { cmd: 'ps', desc: 'Process status' },
        { cmd: 'top', desc: 'System monitor' },
        { cmd: 'df', desc: 'Disk free space' },
        { cmd: 'du', desc: 'Directory usage' }
      ]}
    ];
  }

  async getStats() {
    return {
      historySize: this.history.size,
      aliases: this.aliases.size,
      scripts: this.scripts.size,
      recentCommands: this.getHistory(5)
    };
  }

  async exportTerminal(format = 'json') {
    const data = {
      history: Array.from(this.history.values()),
      aliases: Array.from(this.aliases.values()),
      scripts: Array.from(this.scripts.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = TerminalEngine;
