const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class BackupEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.backups = new Map();
    this.schedules = new Map();
    this.backupDir = path.join(os.homedir(), '.pix/backups');
  }

  async initialize() {
    this.logger.info('Initializing Backup Engine...');
    await fs.ensureDir(this.backupDir);
    await this.loadBackups();
    this.logger.info('Backup Engine initialized');
  }

  async loadBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.backupDir, file));
          if (data.type === 'backup') this.backups.set(data.id, data);
          else if (data.type === 'schedule') this.schedules.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  async createBackup(params) {
    const {
      name,
      sourcePath,
      destinationPath = this.backupDir,
      type = 'full',
      compression = true,
      exclude = []
    } = params;

    const id = uuidv4();
    const backup = {
      id,
      name,
      sourcePath,
      destinationPath,
      type,
      compression,
      exclude,
      status: 'pending',
      size: 0,
      filesCount: 0,
      startedAt: null,
      completedAt: null,
      type: 'backup',
      createdAt: new Date().toISOString()
    };

    this.backups.set(id, backup);
    return backup;
  }

  async startBackup(id) {
    const backup = this.backups.get(id);
    if (!backup) throw new Error(`Backup not found: ${id}`);

    backup.status = 'running';
    backup.startedAt = new Date().toISOString();
    this.backups.set(id, backup);

    return backup;
  }

  async completeBackup(id, stats = {}) {
    const backup = this.backups.get(id);
    if (!backup) throw new Error(`Backup not found: ${id}`);

    backup.status = 'completed';
    backup.completedAt = new Date().toISOString();
    backup.size = stats.size || 0;
    backup.filesCount = stats.filesCount || 0;
    backup.duration = new Date(backup.completedAt) - new Date(backup.startedAt);
    this.backups.set(id, backup);

    return backup;
  }

  async failBackup(id, error) {
    const backup = this.backups.get(id);
    if (!backup) throw new Error(`Backup not found: ${id}`);

    backup.status = 'failed';
    backup.completedAt = new Date().toISOString();
    backup.error = error;
    this.backups.set(id, backup);

    return backup;
  }

  async deleteBackup(id) {
    this.backups.delete(id);
    return { success: true };
  }

  async getBackup(id) {
    return this.backups.get(id);
  }

  listBackups(options = {}) {
    const { status, type } = options;
    let backups = Array.from(this.backups.values());

    if (status) backups = backups.filter(b => b.status === status);
    if (type) backups = backups.filter(b => b.type === type);

    return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async createSchedule(params) {
    const {
      name,
      backupConfig,
      frequency = 'daily',
      time = '02:00',
      enabled = true
    } = params;

    const id = uuidv4();
    const schedule = {
      id,
      name,
      backupConfig,
      frequency,
      time,
      enabled,
      lastRun: null,
      nextRun: this.calculateNextRun(frequency, time),
      type: 'schedule',
      createdAt: new Date().toISOString()
    };

    this.schedules.set(id, schedule);
    return schedule;
  }

  async updateSchedule(id, updates) {
    const schedule = this.schedules.get(id);
    if (!schedule) throw new Error(`Schedule not found: ${id}`);

    const updated = { ...schedule, ...updates };
    if (updates.frequency || updates.time) {
      updated.nextRun = this.calculateNextRun(updated.frequency, updated.time);
    }

    this.schedules.set(id, updated);
    return updated;
  }

  async deleteSchedule(id) {
    this.schedules.delete(id);
    return { success: true };
  }

  listSchedules() {
    return Array.from(this.schedules.values());
  }

  calculateNextRun(frequency, time) {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
      switch (frequency) {
        case 'hourly':
          next.setHours(next.getHours() + 1);
          break;
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + (7 - next.getDay()));
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          next.setDate(1);
          break;
      }
    }

    return next.toISOString();
  }

  async getBackupStats() {
    const backups = Array.from(this.backups.values());
    const completed = backups.filter(b => b.status === 'completed');
    const totalSize = completed.reduce((sum, b) => sum + (b.size || 0), 0);

    return {
      total: backups.length,
      completed: completed.length,
      failed: backups.filter(b => b.status === 'failed').length,
      pending: backups.filter(b => b.status === 'pending').length,
      totalSize,
      totalSizeFormatted: this.formatBytes(totalSize),
      schedules: this.schedules.size
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async exportBackups(format = 'json') {
    const data = {
      backups: Array.from(this.backups.values()),
      schedules: Array.from(this.schedules.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = BackupEngine;
