const { v4: uuidv4 } = require('uuid');
const os = require('os');

class BackgroundTaskEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.tasks = new Map();
    this.queues = new Map();
    this.schedulers = new Map();
    this.history = new Map();
    this.activeTimers = new Map();

    this.priorities = [
      { id: 'critical', name: 'Critical', icon: '🔴', weight: 10, description: 'Must run immediately' },
      { id: 'high', name: 'High', icon: '🟠', weight: 7, description: 'Run as soon as possible' },
      { id: 'medium', name: 'Medium', icon: '🟡', weight: 5, description: 'Normal priority' },
      { id: 'low', name: 'Low', icon: '🟢', weight: 3, description: 'Run when idle' },
      { id: 'idle', name: 'Idle', icon: '⚪', weight: 1, description: 'Only when nothing else to do' }
    ];

    this.taskTypes = [
      { id: 'file-sync', name: 'File Sync', icon: '📁', description: 'Sync files in background' },
      { id: 'backup', name: 'Backup', icon: '💾', description: 'Backup data' },
      { id: 'index', name: 'Indexing', icon: '🔍', description: 'Index files/content' },
      { id: 'watch', name: 'Watch', icon: '👁️', description: 'Watch for changes' },
      { id: 'analyze', name: 'Analyze', icon: '📊', description: 'Analyze data' },
      { id: 'download', name: 'Download', icon: '⬇️', description: 'Download resources' },
      { id: 'compile', name: 'Compile', icon: '⚙️', description: 'Compile/build code' },
      { id: 'test', name: 'Test', icon: '🧪', description: 'Run tests' },
      { id: 'lint', name: 'Lint', icon: '✅', description: 'Lint code' },
      { id: 'deploy', name: 'Deploy', icon: '🚀', description: 'Deploy application' },
      { id: 'notify', name: 'Notify', icon: '🔔', description: 'Send notifications' },
      { id: 'cleanup', name: 'Cleanup', icon: '🧹', description: 'Clean up files' },
      { id: 'custom', name: 'Custom', icon: '🔧', description: 'Custom background task' }
    ];

    this.schedules = [
      { id: 'once', name: 'Once', description: 'Run once then remove' },
      { id: 'interval', name: 'Interval', description: 'Run every N seconds/minutes' },
      { id: 'cron', name: 'Cron', description: 'Run on cron schedule' },
      { id: 'daily', name: 'Daily', description: 'Run once per day' },
      { id: 'weekly', name: 'Weekly', description: 'Run once per week' },
      { id: 'on-event', name: 'On Event', description: 'Run when event occurs' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Background Task Engine...');
    this.queues.set('default', { id: 'default', name: 'Default', tasks: [], maxConcurrent: 5 });
    this.loadSettings();
    this.logger.info('Background Task Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, maxConcurrentTasks: 10, defaultQueue: 'default', defaultPriority: 'medium', defaultSchedule: 'once', autoRetry: true, maxRetries: 3, retryDelay: 5000, persistToDisk: true };
  }

  createTask(params) {
    const { name, type = 'custom', queue = 'default', priority = 'medium', schedule = 'once', input = null, interval = null, cron = null, timeout = 30000, callback = null, tags = [], notification = false } = params;
    const id = uuidv4();
    const task = { id, name, type, queue, priority, schedule, input, interval, cron, timeout, callback, tags, notification, status: 'pending', result: null, error: null, progress: 0, runs: 0, lastRun: null, nextRun: schedule === 'once' ? new Date().toISOString() : this.calculateNextRun(schedule, interval, cron), createdAt: new Date().toISOString() };
    this.tasks.set(id, task);
    const q = this.queues.get(queue);
    if (q) { q.tasks.push(id); this.queues.set(queue, q); }
    this.processQueue(queue);
    return task;
  }

  calculateNextRun(schedule, interval, cron) {
    const now = new Date();
    if (schedule === 'interval' && interval) { now.setSeconds(now.getSeconds() + interval); }
    else if (schedule === 'daily') { now.setDate(now.getDate() + 1); }
    else if (schedule === 'weekly') { now.setDate(now.getDate() + 7); }
    return now.toISOString();
  }

  async processQueue(queueId) {
    const queue = this.queues.get(queueId);
    if (!queue) return;
    const pending = queue.tasks.filter(id => { const t = this.tasks.get(id); return t && t.status === 'pending'; });
    const running = queue.tasks.filter(id => { const t = this.tasks.get(id); return t && t.status === 'running'; });
    const available = queue.maxConcurrent - running.length;
    if (available <= 0) return;
    const sorted = pending.sort((a, b) => { const tA = this.tasks.get(a); const tB = this.tasks.get(b); return (this.priorities.find(p => p.id === tB?.priority)?.weight || 0) - (this.priorities.find(p => p.id === tA?.priority)?.weight || 0); });
    for (const taskId of sorted.slice(0, available)) { this.executeTask(taskId); }
  }

  async executeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    task.runs++;
    this.tasks.set(taskId, task);
    try {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      task.status = 'completed';
      task.result = { output: `Task "${task.name}" completed` };
      task.completedAt = new Date().toISOString();
      task.lastRun = new Date().toISOString();
      if (task.schedule !== 'once') { task.nextRun = this.calculateNextRun(task.schedule, task.interval, task.cron); task.status = 'pending'; }
      this.tasks.set(taskId, task);
      this.history.set(taskId, { ...task });
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      this.tasks.set(taskId, task);
    }
    const q = this.queues.get(task.queue);
    if (q) this.processQueue(task.queue);
  }

  pauseTask(taskId) { const t = this.tasks.get(taskId); if (!t) throw new Error('Task not found'); t.status = 'paused'; this.tasks.set(taskId, t); return t; }
  resumeTask(taskId) { const t = this.tasks.get(taskId); if (!t) throw new Error('Task not found'); t.status = 'pending'; this.tasks.set(taskId, t); this.processQueue(t.queue); return t; }
  cancelTask(taskId) { const t = this.tasks.get(taskId); if (!t) throw new Error('Task not found'); t.status = 'cancelled'; t.completedAt = new Date().toISOString(); this.tasks.set(taskId, t); return t; }
  deleteTask(taskId) { this.tasks.delete(taskId); return { success: true }; }
  getTask(id) { return this.tasks.get(id); }
  listTasks(status = null) { let tasks = Array.from(this.tasks.values()); if (status) tasks = tasks.filter(t => t.status === status); return tasks; }
  getHistory() { return Array.from(this.history.values()); }
  getPriorities() { return this.priorities; }
  getTaskTypes() { return this.taskTypes; }
  getSchedules() { return this.schedules; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    const tasks = Array.from(this.tasks.values());
    return { tasks: tasks.length, pending: tasks.filter(t => t.status === 'pending').length, running: tasks.filter(t => t.status === 'running').length, completed: tasks.filter(t => t.status === 'completed').length, failed: tasks.filter(t => t.status === 'failed').length, queues: this.queues.size, history: this.history.size };
  }
}

module.exports = BackgroundTaskEngine;
