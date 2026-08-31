const { v4: uuidv4 } = require('uuid');
const os = require('os');

class SystemMonitorEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.metrics = new Map();
    this.alerts = new Map();
    this.history = new Map();

    this.metricTypes = [
      { id: 'cpu', name: 'CPU Usage', icon: '🖥️', unit: '%', warning: 80, critical: 95 },
      { id: 'memory', name: 'Memory Usage', icon: '🧠', unit: '%', warning: 80, critical: 95 },
      { id: 'disk', name: 'Disk Usage', icon: '💾', unit: '%', warning: 85, critical: 95 },
      { id: 'network-in', name: 'Network In', icon: '📥', unit: 'MB/s', warning: 100, critical: 500 },
      { id: 'network-out', name: 'Network Out', icon: '📤', unit: 'MB/s', warning: 100, critical: 500 },
      { id: 'processes', name: 'Processes', icon: '⚙️', unit: 'count', warning: 500, critical: 1000 },
      { id: 'uptime', name: 'Uptime', icon: '⏰', unit: 'hours', warning: 720, critical: 2160 },
      { id: 'gpu', name: 'GPU Usage', icon: '🎮', unit: '%', warning: 90, critical: 98 }
    ];

    this.alertLevels = [
      { id: 'info', name: 'Info', icon: 'ℹ️', color: '#2196F3' },
      { id: 'warning', name: 'Warning', icon: '⚠️', color: '#FF9800' },
      { id: 'critical', name: 'Critical', icon: '🔴', color: '#F44336' }
    ];

    this.monitorTargets = [
      { id: 'system', name: 'System', icon: '🖥️', description: 'Overall system' },
      { id: 'process', name: 'Process', icon: '⚙️', description: 'Specific process' },
      { id: 'network', name: 'Network', icon: '🌐', description: 'Network interface' },
      { id: 'disk', name: 'Disk', icon: '💾', description: 'Disk I/O' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing System Monitor Engine...');
    this.loadSettings();
    this.logger.info('System Monitor Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, interval: 5000, maxHistory: 1000, alertEnabled: true };
  }

  getSystemMetrics() {
    return {
      cpu: { usage: Math.random() * 50 + 10, cores: os.cpus().length, model: os.cpus()[0]?.model || 'Unknown' },
      memory: { total: os.totalmem(), free: os.freemem(), used: os.totalmem() - os.freemem(), usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(1) },
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      loadAvg: os.loadavg()
    };
  }

  createAlert(params) {
    const { level = 'info', title = '', message = '', metric = '', value = 0, threshold = 0 } = params;
    const id = uuidv4();
    const alert = { id, level, title, message, metric, value, threshold, acknowledged: false, timestamp: new Date().toISOString() };
    this.alerts.set(id, alert);
    return alert;
  }

  getAlert(id) { return this.alerts.get(id); }
  listAlerts(level = null) { let a = Array.from(this.alerts.values()); if (level) a = a.filter(x => x.level === level); return a; }
  getMetricTypes() { return this.metricTypes; }
  getAlertLevels() { return this.alertLevels; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { metrics: this.metrics.size, alerts: this.alerts.size, unacknowledged: Array.from(this.alerts.values()).filter(a => !a.acknowledged).length };
  }
}

module.exports = SystemMonitorEngine;
