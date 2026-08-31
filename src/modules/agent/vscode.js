const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec, execSync } = require('child_process');

class VSCodeSpacesConnector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.connections = new Map();
    this.workspaces = new Map();
    this.extensions = new Map();
    this.connectorDir = path.join(os.homedir(), '.pix/vscode');

    this.connectionTypes = [
      { id: 'local', name: 'Local VS Code', icon: '💻', description: 'Connect to locally installed VS Code' },
      { id: 'remote-ssh', name: 'Remote SSH', icon: '🔗', description: 'Connect to remote machine via SSH' },
      { id: 'remote-container', name: 'Dev Container', icon: '🐳', description: 'Connect to Docker dev container' },
      { id: 'remote-wsl', name: 'WSL', icon: '🐧', description: 'Connect to Windows Subsystem for Linux' },
      { id: 'codespaces', name: 'GitHub Codespaces', icon: '🐙', description: 'Connect to GitHub Codespaces' },
      { id: 'gitpod', name: 'Gitpod', icon: '🦊', description: 'Connect to Gitpod workspace' },
      { id: 'replit', name: 'Replit', icon: '🔄', description: 'Connect to Replit environment' },
      { id: 'cursor', name: 'Cursor', icon: '✨', description: 'Connect to Cursor editor' }
    ];

    this.recommendedExtensions = [
      { id: 'pix-assist', name: 'Pix Assist', description: 'AI-powered coding assistance', icon: '🤖', category: 'AI' },
      { id: 'prettier', name: 'Prettier', description: 'Code formatter', icon: '✨', category: 'Formatting' },
      { id: 'eslint', name: 'ESLint', description: 'JavaScript linter', icon: '🔍', category: 'Linting' },
      { id: 'gitlens', name: 'GitLens', description: 'Git supercharged', icon: '🔍', category: 'Git' },
      { id: 'copilot', name: 'GitHub Copilot', description: 'AI pair programmer', icon: '🤖', category: 'AI' },
      { id: 'indent-rainbow', name: 'Indent Rainbow', description: 'Colorful indent guides', icon: '🌈', category: 'Visual' },
      { id: 'bracket-pair', name: 'Bracket Pair Colorizer', description: 'Matching brackets', icon: '🔗', category: 'Visual' },
      { id: 'auto-rename', name: 'Auto Rename Tag', description: 'Rename paired tags', icon: '🏷️', category: 'HTML' },
      { id: 'path-intellisense', name: 'Path Intellisense', description: 'Autocomplete paths', icon: '📁', category: 'IntelliSense' },
      { id: 'docker', name: 'Docker', description: 'Docker support', icon: '🐳', category: 'DevOps' },
      { id: 'kubernetes', name: 'Kubernetes', description: 'K8s support', icon: '☸️', category: 'DevOps' },
      { id: 'remote-ssh', name: 'Remote - SSH', description: 'SSH remote development', icon: '🔗', category: 'Remote' },
      { id: 'live-server', name: 'Live Server', description: 'Local dev server', icon: '🌐', category: 'Web' },
      { id: 'copilot-chat', name: 'Copilot Chat', description: 'AI chat in editor', icon: '💬', category: 'AI' }
    ];

    this.cursorFeatures = [
      { id: 'ai-edit', name: 'AI Edit', description: 'Edit code with AI instructions', icon: '✏️' },
      { id: 'ai-chat', name: 'AI Chat', description: 'Chat with AI about code', icon: '💬' },
      { id: 'ai-complete', name: 'AI Complete', description: 'AI-powered autocomplete', icon: '✨' },
      { id: 'ai-debug', name: 'AI Debug', description: 'AI-assisted debugging', icon: '🐛' },
      { id: 'ai-refactor', name: 'AI Refactor', description: 'AI code refactoring', icon: '♻️' },
      { id: 'multi-file', name: 'Multi-File Context', description: 'AI understands entire codebase', icon: '📂' },
      { id: 'codebase-aware', name: 'Codebase Aware', description: 'AI uses project context', icon: '🧠' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing VS Code & Spaces Connector...');
    await fs.ensureDir(this.connectorDir);
    await this.loadData();
    await this.detectVSCodeInstallations();
    this.loadWorkspacePresets();
    this.logger.info('VS Code & Spaces Connector initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.connectorDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.connectorDir, file));
          if (data.type === 'connection') this.connections.set(data.id, data);
          else if (data.type === 'workspace') this.workspaces.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadWorkspacePresets() {
    this.workspacePresets = [
      { id: 'node', name: 'Node.js', icon: '🟢', extensions: ['eslint', 'prettier', 'auto-rename-tag'], settings: { 'editor.formatOnSave': true } },
      { id: 'python', name: 'Python', icon: '🐍', extensions: ['ms-python.python', 'ms-python.vscode-pylance'], settings: { 'python.linting.enabled': true } },
      { id: 'rust', name: 'Rust', icon: '🦀', extensions: ['rust-lang.rust-analyzer'], settings: { 'rust-analyzer.checkOnSave.command': 'clippy' } },
      { id: 'go', name: 'Go', icon: '🔵', extensions: ['golang.go'], settings: { 'go.useLanguageServer': true } },
      { id: 'java', name: 'Java', icon: '☕', extensions: ['vscjava.vscode-java-pack'], settings: {} },
      { id: 'react', name: 'React', icon: '⚛️', extensions: ['dsznajder.es7-react-js-snippets', 'esbenp.prettier-vscode'], settings: {} },
      { id: 'vue', name: 'Vue', icon: '💚', extensions: ['Vue.volar'], settings: {} },
      { id: 'fullstack', name: 'Full Stack', icon: '🌐', extensions: ['prettier', 'eslint', 'live-server', 'docker'], settings: {} }
    ];
  }

  async detectVSCodeInstallations() {
    const installations = [];

    const paths = [
      '/Applications/Visual Studio Code.app',
      path.join(os.homedir(), '.vscode'),
      'code'
    ];

    for (const vsPath of paths) {
      try {
        const exists = await fs.pathExists(vsPath);
        if (exists) {
          installations.push({
            path: vsPath,
            type: 'detected',
            version: await this.getVSCodeVersion(vsPath)
          });
        }
      } catch (e) {}
    }

    try {
      const codePath = execSync('which code 2>/dev/null || echo ""').toString().trim();
      if (codePath) {
        installations.push({
          path: codePath,
          type: 'cli',
          version: await this.getVSCodeVersion(codePath)
        });
      }
    } catch (e) {}

    return installations;
  }

  async getVSCodeVersion(vsPath) {
    try {
      if (vsPath.includes('.app')) {
        const plistPath = path.join(vsPath, 'Contents', 'Info.plist');
        if (await fs.pathExists(plistPath)) {
          return 'installed';
        }
      }
      return 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  async createConnection(params) {
    const {
      name,
      type = 'local',
      host = null,
      port = 22,
      username = null,
      workspacePath = null,
      settings = {},
      extensions = []
    } = params;

    const id = uuidv4();
    const connection = {
      id,
      name,
      type,
      host,
      port,
      username,
      workspacePath,
      settings,
      extensions,
      status: 'disconnected',
      lastConnected: null,
      type: 'connection',
      createdAt: new Date().toISOString()
    };

    this.connections.set(id, connection);
    await this.saveConnection(connection);

    return connection;
  }

  async connect(id) {
    const connection = this.connections.get(id);
    if (!connection) throw new Error(`Connection not found: ${id}`);

    connection.status = 'connected';
    connection.lastConnected = new Date().toISOString();
    this.connections.set(id, connection);
    await this.saveConnection(connection);

    return connection;
  }

  async disconnect(id) {
    const connection = this.connections.get(id);
    if (!connection) throw new Error(`Connection not found: ${id}`);

    connection.status = 'disconnected';
    this.connections.set(id, connection);
    await this.saveConnection(connection);

    return connection;
  }

  async openInVSCode(filePath, connectionId = null) {
    const command = `code "${filePath}"`;
    try {
      exec(command);
      return { success: true, command, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async openWorkspace(workspacePath, connectionId = null) {
    const command = `code "${workspacePath}"`;
    try {
      exec(command);
      return { success: true, command, workspacePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async installExtensions(extensionIds) {
    const results = [];
    for (const extId of extensionIds) {
      try {
        execSync(`code --install-extension ${extId}`);
        results.push({ id: extId, success: true });
      } catch (error) {
        results.push({ id: extId, success: false, error: error.message });
      }
    }
    return results;
  }

  async getInstalledExtensions() {
    try {
      const output = execSync('code --list-extensions 2>/dev/null || echo ""').toString();
      return output.split('\n').filter(e => e.trim());
    } catch (e) {
      return [];
    }
  }

  async createWorkspace(params) {
    const {
      name,
      path: workspacePath,
      preset = null,
      customExtensions = [],
      customSettings = {}
    } = params;

    const id = uuidv4();
    let extensions = customExtensions;
    let settings = customSettings;

    if (preset) {
      const presetData = this.workspacePresets.find(p => p.id === preset);
      if (presetData) {
        extensions = [...new Set([...extensions, ...presetData.extensions])];
        settings = { ...settings, ...presetData.settings };
      }
    }

    const workspace = {
      id,
      name,
      path: workspacePath,
      preset,
      extensions,
      settings,
      isOpen: false,
      lastOpened: null,
      type: 'workspace',
      createdAt: new Date().toISOString()
    };

    this.workspaces.set(id, workspace);
    await this.saveWorkspace(workspace);

    return workspace;
  }

  async applyWorkspacePreset(workspaceId, presetId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

    const preset = this.workspacePresets.find(p => p.id === presetId);
    if (!preset) throw new Error(`Preset not found: ${presetId}`);

    workspace.extensions = [...new Set([...workspace.extensions, ...preset.extensions])];
    workspace.settings = { ...workspace.settings, ...preset.settings };
    workspace.preset = presetId;

    this.workspaces.set(workspaceId, workspace);
    await this.saveWorkspace(workspace);

    return workspace;
  }

  async generateVSCodeSettings(settings) {
    const settingsJson = JSON.stringify(settings, null, 2);
    return settingsJson;
  }

  async createSettingsFile(workspacePath, settings) {
    const vscodeDir = path.join(workspacePath, '.vscode');
    await fs.ensureDir(vscodeDir);
    const settingsPath = path.join(vscodeDir, 'settings.json');
    await fs.writeJson(settingsPath, settings, { spaces: 2 });
    return settingsPath;
  }

  async createLaunchConfig(workspacePath, configs) {
    const vscodeDir = path.join(workspacePath, '.vscode');
    await fs.ensureDir(vscodeDir);
    const launchPath = path.join(vscodeDir, 'launch.json');
    await fs.writeJson(launchPath, { version: '0.2.0', configurations: configs }, { spaces: 2 });
    return launchPath;
  }

  async createTasksConfig(workspacePath, tasks) {
    const vscodeDir = path.join(workspacePath, '.vscode');
    await fs.ensureDir(vscodeDir);
    const tasksPath = path.join(vscodeDir, 'tasks.json');
    await fs.writeJson(tasksPath, { version: '2.0.0', tasks }, { spaces: 2 });
    return tasksPath;
  }

  async createExtensionsFile(workspacePath, extensions) {
    const vscodeDir = path.join(workspacePath, '.vscode');
    await fs.ensureDir(vscodeDir);
    const extPath = path.join(vscodeDir, 'extensions.json');
    await fs.writeJson(extPath, { recommendations: extensions }, { spaces: 2 });
    return extPath;
  }

  async getCursorFeatures() {
    return this.cursorFeatures;
  }

  async getRecommendedExtensions() {
    return this.recommendedExtensions;
  }

  async getConnectionTypes() {
    return this.connectionTypes;
  }

  async getWorkspacePresets() {
    return this.workspacePresets;
  }

  async getConnection(id) {
    return this.connections.get(id);
  }

  listConnections() {
    return Array.from(this.connections.values());
  }

  async getWorkspace(id) {
    return this.workspaces.get(id);
  }

  listWorkspaces() {
    return Array.from(this.workspaces.values());
  }

  async getStats() {
    const connections = Array.from(this.connections.values());
    const workspaces = Array.from(this.workspaces.values());

    return {
      connections: connections.length,
      activeConnections: connections.filter(c => c.status === 'connected').length,
      workspaces: workspaces.length,
      installedExtensions: (await this.getInstalledExtensions()).length
    };
  }

  async saveConnection(connection) {
    const filePath = path.join(this.connectorDir, `conn-${connection.id}.json`);
    await fs.writeJson(filePath, connection, { spaces: 2 });
  }

  async saveWorkspace(workspace) {
    const filePath = path.join(this.connectorDir, `ws-${workspace.id}.json`);
    await fs.writeJson(filePath, workspace, { spaces: 2 });
  }

  async exportConnector(format = 'json') {
    const data = {
      connections: Array.from(this.connections.values()),
      workspaces: Array.from(this.workspaces.values()),
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = VSCodeSpacesConnector;
