const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class PomodoroEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.tasks = new Map();
    this.settings = {
      workDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      autoStartWork: false,
      sound: 'default'
    };
    this.pomodoroDir = path.join(os.homedir(), '.pix/pomodoro');
  }

  async initialize() {
    this.logger.info('Initializing Pomodoro Engine...');
    await fs.ensureDir(this.pomodoroDir);
    await this.loadPomodoro();
    this.logger.info('Pomodoro Engine initialized');
  }

  async loadPomodoro() {
    try {
      const settingsPath = path.join(this.pomodoroDir, 'settings.json');
      if (await fs.pathExists(settingsPath)) {
        const savedSettings = await fs.readJson(settingsPath);
        this.settings = { ...this.settings, ...savedSettings };
      }

      const files = await fs.readdir(this.pomodoroDir);
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'settings.json') {
          const data = await fs.readJson(path.join(this.pomodoroDir, file));
          if (data.type === 'session') this.sessions.set(data.id, data);
          else if (data.type === 'task') this.tasks.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  async updateSettings(updates) {
    this.settings = { ...this.settings, ...updates };
    const settingsPath = path.join(this.pomodoroDir, 'settings.json');
    await fs.writeJson(settingsPath, this.settings, { spaces: 2 });
    return this.settings;
  }

  getSettings() {
    return { ...this.settings };
  }

  async createSession(params) {
    const {
      type = 'work',
      taskId = null,
      duration = null
    } = params;

    const id = uuidv4();
    const actualDuration = duration ||
      (type === 'work' ? this.settings.workDuration * 60 :
       type === 'shortBreak' ? this.settings.shortBreakDuration * 60 :
       this.settings.longBreakDuration * 60);

    const session = {
      id,
      type,
      taskId,
      duration: actualDuration,
      remaining: actualDuration,
      status: 'idle',
      startedAt: null,
      completedAt: null,
      sessionNumber: this.getSessionCount() + 1,
      type: 'session',
      createdAt: new Date().toISOString()
    };

    this.sessions.set(id, session);
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

  async pauseSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    session.status = 'paused';
    session.pausedAt = new Date().toISOString();
    this.sessions.set(id, session);
    return session;
  }

  async resumeSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    session.status = 'running';
    session.pausedAt = null;
    this.sessions.set(id, session);
    return session;
  }

  async completeSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    session.remaining = 0;

    if (session.taskId) {
      const task = this.tasks.get(session.taskId);
      if (task) {
        task.sessionsCompleted = (task.sessionsCompleted || 0) + 1;
        task.totalFocusTime = (task.totalFocusTime || 0) + session.duration;
      }
    }

    this.sessions.set(id, session);
    return session;
  }

  async addTask(params) {
    const {
      title,
      estimatedPomodoros = 4,
      notes = '',
      priority = 'medium'
    } = params;

    const id = uuidv4();
    const task = {
      id,
      title,
      estimatedPomodoros,
      notes,
      priority,
      sessionsCompleted: 0,
      totalFocusTime: 0,
      completed: false,
      type: 'task',
      createdAt: new Date().toISOString()
    };

    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id, updates) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);

    const updated = { ...task, ...updates };
    this.tasks.set(id, updated);
    return updated;
  }

  async completeTask(id) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);

    task.completed = true;
    task.completedAt = new Date().toISOString();
    this.tasks.set(id, task);
    return task;
  }

  async deleteTask(id) {
    this.tasks.delete(id);
    return { success: true };
  }

  listTasks(options = {}) {
    const { completed } = options;
    let tasks = Array.from(this.tasks.values());

    if (completed !== undefined) tasks = tasks.filter(t => t.completed === completed);
    return tasks;
  }

  getSessionCount() {
    return Array.from(this.sessions.values())
      .filter(s => s.type === 'work' && s.status === 'completed').length;
  }

  async getStats() {
    const sessions = Array.from(this.sessions.values());
    const workSessions = sessions.filter(s => s.type === 'work' && s.status === 'completed');
    const totalFocusTime = workSessions.reduce((sum, s) => sum + s.duration, 0);

    const today = new Date().toISOString().split('T')[0];
    const todaySessions = workSessions.filter(s =>
      s.completedAt && s.completedAt.split('T')[0] === today
    );

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay());
    const weekSessions = workSessions.filter(s =>
      s.completedAt && new Date(s.completedAt) >= thisWeek
    );

    return {
      totalSessions: sessions.length,
      workSessions: workSessions.length,
      breakSessions: sessions.filter(s => s.type !== 'work' && s.status === 'completed').length,
      totalFocusMinutes: Math.round(totalFocusTime / 60),
      totalFocusHours: Math.round(totalFocusTime / 3600 * 10) / 10,
      todaySessions: todaySessions.length,
      todayMinutes: Math.round(todaySessions.reduce((sum, s) => sum + s.duration, 0) / 60),
      weekSessions: weekSessions.length,
      tasks: this.tasks.size,
      completedTasks: Array.from(this.tasks.values()).filter(t => t.completed).length
    };
  }

  async getDailyStats() {
    const workSessions = Array.from(this.sessions.values())
      .filter(s => s.type === 'work' && s.status === 'completed');

    const daily = {};
    for (const session of workSessions) {
      const date = session.completedAt.split('T')[0];
      if (!daily[date]) daily[date] = { sessions: 0, minutes: 0 };
      daily[date].sessions++;
      daily[date].minutes += Math.round(session.duration / 60);
    }

    return daily;
  }

  async saveSettings() {
    const settingsPath = path.join(this.pomodoroDir, 'settings.json');
    await fs.writeJson(settingsPath, this.settings, { spaces: 2 });
  }

  async exportPomodoro(format = 'json') {
    const data = {
      settings: this.settings,
      sessions: Array.from(this.sessions.values()),
      tasks: Array.from(this.tasks.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = PomodoroEngine;
