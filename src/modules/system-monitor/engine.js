const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class SystemMonitorEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.metrics = new Map();
    this.alerts = new Map();
    this.monitorDir = path.join(os.homedir(), '.pix/system-monitor');
  }

  async initialize() {
    this.logger.info('Initializing System Monitor Engine...');
    await fs.ensureDir(this.monitorDir);
    await this.loadMonitor();
    this.loadAlertThresholds();
    this.logger.info('System Monitor Engine initialized');
  }

  async loadMonitor() {
    try {
      const files = await fs.readdir(this.monitorDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.monitorDir, file));
          if (data.type === 'alert') this.alerts.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadAlertThresholds() {
    this.thresholds = {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 70, critical: 90 },
      disk: { warning: 80, critical: 95 },
      temperature: { warning: 70, critical: 85 }
    };
  }

  async getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      cpus: os.cpus(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      memoryUsage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
      networkInterfaces: os.networkInterfaces(),
      loadAverage: os.loadavg()
    };
  }

  async getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - (idle / total * 100);

    return {
      usage: Math.round(usage * 100) / 100,
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      speed: cpus[0]?.speed || 0
    };
  }

  async getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      total,
      free,
      used,
      usagePercent: Math.round((used / total) * 100),
      totalFormatted: this.formatBytes(total),
      freeFormatted: this.formatBytes(free),
      usedFormatted: this.formatBytes(used)
    };
  }

  async getDiskUsage() {
    const stats = {
      total: 0,
      used: 0,
      free: 0,
      partitions: []
    };

    try {
      const { execSync } = require('child_process');
      let output;

      if (os.platform() === 'win32') {
        output = execSync('wmic logicaldisk get size,freespace,caption /format:csv', { encoding: 'utf-8' });
      } else {
        output = execSync('df -k', { encoding: 'utf-8' });
      }

      const lines = output.trim().split('\n').slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const partition = {
            filesystem: parts[0],
            size: parseInt(parts[1]) * 1024,
            used: parseInt(parts[2]) * 1024,
            available: parseInt(parts[3]) * 1024,
            mountpoint: parts[5] || '/'
          };
          partition.usagePercent = Math.round((partition.used / partition.size) * 100);
          stats.partitions.push(partition);
          stats.total += partition.size;
          stats.used += partition.used;
          stats.free += partition.available;
        }
      }
    } catch (e) {
      stats.error = 'Unable to get disk usage';
    }

    stats.totalFormatted = this.formatBytes(stats.total);
    stats.usedFormatted = this.formatBytes(stats.used);
    stats.freeFormatted = this.formatBytes(stats.free);
    stats.usagePercent = stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0;

    return stats;
  }

  async getNetworkStats() {
    const interfaces = os.networkInterfaces();
    const stats = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
      for (const addr of addresses) {
        if (!addr.internal) {
          stats.push({
            interface: name,
            address: addr.address,
            family: addr.family,
            mac: addr.mac
          });
        }
      }
    }

    return {
      interfaces: stats,
      hostname: os.hostname()
    };
  }

  async getProcessList() {
    try {
      const { execSync } = require('child_process');
      let output;

      if (os.platform() === 'win32') {
        output = execSync('tasklist /fo csv /nh', { encoding: 'utf-8' });
      } else {
        output = execSync('ps aux --sort=-%cpu | head -20', { encoding: 'utf-8' });
      }

      return output;
    } catch (e) {
      return 'Unable to get process list';
    }
  }

  async createAlert(params) {
    const { type, message, threshold, value } = params;

    const id = uuidv4();
    const alert = {
      id,
      type,
      message,
      threshold,
      value,
      acknowledged: false,
      type: 'alert',
      createdAt: new Date().toISOString()
    };

    this.alerts.set(id, alert);
    return alert;
  }

  async acknowledgeAlert(id) {
    const alert = this.alerts.get(id);
    if (!alert) throw new Error(`Alert not found: ${id}`);

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date().toISOString();
    this.alerts.set(id, alert);
    return alert;
  }

  async deleteAlert(id) {
    this.alerts.delete(id);
    return { success: true };
  }

  getAlerts(options = {}) {
    const { type, acknowledged } = options;
    let alerts = Array.from(this.alerts.values());

    if (type) alerts = alerts.filter(a => a.type === type);
    if (acknowledged !== undefined) alerts = alerts.filter(a => a.acknowledged === acknowledged);

    return alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async checkThresholds() {
    const cpu = await this.getCpuUsage();
    const memory = await this.getMemoryUsage();
    const disk = await this.getDiskUsage();

    const alerts = [];

    if (cpu.usage >= this.thresholds.cpu.critical) {
      alerts.push({ type: 'cpu', level: 'critical', value: cpu.usage, threshold: this.thresholds.cpu.critical });
    } else if (cpu.usage >= this.thresholds.cpu.warning) {
      alerts.push({ type: 'cpu', level: 'warning', value: cpu.usage, threshold: this.thresholds.cpu.warning });
    }

    if (memory.usagePercent >= this.thresholds.memory.critical) {
      alerts.push({ type: 'memory', level: 'critical', value: memory.usagePercent, threshold: this.thresholds.memory.critical });
    } else if (memory.usagePercent >= this.thresholds.memory.warning) {
      alerts.push({ type: 'memory', level: 'warning', value: memory.usagePercent, threshold: this.thresholds.memory.warning });
    }

    if (disk.usagePercent >= this.thresholds.disk.critical) {
      alerts.push({ type: 'disk', level: 'critical', value: disk.usagePercent, threshold: this.thresholds.disk.critical });
    } else if (disk.usagePercent >= this.thresholds.disk.warning) {
      alerts.push({ type: 'disk', level: 'warning', value: disk.usagePercent, threshold: this.thresholds.disk.warning });
    }

    return alerts;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async getFullStats() {
    const [cpu, memory, disk, network] = await Promise.all([
      this.getCpuUsage(),
      this.getMemoryUsage(),
      this.getDiskUsage(),
      this.getNetworkStats()
    ]);

    return {
      system: await this.getSystemInfo(),
      cpu,
      memory,
      disk,
      network,
      alerts: this.getAlerts({ acknowledged: false }),
      thresholds: this.thresholds
    };
  }

  async exportMonitor(format = 'json') {
    const data = {
      alerts: Array.from(this.alerts.values()),
      thresholds: this.thresholds
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = SystemMonitorEngine;
