const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn, exec, execSync } = require('child_process');

class CustomTerminalEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.history = new Map();
    this.aliases = new Map();
    this.scripts = new Map();
    this.snippets = new Map();
    this.terminalDir = path.join(os.homedir(), '.pix/terminal');
    this.currentDir = os.homedir();
  }

  async initialize() {
    this.logger.info('Initializing Custom Terminal Engine...');
    await fs.ensureDir(this.terminalDir);
    await this.loadSessions();
    this.loadHistory();
    this.loadAliases();
    this.loadSnippets();
    this.loadPresets();
    this.logger.info('Custom Terminal Engine initialized');
  }

  async loadSessions() {
    try {
      const files = await fs.readdir(this.terminalDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.terminalDir, file));
          if (data.type === 'session') this.sessions.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadHistory() {
    try {
      const historyPath = path.join(this.terminalDir, 'history.json');
      if (fs.existsSync(historyPath)) {
        const data = fs.readJsonSync(historyPath);
        if (Array.isArray(data)) {
          data.forEach(entry => this.history.set(entry.id, entry));
        }
      }
    } catch (e) {}
  }

  loadAliases() {
    const defaults = [
      { name: 'll', command: 'ls -la', description: 'List all files with details' },
      { name: 'la', command: 'ls -A', description: 'List all files including hidden' },
      { name: '..', command: 'cd ..', description: 'Go up one directory' },
      { name: '...', command: 'cd ../..', description: 'Go up two directories' },
      { name: 'cls', command: 'clear', description: 'Clear terminal' },
      { name: 'h', command: 'history', description: 'Show command history' },
      { name: 'mkcd', command: 'mkdir -p "$1" && cd "$1"', description: 'Create directory and enter it' },
      { name: 'extract', command: 'tar -xf "$1"', description: 'Extract tar archive' },
      { name: 'ports', command: 'netstat -tuln', description: 'Show open ports' },
      { name: 'myip', command: 'curl -s ifconfig.me', description: 'Show public IP' },
      { name: 'weather', command: 'curl -s "wttr.in/?format=3"', description: 'Show weather' },
      { name: 'dict', command: 'curl -s "dict://$1"', description: 'Dictionary lookup' },
      { name: 'calc', command: 'echo "scale=2; $1" | bc', description: 'Calculator' },
      { name: 'json', command: 'python3 -m json.tool', description: 'Pretty print JSON' },
      { name: 'xml', command: 'xmllint --format -', description: 'Format XML' }
    ];

    defaults.forEach(alias => {
      if (!this.aliases.has(alias.name)) {
        this.aliases.set(alias.name, { ...alias, builtin: true });
      }
    });
  }

  loadSnippets() {
    const defaults = [
      {
        id: 'git-init',
        name: 'Git Initialize',
        command: 'git init && git add . && git commit -m "Initial commit"',
        tags: ['git', 'setup'],
        description: 'Initialize git repository with first commit'
      },
      {
        id: 'git-status',
        name: 'Git Status',
        command: 'git status',
        tags: ['git'],
        description: 'Check git repository status'
      },
      {
        id: 'git-log',
        name: 'Git Log',
        command: 'git log --oneline -20',
        tags: ['git'],
        description: 'Show last 20 commits'
      },
      {
        id: 'docker-ps',
        name: 'Docker Containers',
        command: 'docker ps -a',
        tags: ['docker'],
        description: 'List all Docker containers'
      },
      {
        id: 'docker-images',
        name: 'Docker Images',
        command: 'docker images',
        tags: ['docker'],
        description: 'List all Docker images'
      },
      {
        id: 'npm-install',
        name: 'NPM Install All',
        command: 'npm install && npm audit fix',
        tags: ['npm', 'node'],
        description: 'Install and fix dependencies'
      },
      {
        id: 'yarn-install',
        name: 'Yarn Install',
        command: 'yarn install --frozen-lockfile',
        tags: ['yarn', 'node'],
        description: 'Install dependencies with yarn'
      },
      {
        id: 'python-server',
        name: 'Python HTTP Server',
        command: 'python3 -m http.server 8000',
        tags: ['python', 'server'],
        description: 'Start Python HTTP server on port 8000'
      },
      {
        id: 'node-server',
        name: 'Node Server',
        command: 'node server.js',
        tags: ['node', 'server'],
        description: 'Start Node.js server'
      },
      {
        id: 'find-large',
        name: 'Find Large Files',
        command: 'find . -type f -size +100M -exec ls -lh {} \\;',
        tags: ['files', 'cleanup'],
        description: 'Find files larger than 100MB'
      },
      {
        id: 'disk-usage',
        name: 'Disk Usage',
        command: 'du -sh * | sort -rh | head -20',
        tags: ['system', 'disk'],
        description: 'Show disk usage by directory'
      },
      {
        id: 'process-list',
        name: 'Process List',
        command: 'ps aux | grep -v grep | sort -nrk 3,3 | head -20',
        tags: ['system', 'process'],
        description: 'Show top 20 processes by CPU'
      },
      {
        id: 'network-connections',
        name: 'Network Connections',
        command: 'netstat -an | grep ESTABLISHED | awk \'{print $5}\' | cut -d: -f1 | sort | uniq -c | sort -nr',
        tags: ['network'],
        description: 'Show network connections by IP'
      },
      {
        id: 'backup-db',
        name: 'Backup Database',
        command: 'mysqldump -u root -p --all-databases > backup_$(date +%Y%m%d_%H%M%S).sql',
        tags: ['database', 'backup'],
        description: 'Backup all MySQL databases'
      },
      {
        id: 'clean-cache',
        name: 'Clean Cache',
        command: 'sudo apt-get clean && sudo apt-get autoremove',
        tags: ['cleanup', 'linux'],
        description: 'Clean package manager cache'
      }
    ];

    defaults.forEach(snippet => {
      this.snippets.set(snippet.id, { ...snippet, type: 'snippet' });
    });
  }

  loadPresets() {
    this.presets = [
      { id: 'bash', name: 'Bash', icon: '🐚', shell: '/bin/bash', env: { TERM: 'xterm-256color' } },
      { id: 'zsh', name: 'Zsh', icon: '🔮', shell: '/bin/zsh', env: { TERM: 'xterm-256color' } },
      { id: 'fish', name: 'Fish', icon: '🐟', shell: '/usr/local/bin/fish', env: { TERM: 'xterm-256color' } },
      { id: 'powershell', name: 'PowerShell', icon: '🔷', shell: 'pwsh', env: {} },
      { id: 'cmd', name: 'Command Prompt', icon: '💻', shell: 'cmd.exe', env: {} },
      { id: 'node', name: 'Node.js REPL', icon: '🟢', shell: 'node', env: { NODE_NO_WARNINGS: '1' } },
      { id: 'python', name: 'Python REPL', icon: '🐍', shell: 'python3', env: { PYTHONSTARTUP: '' } },
      { id: 'ruby', name: 'Ruby REPL', icon: '💎', shell: 'irb', env: {} }
    ];
  }

  async createSession(params = {}) {
    const {
      name,
      preset = 'bash',
      cwd = os.homedir(),
      env = {},
      historySize = 10000,
      fontSize = 14,
      fontFamily = 'Menlo, Monaco, monospace',
      theme = 'dark'
    } = params;

    const id = uuidv4();
    const presetData = this.presets.find(p => p.id === preset) || this.presets[0];

    const session = {
      id,
      name: name || `Terminal ${id.slice(0, 8)}`,
      preset,
      shell: presetData.shell,
      cwd,
      env: { ...presetData.env, ...env },
      historySize,
      fontSize,
      fontFamily,
      theme,
      status: 'created',
      output: [],
      history: [],
      bookmarks: [],
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
    await fs.remove(path.join(this.terminalDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getSession(id) {
    return this.sessions.get(id);
  }

  listSessions() {
    return Array.from(this.sessions.values());
  }

  async executeCommand(sessionId, command, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const commandId = uuidv4();
    const startTime = Date.now();

    const entry = {
      id: commandId,
      sessionId,
      command,
      options,
      output: '',
      error: '',
      exitCode: null,
      duration: 0,
      timestamp: new Date().toISOString()
    };

    const historyEntry = {
      id: commandId,
      sessionId,
      command,
      cwd: session.cwd,
      timestamp: new Date().toISOString()
    };

    this.history.set(commandId, historyEntry);

    return new Promise((resolve) => {
      const timeout = options.timeout || 30000;
      const maxBuffer = options.maxBuffer || 1024 * 1024 * 10;

      let processedCommand = command;
      for (const [name, alias] of this.aliases) {
        if (command.startsWith(name + ' ') || command === name) {
          processedCommand = command.replace(name, alias.command);
          break;
        }
      }

      const env = {
        ...process.env,
        ...session.env,
        HOME: os.homedir(),
        TERM: session.env.TERM || 'xterm-256color',
        COLORTERM: 'truecolor',
        PIX_SESSION: session.id
      };

      exec(processedCommand, {
        cwd: session.cwd,
        env,
        timeout,
        maxBuffer
      }, (error, stdout, stderr) => {
        entry.duration = Date.now() - startTime;
        entry.output = stdout || '';
        entry.error = stderr || (error ? error.message : '');
        entry.exitCode = error ? error.code || 1 : 0;

        session.output.push(entry);
        if (session.output.length > 1000) {
          session.output = session.output.slice(-500);
        }

        session.history.push(commandId);
        this.sessions.set(sessionId, session);

        this.saveHistory();

        resolve(entry);
      });
    });
  }

  async executeStream(sessionId, command, onData) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const commandId = uuidv4();
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        cwd: session.cwd,
        env: { ...process.env, ...session.env },
        shell: true
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        if (onData) onData({ type: 'stdout', data: chunk });
      });

      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        error += chunk;
        if (onData) onData({ type: 'stderr', data: chunk });
      });

      child.on('close', (code) => {
        const entry = {
          id: commandId,
          sessionId,
          command,
          output,
          error,
          exitCode: code,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };

        session.output.push(entry);
        session.history.push(commandId);
        this.sessions.set(sessionId, session);

        resolve(entry);
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  async changeDirectory(sessionId, newDir) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const resolvedPath = path.resolve(session.cwd, newDir);
    const exists = await fs.pathExists(resolvedPath);

    if (!exists) {
      throw new Error(`Directory not found: ${resolvedPath}`);
    }

    const stat = await fs.stat(resolvedPath);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${resolvedPath}`);
    }

    session.cwd = resolvedPath;
    this.sessions.set(sessionId, session);

    return { cwd: session.cwd };
  }

  async getOutput(sessionId, limit = 100) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    return session.output.slice(-limit);
  }

  async clearOutput(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.output = [];
    this.sessions.set(sessionId, session);
    return { success: true };
  }

  async searchHistory(query, sessionId = null) {
    const queryLower = query.toLowerCase();
    let history = Array.from(this.history.values());

    if (sessionId) {
      history = history.filter(h => h.sessionId === sessionId);
    }

    return history
      .filter(h => h.command.toLowerCase().includes(queryLower))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async createAlias(name, command, description = '') {
    const alias = { name, command, description, builtin: false };
    this.aliases.set(name, alias);
    return alias;
  }

  async deleteAlias(name) {
    this.aliases.delete(name);
    return { success: true };
  }

  listAliases() {
    return Array.from(this.aliases.values());
  }

  async createSnippet(params) {
    const { name, command, description = '', tags = [] } = params;

    const id = uuidv4();
    const snippet = {
      id,
      name,
      command,
      description,
      tags,
      useCount: 0,
      type: 'snippet',
      createdAt: new Date().toISOString()
    };

    this.snippets.set(id, snippet);
    return snippet;
  }

  async deleteSnippet(id) {
    this.snippets.delete(id);
    return { success: true };
  }

  listSnippets() {
    return Array.from(this.snippets.values());
  }

  async executeSnippet(id, sessionId) {
    const snippet = this.snippets.get(id);
    if (!snippet) throw new Error(`Snippet not found: ${id}`);

    snippet.useCount++;
    this.snippets.set(id, snippet);

    return this.executeCommand(sessionId, snippet.command);
  }

  async addBookmark(sessionId, name, cwd = null) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const bookmark = {
      id: uuidv4(),
      name,
      cwd: cwd || session.cwd,
      createdAt: new Date().toISOString()
    };

    session.bookmarks.push(bookmark);
    this.sessions.set(sessionId, session);

    return bookmark;
  }

  async removeBookmark(sessionId, bookmarkId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.bookmarks = session.bookmarks.filter(b => b.id !== bookmarkId);
    this.sessions.set(sessionId, session);

    return { success: true };
  }

  async getBookmarks(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return session.bookmarks;
  }

  async suggestCommand(partial) {
    const suggestions = [];
    const partialLower = partial.toLowerCase();

    for (const [name, alias] of this.aliases) {
      if (name.toLowerCase().includes(partialLower)) {
        suggestions.push({
          type: 'alias',
          name,
          command: alias.command,
          description: alias.description
        });
      }
    }

    for (const [, snippet] of this.snippets) {
      if (snippet.name.toLowerCase().includes(partialLower) ||
          snippet.command.toLowerCase().includes(partialLower)) {
        suggestions.push({
          type: 'snippet',
          id: snippet.id,
          name: snippet.name,
          command: snippet.command,
          description: snippet.description
        });
      }
    }

    const commonCommands = [
      { cmd: 'ls', desc: 'List directory contents' },
      { cmd: 'cd', desc: 'Change directory' },
      { cmd: 'pwd', desc: 'Print working directory' },
      { cmd: 'mkdir', desc: 'Make directory' },
      { cmd: 'rmdir', desc: 'Remove directory' },
      { cmd: 'touch', desc: 'Create empty file' },
      { cmd: 'cp', desc: 'Copy file' },
      { cmd: 'mv', desc: 'Move file' },
      { cmd: 'rm', desc: 'Remove file' },
      { cmd: 'cat', desc: 'Display file contents' },
      { cmd: 'head', desc: 'Display first lines' },
      { cmd: 'tail', desc: 'Display last lines' },
      { cmd: 'grep', desc: 'Search text patterns' },
      { cmd: 'find', desc: 'Find files' },
      { cmd: 'sort', desc: 'Sort lines' },
      { cmd: 'uniq', desc: 'Filter duplicate lines' },
      { cmd: 'wc', desc: 'Word count' },
      { cmd: 'echo', desc: 'Display text' },
      { cmd: 'date', desc: 'Display date/time' },
      { cmd: 'whoami', desc: 'Display current user' },
      { cmd: 'which', desc: 'Locate command' },
      { cmd: 'man', desc: 'Manual pages' },
      { cmd: 'chmod', desc: 'Change permissions' },
      { cmd: 'chown', desc: 'Change ownership' },
      { cmd: 'ps', desc: 'Process status' },
      { cmd: 'top', desc: 'Process monitor' },
      { cmd: 'kill', desc: 'Terminate process' },
      { cmd: 'df', desc: 'Disk free space' },
      { cmd: 'du', desc: 'Disk usage' },
      { cmd: 'free', desc: 'Memory usage' },
      { cmd: 'uname', desc: 'System information' },
      { cmd: 'curl', desc: 'HTTP requests' },
      { cmd: 'wget', desc: 'Download files' },
      { cmd: 'git', desc: 'Git version control' },
      { cmd: 'npm', desc: 'Node package manager' },
      { cmd: 'yarn', desc: 'Yarn package manager' },
      { cmd: 'docker', desc: 'Docker container management' },
      { cmd: 'ssh', desc: 'Secure shell' },
      { cmd: 'scp', desc: 'Secure copy' },
      { cmd: 'rsync', desc: 'Remote sync' },
      { cmd: 'tar', desc: 'Archive files' },
      { cmd: 'zip', desc: 'Create zip archive' },
      { cmd: 'unzip', desc: 'Extract zip archive' },
      { cmd: 'python3', desc: 'Python interpreter' },
      { cmd: 'node', desc: 'Node.js runtime' },
      { cmd: 'ruby', desc: 'Ruby interpreter' }
    ];

    for (const { cmd, desc } of commonCommands) {
      if (cmd.startsWith(partialLower)) {
        suggestions.push({
          type: 'command',
          name: cmd,
          description: desc
        });
      }
    }

    return suggestions;
  }

  async explainCommand(command) {
    const explanations = {
      'ls': 'Lists directory contents. Use -l for detailed view, -a to show hidden files.',
      'cd': 'Changes the current working directory. Use .. to go up, ~ for home.',
      'grep': 'Searches for patterns in files. Use -r for recursive, -i for case-insensitive.',
      'find': 'Finds files based on criteria. Use -name for name, -type for file type.',
      'curl': 'Transfers data from/to URLs. Useful for API calls and downloads.',
      'git': 'Version control system. Use add, commit, push, pull for basic workflow.',
      'docker': 'Container platform. Use run, build, ps, images for common tasks.',
      'chmod': 'Changes file permissions. Use 755 for executables, 644 for regular files.',
      'ssh': 'Secure shell for remote connections. Use -p for port, -i for key file.',
      'rsync': 'Synchronizes files efficiently. Use -avz for archive mode with compression.'
    };

    const cmdName = command.split(' ')[0];
    const baseExplanation = explanations[cmdName] || `Executes the ${cmdName} command.`;

    const parts = command.split(' ');
    const flags = parts.filter(p => p.startsWith('-'));
    const args = parts.filter(p => !p.startsWith('-') && p !== cmdName);

    let explanation = baseExplanation;

    if (flags.length > 0) {
      explanation += ` Flags used: ${flags.join(', ')}.`;
    }

    if (args.length > 0) {
      explanation += ` Arguments: ${args.join(', ')}.`;
    }

    return {
      command: cmdName,
      explanation,
      flags: flags.map(f => ({ flag: f, description: this.getFlagDescription(cmdName, f) })),
      related: this.getRelatedCommands(cmdName)
    };
  }

  getFlagDescription(cmd, flag) {
    const flags = {
      'ls': { '-l': 'Long format', '-a': 'Show hidden files', '-la': 'Long format with hidden files', '-h': 'Human readable sizes', '-R': 'Recursive' },
      'grep': { '-r': 'Recursive search', '-i': 'Case insensitive', '-n': 'Show line numbers', '-v': 'Invert match', '-c': 'Count matches' },
      'find': { '-name': 'Search by name', '-type': 'Search by type', '-size': 'Search by size', '-mtime': 'Search by modification time' },
      'git': { '-a': 'All files', '-m': 'Message', '-b': 'Branch', '-d': 'Delete', '-f': 'Force' },
      'docker': { '-d': 'Detached mode', '-p': 'Port mapping', '-v': 'Volume mount', '-e': 'Environment variable', '--rm': 'Remove after exit' }
    };

    return flags[cmd]?.[flag] || 'No description available';
  }

  getRelatedCommands(cmd) {
    const related = {
      'ls': ['dir', 'find', 'tree'],
      'cd': ['pushd', 'popd', 'dirs'],
      'grep': ['awk', 'sed', 'find'],
      'find': ['locate', 'which', 'whereis'],
      'git': ['gh', 'svn', 'mercurial'],
      'docker': ['podman', 'kubectl', 'docker-compose'],
      'curl': ['wget', 'httpie', 'fetch'],
      'ssh': ['scp', 'rsync', 'sftp'],
      'cat': ['less', 'more', 'head', 'tail']
    };

    return related[cmd] || [];
  }

  getPresets() {
    return this.presets;
  }

  async getStats() {
    const sessions = Array.from(this.sessions.values());
    const history = Array.from(this.history.values());

    return {
      sessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'running').length,
      commands: history.length,
      aliases: this.aliases.size,
      snippets: this.snippets.size,
      bookmarks: sessions.reduce((sum, s) => sum + s.bookmarks.length, 0)
    };
  }

  async saveSession(session) {
    const filePath = path.join(this.terminalDir, `${session.id}.json`);
    await fs.writeJson(filePath, session, { spaces: 2 });
  }

  async saveHistory() {
    const filePath = path.join(this.terminalDir, 'history.json');
    const historyArray = Array.from(this.history.values()).slice(-10000);
    await fs.writeJson(filePath, historyArray, { spaces: 2 });
  }

  async exportTerminal(format = 'json') {
    const data = {
      sessions: Array.from(this.sessions.values()),
      history: Array.from(this.history.values()),
      aliases: Array.from(this.aliases.values()),
      snippets: Array.from(this.snippets.values()),
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = CustomTerminalEngine;
