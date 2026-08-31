const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class TimerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.timers = new Map();
    this.stopwatches = new Map();
    this.alarms = new Map();
    this.timerDir = path.join(os.homedir(), '.pix/timers');
  }

  async initialize() {
    this.logger.info('Initializing Timer Engine...');
    await fs.ensureDir(this.timerDir);
    await this.loadTimers();
    this.loadDefaultPresets();
    this.logger.info('Timer Engine initialized');
  }

  async loadTimers() {
    try {
      const files = await fs.readdir(this.timerDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.timerDir, file));
          if (data.type === 'timer') this.timers.set(data.id, data);
          else if (data.type === 'alarm') this.alarms.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadDefaultPresets() {
    this.presets = [
      { id: '1min', name: '1 Minute', duration: 60, icon: '⏱️' },
      { id: '5min', name: '5 Minutes', duration: 300, icon: '⏱️' },
      { id: '10min', name: '10 Minutes', duration: 600, icon: '⏱️' },
      { id: '15min', name: '15 Minutes', duration: 900, icon: '⏱️' },
      { id: '25min', name: 'Pomodoro', duration: 1500, icon: '🍅' },
      { id: '30min', name: '30 Minutes', duration: 1800, icon: '⏱️' },
      { id: '1hr', name: '1 Hour', duration: 3600, icon: '⏱️' },
      { id: '2hr', name: '2 Hours', duration: 7200, icon: '⏱️' }
    ];
  }

  async createTimer(params) {
    const {
      name,
      duration,
      label = '',
      category = 'general',
      sound = 'default',
      repeat = false
    } = params;

    const id = uuidv4();
    const timer = {
      id,
      name,
      duration,
      remaining: duration,
      label,
      category,
      sound,
      repeat,
      status: 'idle',
      startedAt: null,
      pausedAt: null,
      completedAt: null,
      laps: [],
      type: 'timer',
      createdAt: new Date().toISOString()
    };

    this.timers.set(id, timer);
    return timer;
  }

  async startTimer(id) {
    const timer = this.timers.get(id);
    if (!timer) throw new Error(`Timer not found: ${id}`);

    timer.status = 'running';
    timer.startedAt = new Date().toISOString();
    this.timers.set(id, timer);
    return timer;
  }

  async pauseTimer(id) {
    const timer = this.timers.get(id);
    if (!timer) throw new Error(`Timer not found: ${id}`);

    timer.status = 'paused';
    timer.pausedAt = new Date().toISOString();
    this.timers.set(id, timer);
    return timer;
  }

  async resumeTimer(id) {
    const timer = this.timers.get(id);
    if (!timer) throw new Error(`Timer not found: ${id}`);

    timer.status = 'running';
    timer.pausedAt = null;
    this.timers.set(id, timer);
    return timer;
  }

  async resetTimer(id) {
    const timer = this.timers.get(id);
    if (!timer) throw new Error(`Timer not found: ${id}`);

    timer.remaining = timer.duration;
    timer.status = 'idle';
    timer.startedAt = null;
    timer.pausedAt = null;
    timer.completedAt = null;
    timer.laps = [];
    this.timers.set(id, timer);
    return timer;
  }

  async completeTimer(id) {
    const timer = this.timers.get(id);
    if (!timer) throw new Error(`Timer not found: ${id}`);

    timer.status = 'completed';
    timer.remaining = 0;
    timer.completedAt = new Date().toISOString();
    this.timers.set(id, timer);
    return timer;
  }

  async deleteTimer(id) {
    this.timers.delete(id);
    return { success: true };
  }

  listTimers(options = {}) {
    const { status, category } = options;
    let timers = Array.from(this.timers.values());

    if (status) timers = timers.filter(t => t.status === status);
    if (category) timers = timers.filter(t => t.category === category);

    return timers;
  }

  async addLap(id) {
    const timer = this.timers.get(id);
    if (!timer) throw new Error(`Timer not found: ${id}`);

    const lapTime = timer.duration - timer.remaining;
    const lastLapTime = timer.laps.length > 0
      ? timer.laps[timer.laps.length - 1].totalTime
      : 0;

    timer.laps.push({
      lapNumber: timer.laps.length + 1,
      lapTime: lapTime - lastLapTime,
      totalTime: lapTime
    });

    this.timers.set(id, timer);
    return timer;
  }

  async createAlarm(params) {
    const {
      time,
      label = '',
      sound = 'default',
      repeat = false,
      days = [],
      enabled = true
    } = params;

    const id = uuidv4();
    const alarm = {
      id,
      time,
      label,
      sound,
      repeat,
      days,
      enabled,
      lastTriggered: null,
      type: 'alarm',
      createdAt: new Date().toISOString()
    };

    this.alarms.set(id, alarm);
    return alarm;
  }

  async updateAlarm(id, updates) {
    const alarm = this.alarms.get(id);
    if (!alarm) throw new Error(`Alarm not found: ${id}`);

    const updated = { ...alarm, ...updates };
    this.alarms.set(id, updated);
    return updated;
  }

  async toggleAlarm(id) {
    const alarm = this.alarms.get(id);
    if (!alarm) throw new Error(`Alarm not found: ${id}`);

    alarm.enabled = !alarm.enabled;
    this.alarms.set(id, alarm);
    return alarm;
  }

  async deleteAlarm(id) {
    this.alarms.delete(id);
    return { success: true };
  }

  listAlarms(options = {}) {
    const { enabled } = options;
    let alarms = Array.from(this.alarms.values());

    if (enabled !== undefined) alarms = alarms.filter(a => a.enabled === enabled);

    return alarms;
  }

  getPresets() {
    return this.presets;
  }

  async getStats() {
    const timers = Array.from(this.timers.values());
    const completed = timers.filter(t => t.status === 'completed');
    const totalTime = completed.reduce((sum, t) => sum + t.duration, 0);

    return {
      totalTimers: timers.length,
      completed: completed.length,
      alarms: this.alarms.size,
      totalTime,
      totalHours: Math.round(totalTime / 3600 * 10) / 10
    };
  }

  async saveTimer(timer) {
    const filePath = path.join(this.timerDir, `${timer.id}.json`);
    await fs.writeJson(filePath, timer, { spaces: 2 });
  }

  async exportTimers(format = 'json') {
    const data = {
      timers: Array.from(this.timers.values()),
      alarms: Array.from(this.alarms.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = TimerEngine;
