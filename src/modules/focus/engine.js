const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class FocusEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.tasks = new Map();
    this.goals = new Map();
    this.focusDir = path.join(os.homedir(), '.pix/focus');
  }

  async initialize() {
    this.logger.info('Initializing Focus Engine...');
    await fs.ensureDir(this.focusDir);
    await this.loadFocus();
    this.loadTechniques();
    this.logger.info('Focus Engine initialized');
  }

  async loadFocus() {
    try {
      const files = await fs.readdir(this.focusDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.focusDir, file));
          if (data.type === 'session') this.sessions.set(data.id, data);
          else if (data.type === 'task') this.tasks.set(data.id, data);
          else if (data.type === 'goal') this.goals.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadTechniques() {
    this.techniques = [
      {
        id: 'pomodoro',
        name: 'Pomodoro Technique',
        description: '25 minutes of focused work followed by a 5-minute break',
        workDuration: 25,
        breakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        icon: '🍅'
      },
      {
        id: '52-17',
        name: '52-17 Rule',
        description: '52 minutes of work followed by a 17-minute break',
        workDuration: 52,
        breakDuration: 17,
        longBreakDuration: 17,
        sessionsBeforeLongBreak: 3,
        icon: '⏰'
      },
      {
        id: '90-minute',
        name: '90-Minute Focus',
        description: '90 minutes of deep work followed by a 20-minute break',
        workDuration: 90,
        breakDuration: 20,
        longBreakDuration: 30,
        sessionsBeforeLongBreak: 2,
        icon: '🎯'
      },
      {
        id: 'custom',
        name: 'Custom',
        description: 'Create your own focus technique',
        workDuration: 25,
        breakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4,
        icon: '⚙️'
      }
    ];
  }

  async createSession(params) {
    const {
      technique = 'pomodoro',
      taskId = null,
      notes = '',
      workDuration = 25,
      breakDuration = 5
    } = params;

    const id = uuidv4();
    const session = {
      id,
      technique,
      taskId,
      notes,
      workDuration,
      breakDuration,
      status: 'idle',
      startedAt: null,
      completedAt: null,
      duration: 0,
      completed: false,
      type: 'session',
      createdAt: new Date().toISOString()
    };

    this.sessions.set(id, session);
    return session;
  }

  async startSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    session.status = 'working';
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

    session.status = 'working';
    session.pausedAt = null;
    this.sessions.set(id, session);
    return session;
  }

  async completeSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    session.status = 'completed';
    session.completed = true;
    session.completedAt = new Date().toISOString();

    if (session.startedAt) {
      session.duration = Math.round((new Date(session.completedAt) - new Date(session.startedAt)) / 60000);
    }

    this.sessions.set(id, session);
    return session;
  }

  async cancelSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    session.status = 'cancelled';
    session.completedAt = new Date().toISOString();
    this.sessions.set(id, session);
    return session;
  }

  async addTask(params) {
    const {
      title,
      description = '',
      estimatedMinutes = 25,
      priority = 'medium',
      dueDate = null
    } = params;

    const id = uuidv4();
    const task = {
      id,
      title,
      description,
      estimatedMinutes,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      completed: false,
      sessionsCompleted: 0,
      totalFocusTime: 0,
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
    const { completed, priority, search } = options;
    let tasks = Array.from(this.tasks.values());

    if (completed !== undefined) tasks = tasks.filter(t => t.completed === completed);
    if (priority) tasks = tasks.filter(t => t.priority === priority);
    if (search) {
      const searchLower = search.toLowerCase();
      tasks = tasks.filter(t => t.title.toLowerCase().includes(searchLower));
    }

    return tasks;
  }

  async createGoal(params) {
    const {
      title,
      targetSessions = 10,
      targetMinutes = 250,
      startDate = new Date().toISOString(),
      endDate = null
    } = params;

    const id = uuidv4();
    const goal = {
      id,
      title,
      targetSessions,
      targetMinutes,
      startDate: new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : null,
      currentSessions: 0,
      currentMinutes: 0,
      completed: false,
      type: 'goal',
      createdAt: new Date().toISOString()
    };

    this.goals.set(id, goal);
    return goal;
  }

  async updateGoal(id, updates) {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal not found: ${id}`);

    const updated = { ...goal, ...updates };
    this.goals.set(id, updated);
    return updated;
  }

  async completeGoal(id) {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal not found: ${id}`);

    goal.completed = true;
    goal.completedAt = new Date().toISOString();
    this.goals.set(id, goal);
    return goal;
  }

  listGoals() {
    return Array.from(this.goals.values());
  }

  getTechniques() {
    return this.techniques;
  }

  async getStats() {
    const sessions = Array.from(this.sessions.values());
    const completedSessions = sessions.filter(s => s.completed);
    const totalTime = completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      totalTime,
      totalHours: Math.round(totalTime / 60 * 10) / 10,
      tasks: this.tasks.size,
      completedTasks: Array.from(this.tasks.values()).filter(t => t.completed).length,
      goals: this.goals.size
    };
  }

  async getDailyStats(date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    const sessions = Array.from(this.sessions.values())
      .filter(s => s.createdAt && s.createdAt.split('T')[0] === dateStr);

    return {
      date: dateStr,
      sessions: sessions.length,
      completed: sessions.filter(s => s.completed).length,
      totalMinutes: sessions.reduce((sum, s) => sum + (s.duration || 0), 0)
    };
  }

  async saveSession(session) {
    const filePath = path.join(this.focusDir, `${session.id}.json`);
    await fs.writeJson(filePath, session, { spaces: 2 });
  }

  async exportFocus(format = 'json') {
    const data = {
      sessions: Array.from(this.sessions.values()),
      tasks: Array.from(this.tasks.values()),
      goals: Array.from(this.goals.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = FocusEngine;
