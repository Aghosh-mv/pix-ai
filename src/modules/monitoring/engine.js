const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

class MonitoringEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.metrics = new Map();
    this.alerts = new Map();
    this.checks = new Map();
    this.incidents = new Map();
    this.eventEmitter = new EventEmitter();
    this.monitoringDir = path.join(os.homedir(), '.pix/monitoring');
    this.metricsFile = path.join(this.monitoringDir, 'metrics.json');
    this.alertsFile = path.join(this.monitoringDir, 'alerts.json');
    this.checkInterval = null;
  }

  async initialize() {
    this.logger.info('Initializing Monitoring Engine...');
    await fs.ensureDir(this.monitoringDir);
    await this.loadMetrics();
    await this.loadAlerts();
    this.startMonitoring();
    this.logger.info('Monitoring Engine initialized');
  }

  async loadMetrics() {
    try {
      if (await fs.pathExists(this.metricsFile)) {
        const data = await fs.readJson(this.metricsFile);
        this.metrics = new Map(Object.entries(data));
      }
    } catch (e) {
      this.metrics = new Map();
    }
  }

  async loadAlerts() {
    try {
      if (await fs.pathExists(this.alertsFile)) {
        const data = await fs.readJson(this.alertsFile);
        this.alerts = new Map(Object.entries(data));
      }
    } catch (e) {
      this.alerts = new Map();
    }
  }

  startMonitoring() {
    this.checkInterval = setInterval(() => this.runChecks(), 60000);
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  async recordMetric(name, value, tags = {}) {
    const id = uuidv4();
    const metric = {
      id,
      name,
      value,
      tags,
      timestamp: new Date().toISOString()
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const history = this.metrics.get(name);
    history.push(metric);

    if (history.length > 10000) {
      this.metrics.set(name, history.slice(-10000));
    }

    this.eventEmitter.emit('metric', metric);

    for (const [, alert] of this.alerts) {
      if (alert.metric === name && alert.enabled) {
        await this.checkAlert(alert, value);
      }
    }

    return metric;
  }

  async getMetric(name, options = {}) {
    const { limit = 100, startTime, endTime } = options;
    const history = this.metrics.get(name) || [];

    let filtered = history;

    if (startTime) {
      filtered = filtered.filter(m => new Date(m.timestamp) >= new Date(startTime));
    }
    if (endTime) {
      filtered = filtered.filter(m => new Date(m.timestamp) <= new Date(endTime));
    }

    return filtered.slice(-limit);
  }

  async getMetricStats(name) {
    const history = this.metrics.get(name) || [];
    if (history.length === 0) {
      return { name, count: 0, min: null, max: null, avg: null, latest: null };
    }

    const values = history.map(m => m.value);
    return {
      name,
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      latest: values[values.length - 1],
      first: values[0]
    };
  }

  async createAlert(params) {
    const {
      name,
      metric,
      condition,
      threshold,
      message,
      severity = 'warning',
      enabled = true,
      notificationChannels = []
    } = params;

    const id = uuidv4();
    const alert = {
      id,
      name,
      metric,
      condition,
      threshold,
      message,
      severity,
      enabled,
      notificationChannels,
      triggeredCount: 0,
      lastTriggered: null,
      createdAt: new Date().toISOString()
    };

    this.alerts.set(id, alert);
    await this.saveAlerts();

    this.logger.info(`Alert created: ${name}`);
    return alert;
  }

  async updateAlert(id, updates) {
    const alert = this.alerts.get(id);
    if (!alert) throw new Error(`Alert not found: ${id}`);

    const updated = { ...alert, ...updates };
    this.alerts.set(id, updated);
    await this.saveAlerts();

    return updated;
  }

  async deleteAlert(id) {
    this.alerts.delete(id);
    await this.saveAlerts();
    return { success: true };
  }

  async checkAlert(alert, currentValue) {
    let triggered = false;

    switch (alert.condition) {
      case 'gt':
        triggered = currentValue > alert.threshold;
        break;
      case 'gte':
        triggered = currentValue >= alert.threshold;
        break;
      case 'lt':
        triggered = currentValue < alert.threshold;
        break;
      case 'lte':
        triggered = currentValue <= alert.threshold;
        break;
      case 'eq':
        triggered = currentValue === alert.threshold;
        break;
      case 'neq':
        triggered = currentValue !== alert.threshold;
        break;
    }

    if (triggered) {
      alert.triggeredCount++;
      alert.lastTriggered = new Date().toISOString();
      await this.saveAlerts();

      const incident = {
        id: uuidv4(),
        alertId: alert.id,
        alertName: alert.name,
        metric: alert.metric,
        value: currentValue,
        threshold: alert.threshold,
        condition: alert.condition,
        severity: alert.severity,
        message: alert.message,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      this.incidents.set(incident.id, incident);
      this.eventEmitter.emit('alert', incident);

      this.logger.warn(`Alert triggered: ${alert.name} - ${currentValue} ${alert.condition} ${alert.threshold}`);
    }
  }

  async createCheck(params) {
    const {
      name,
      type,
      target,
      interval = 60,
      timeout = 10,
      retries = 3,
      expectedStatus = 200,
      enabled = true
    } = params;

    const id = uuidv4();
    const check = {
      id,
      name,
      type,
      target,
      interval,
      timeout,
      retries,
      expectedStatus,
      enabled,
      lastCheck: null,
      lastStatus: null,
      lastLatency: null,
      uptime: 100,
      history: [],
      createdAt: new Date().toISOString()
    };

    this.checks.set(id, check);
    this.logger.info(`Check created: ${name}`);
    return check;
  }

  async runCheck(id) {
    const check = this.checks.get(id);
    if (!check) throw new Error(`Check not found: ${id}`);

    const startTime = Date.now();
    let status = 'down';
    let error = null;

    try {
      if (check.type === 'http') {
        const response = await fetch(check.target, {
          method: 'GET',
          signal: AbortSignal.timeout(check.timeout * 1000)
        });
        status = response.status === check.expectedStatus ? 'up' : 'degraded';
      } else if (check.type === 'tcp') {
        const net = require('net');
        await new Promise((resolve, reject) => {
          const socket = new net.Socket();
          socket.setTimeout(check.timeout * 1000);
          socket.connect(check.target.port, check.target.host, () => {
            socket.destroy();
            resolve();
          });
          socket.on('error', reject);
          socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Connection timeout'));
          });
        });
        status = 'up';
      }
    } catch (e) {
      status = 'down';
      error = e.message;
    }

    const latency = Date.now() - startTime;

    check.lastCheck = new Date().toISOString();
    check.lastStatus = status;
    check.lastLatency = latency;

    check.history.push({
      status,
      latency,
      error,
      timestamp: new Date().toISOString()
    });

    if (check.history.length > 100) {
      check.history = check.history.slice(-100);
    }

    const upCount = check.history.filter(h => h.status === 'up').length;
    check.uptime = (upCount / check.history.length) * 100;

    this.checks.set(id, check);

    await this.recordMetric(`check.${id}.latency`, latency, { checkId: id, checkName: check.name });
    await this.recordMetric(`check.${id}.status`, status === 'up' ? 1 : 0, { checkId: id, checkName: check.name });

    return { status, latency, error };
  }

  async runChecks() {
    for (const [id, check] of this.checks) {
      if (check.enabled) {
        try {
          await this.runCheck(id);
        } catch (e) {
          this.logger.error(`Check failed: ${check.name} - ${e.message}`);
        }
      }
    }
  }

  async getCheck(id) {
    return this.checks.get(id);
  }

  async listChecks() {
    return Array.from(this.checks.values());
  }

  async deleteCheck(id) {
    this.checks.delete(id);
    return { success: true };
  }

  getAlerts() {
    return Array.from(this.alerts.values());
  }

  getIncidents(options = {}) {
    const { status, severity, limit = 50 } = options;

    let incidents = Array.from(this.incidents.values());

    if (status) incidents = incidents.filter(i => i.status === status);
    if (severity) incidents = incidents.filter(i => i.severity === severity);

    return incidents
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async resolveIncident(id) {
    const incident = this.incidents.get(id);
    if (!incident) throw new Error(`Incident not found: ${id}`);

    incident.status = 'resolved';
    incident.resolvedAt = new Date().toISOString();
    this.incidents.set(id, incident);

    return incident;
  }

  async getSystemMetrics() {
    return {
      cpu: {
        usage: process.cpuUsage(),
        uptime: process.uptime()
      },
      memory: {
        rss: process.memoryUsage().rss,
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      },
      platform: process.platform,
      nodeVersion: process.version
    };
  }

  async getDashboard() {
    const checks = Array.from(this.checks.values());
    const incidents = Array.from(this.incidents.values());
    const alerts = Array.from(this.alerts.values());

    return {
      checks: {
        total: checks.length,
        up: checks.filter(c => c.lastStatus === 'up').length,
        down: checks.filter(c => c.lastStatus === 'down').length,
        degraded: checks.filter(c => c.lastStatus === 'degraded').length
      },
      incidents: {
        total: incidents.length,
        active: incidents.filter(i => i.status === 'active').length,
        resolved: incidents.filter(i => i.status === 'resolved').length
      },
      alerts: {
        total: alerts.length,
        enabled: alerts.filter(a => a.enabled).length,
        triggered: alerts.filter(a => a.triggeredCount > 0).length
      },
      metrics: Array.from(this.metrics.keys()).map(name => ({
        name,
        count: this.metrics.get(name).length
      }))
    };
  }

  async saveMetrics() {
    await fs.writeJson(this.metricsFile, Object.fromEntries(this.metrics), { spaces: 2 });
  }

  async saveAlerts() {
    await fs.writeJson(this.alertsFile, Object.fromEntries(this.alerts), { spaces: 2 });
  }
}

module.exports = MonitoringEngine;
