const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const archiver = require('archiver');

class BackupEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.backups = new Map();
    this.schedules = new Map();
    this.backupDir = path.join(os.homedir(), '.pix/backups');
    this.backupsFile = path.join(this.backupDir, 'backups.json');
  }

  async initialize() {
    this.logger.info('Initializing Backup Engine...');
    await fs.ensureDir(this.backupDir);
    await this.loadBackups();
    this.logger.info('Backup Engine initialized');
  }

  async loadBackups() {
    try {
      if (await fs.pathExists(this.backupsFile)) {
        const data = await fs.readJson(this.backupsFile);
        this.backups = new Map(Object.entries(data.backups || {}));
        this.schedules = new Map(Object.entries(data.schedules || {}));
      }
    } catch (e) {
      this.backups = new Map();
      this.schedules = new Map();
    }
  }

  async saveBackupData() {
    await fs.writeJson(this.backupsFile, {
      backups: Object.fromEntries(this.backups),
      schedules: Object.fromEntries(this.schedules)
    }, { spaces: 2 });
  }

  async create(params) {
    const {
      name,
      source,
      type = 'full',
      destination = null,
      compression = true,
      encryption = false,
      retention = 30
    } = params;

    const id = uuidv4();
    const backupPath = destination || path.join(this.backupDir, `${id}.zip`);

    this.logger.info(`Creating backup: ${name}`);

    const backup = {
      id,
      name,
      source,
      type,
      path: backupPath,
      compression,
      encryption,
      retention,
      status: 'creating',
      size: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      error: null
    };

    this.backups.set(id, backup);

    try {
      await this.createArchive(source, backupPath, compression);
      const stats = await fs.stat(backupPath);

      backup.status = 'completed';
      backup.size = stats.size;
      backup.completedAt = new Date().toISOString();

      await this.saveBackupData();
      this.logger.info(`Backup created: ${name} (${this.formatSize(stats.size)})`);

      return backup;
    } catch (error) {
      backup.status = 'failed';
      backup.error = error.message;
      backup.completedAt = new Date().toISOString();

      await this.saveBackupData();
      this.logger.error(`Backup failed: ${error.message}`);

      throw error;
    }
  }

  async createArchive(source, destination, compression) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destination);
      const archive = archiver('zip', {
        zlib: { level: compression ? 9 : 0 }
      });

      output.on('close', () => resolve());
      archive.on('error', reject);

      archive.pipe(output);

      const stat = fs.statSync(source);
      if (stat.isDirectory()) {
        archive.directory(source, path.basename(source));
      } else {
        archive.file(source, { name: path.basename(source) });
      }

      archive.finalize();
    });
  }

  async restore(params) {
    const { id, destination } = params;
    const backup = this.backups.get(id);

    if (!backup) throw new Error(`Backup not found: ${id}`);

    this.logger.info(`Restoring backup: ${backup.name}`);

    const decompress = require('decompress');
    await decompress(backup.path, destination);

    this.logger.info(`Backup restored to: ${destination}`);
    return { success: true, destination };
  }

  async delete(params) {
    const { id } = params;
    const backup = this.backups.get(id);

    if (!backup) throw new Error(`Backup not found: ${id}`);

    await fs.remove(backup.path).catch(() => {});
    this.backups.delete(id);
    await this.saveBackupData();

    this.logger.info(`Backup deleted: ${backup.name}`);
    return { success: true };
  }

  async list(params = {}) {
    const { type, limit = 50 } = params;

    let backups = Array.from(this.backups.values());

    if (type) {
      backups = backups.filter(b => b.type === type);
    }

    return backups
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  get(id) {
    return this.backups.get(id);
  }

  async createSchedule(params) {
    const {
      name,
      source,
      frequency = 'daily',
      time = '02:00',
      retention = 7,
      enabled = true
    } = params;

    const id = uuidv4();
    const schedule = {
      id,
      name,
      source,
      frequency,
      time,
      retention,
      enabled,
      lastRun: null,
      nextRun: this.calculateNextRun(frequency, time),
      createdAt: new Date().toISOString()
    };

    this.schedules.set(id, schedule);
    await this.saveBackupData();

    this.logger.info(`Backup schedule created: ${name}`);
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
    await this.saveBackupData();

    return updated;
  }

  async deleteSchedule(id) {
    this.schedules.delete(id);
    await this.saveBackupData();
    return { success: true };
  }

  listSchedules() {
    return Array.from(this.schedules.values());
  }

  calculateNextRun(frequency, time) {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
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
          next.setDate(next.getDate() + 7);
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          break;
      }
    }

    return next.toISOString();
  }

  async runScheduledBackups() {
    const now = new Date();

    for (const [id, schedule] of this.schedules) {
      if (!schedule.enabled) continue;

      const nextRun = new Date(schedule.nextRun);
      if (nextRun <= now) {
        try {
          await this.create({
            name: `${schedule.name}-${Date.now()}`,
            source: schedule.source,
            type: 'scheduled'
          });

          schedule.lastRun = now.toISOString();
          schedule.nextRun = this.calculateNextRun(schedule.frequency, schedule.time);
          this.schedules.set(id, schedule);

          await this.saveBackupData();
        } catch (error) {
          this.logger.error(`Scheduled backup failed: ${error.message}`);
        }
      }
    }
  }

  async cleanupOldBackups() {
    const now = new Date();

    for (const [id, backup] of this.backups) {
      if (backup.retention) {
        const created = new Date(backup.createdAt);
        const ageDays = (now - created) / (1000 * 60 * 60 * 24);

        if (ageDays > backup.retention) {
          await this.delete({ id });
          this.logger.info(`Cleaned up old backup: ${backup.name}`);
        }
      }
    }
  }

  async getStats() {
    const backups = Array.from(this.backups.values());
    const totalSize = backups.reduce((sum, b) => sum + (b.size || 0), 0);

    return {
      totalBackups: backups.length,
      totalSize,
      completed: backups.filter(b => b.status === 'completed').length,
      failed: backups.filter(b => b.status === 'failed').length,
      schedules: this.schedules.size
    };
  }

  async exportBackup(id, destination) {
    const backup = this.backups.get(id);
    if (!backup) throw new Error(`Backup not found: ${id}`);

    const destPath = destination || path.join(os.homedir(), 'Downloads', `${backup.name}.zip`);
    await fs.copy(backup.path, destPath);

    return { success: true, path: destPath };
  }

  async importBackup(params) {
    const { name, path: backupPath } = params;
    const id = uuidv4();

    const stats = await fs.stat(backupPath);
    const backup = {
      id,
      name: name || path.basename(backupPath, '.zip'),
      source: 'imported',
      type: 'imported',
      path: backupPath,
      size: stats.size,
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };

    this.backups.set(id, backup);
    await this.saveBackupData();

    return backup;
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = BackupEngine;
