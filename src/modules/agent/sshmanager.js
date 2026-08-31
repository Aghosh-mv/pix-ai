const { v4: uuidv4 } = require('uuid');
const os = require('os');

class SSHManagerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.connections = new Map();
    this.keys = new Map();
    this.tunnels = new Map();
    this.history = new Map();

    this.authMethods = [
      { id: 'password', name: 'Password', icon: '🔑', dangerLevel: 'medium', description: 'SSH password authentication' },
      { id: 'key', name: 'SSH Key', icon: '🔐', dangerLevel: 'low', description: 'SSH key pair authentication' },
      { id: 'agent', name: 'SSH Agent', icon: '🤖', dangerLevel: 'low', description: 'SSH agent forwarding' },
      { id: 'certificate', name: 'Certificate', icon: '📜', dangerLevel: 'low', description: 'SSH certificate authentication' },
      { id: 'kerberos', name: 'Kerberos', icon: '🎫', dangerLevel: 'medium', description: 'Kerberos authentication' }
    ];

    this.tunnelTypes = [
      { id: 'local', name: 'Local Tunnel', icon: '⬅️', description: 'Local port forwarding', dangerLevel: 'low' },
      { id: 'remote', name: 'Remote Tunnel', icon: '➡️', description: 'Remote port forwarding', dangerLevel: 'medium' },
      { id: 'dynamic', name: 'Dynamic Tunnel', icon: '🔀', description: 'SOCKS proxy', dangerLevel: 'medium' },
      { id: 'scp', name: 'SCP Transfer', icon: '📤', description: 'Secure file copy', dangerLevel: 'low' },
      { id: 'sftp', name: 'SFTP', icon: '📁', description: 'Secure file transfer', dangerLevel: 'low' }
    ];

    this.presets = [
      { id: 'web-server', name: 'Web Server', host: '', port: 22, user: 'root', description: 'Standard web server' },
      { id: 'database', name: 'Database', host: '', port: 22, user: 'dbadmin', description: 'Database server' },
      { id: 'dev-box', name: 'Dev Box', host: '', port: 22, user: 'developer', description: 'Development machine' },
      { id: 'raspberry', name: 'Raspberry Pi', host: '', port: 22, user: 'pi', description: 'Raspberry Pi' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing SSH Manager Engine...');
    this.loadSettings();
    this.logger.info('SSH Manager Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: false, defaultPort: 22, keepAlive: true, keepAliveInterval: 60000, connectionTimeout: 10000, maxRetries: 3 };
  }

  createConnection(params) {
    const { name, host, port = 22, user, authMethod = 'key', keyPath = null, passphrase = null } = params;
    const id = uuidv4();
    const conn = { id, name, host, port, user, authMethod, keyPath, passphrase, status: 'disconnected', lastConnected: null, commands: [], createdAt: new Date().toISOString() };
    this.connections.set(id, conn);
    return conn;
  }

  async connect(connectionId) {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new Error('Connection not found');
    conn.status = 'connected';
    conn.lastConnected = new Date().toISOString();
    this.connections.set(connectionId, conn);
    return conn;
  }

  async disconnect(connectionId) {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new Error('Connection not found');
    conn.status = 'disconnected';
    this.connections.set(connectionId, conn);
    return conn;
  }

  async executeCommand(connectionId, command) {
    const conn = this.connections.get(connectionId);
    if (!conn) throw new Error('Connection not found');
    const result = { id: uuidv4(), connectionId, command, output: `Output for: ${command}`, exitCode: 0, timestamp: new Date().toISOString() };
    conn.commands.push(result.id);
    this.connections.set(connectionId, conn);
    this.history.set(result.id, result);
    return result;
  }

  async createTunnel(params) {
    const { connectionId, type = 'local', localPort = 0, remoteHost = 'localhost', remotePort = 0 } = params;
    const id = uuidv4();
    const tunnel = { id, connectionId, type, localPort, remoteHost, remotePort, status: 'active', createdAt: new Date().toISOString() };
    this.tunnels.set(id, tunnel);
    return tunnel;
  }

  async addKey(params) {
    const { name, type = 'ed25519', publicKey = '', privateKey = '', comment = '' } = params;
    const id = uuidv4();
    const key = { id, name, type, publicKey, privateKey, comment, createdAt: new Date().toISOString() };
    this.keys.set(id, key);
    return key;
  }

  getConnection(id) { return this.connections.get(id); }
  listConnections() { return Array.from(this.connections.values()); }
  getKey(id) { return this.keys.get(id); }
  listKeys() { return Array.from(this.keys.values()); }
  getTunnel(id) { return this.tunnels.get(id); }
  listTunnels() { return Array.from(this.tunnels.values()); }
  getAuthMethods() { return this.authMethods; }
  getTunnelTypes() { return this.tunnelTypes; }
  getPresets() { return this.presets; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { connections: this.connections.size, active: Array.from(this.connections.values()).filter(c => c.status === 'connected').length, keys: this.keys.size, tunnels: this.tunnels.size, commands: this.history.size };
  }
}

module.exports = SSHManagerEngine;
