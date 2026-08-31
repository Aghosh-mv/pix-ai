const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class TaskScheduler {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.tasks = new Map();
    this.running = new Set();
    this.intervals = new Map();
    this.eventEmitter = new EventEmitter();
    this.tickInterval = null;
  }

  async initialize() {
    this.logger.info('Initializing Task Scheduler...');
    this.startTick();
    this.logger.info('Task Scheduler initialized');
  }

  startTick() {
    this.tickInterval = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    for (const [id, interval] of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  async schedule(params) {
    const {
      name,
      type = 'once',
      action,
      params: actionParams = {},
      schedule = null,
      priority = 'normal',
      maxRetries = 3,
      timeout = 60000,
      dependencies = [],
      metadata = {}
    } = params;

    const id = uuidv4();

    const task = {
      id,
      name,
      type,
      action,
      params: actionParams,
      schedule,
      priority,
      maxRetries,
      timeout,
      dependencies,
      metadata,
      status: 'pending',
      retries: 0,
      lastRun: null,
      nextRun: type === 'once' ? new Date() : this.calculateNextRun(schedule),
      createdAt: new Date().toISOString()
    };

    this.tasks.set(id, task);
    this.logger.info(`Task scheduled: ${name} (${type})`);

    if (type === 'once' && task.nextRun <= new Date()) {
      this.runTask(id);
    }

    if (type === 'recurring' && schedule) {
      this.setupRecurring(id, schedule);
    }

    return task;
  }

  setupRecurring(taskId, schedule) {
    if (this.intervals.has(taskId)) {
      clearInterval(this.intervals.get(taskId));
    }

    const intervalMs = this.parseSchedule(schedule);
    if (intervalMs > 0) {
      const interval = setInterval(() => {
        this.runTask(taskId);
      }, intervalMs);
      this.intervals.set(taskId, interval);
    }
  }

  parseSchedule(schedule) {
    if (typeof schedule === 'number') return schedule;

    const match = schedule.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  calculateNextRun(schedule) {
    const intervalMs = this.parseSchedule(schedule);
    return new Date(Date.now() + intervalMs);
  }

  async runTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    if (task.status === 'running') return;

    for (const dep of task.dependencies) {
      const depTask = this.tasks.get(dep);
      if (depTask && depTask.status !== 'completed') {
        return;
      }
    }

    this.logger.info(`Running task: ${task.name}`);
    task.status = 'running';
    task.lastRun = new Date().toISOString();
    this.running.add(taskId);

    this.eventEmitter.emit('task:start', { taskId, task });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Task timeout')), task.timeout);
    });

    try {
      await Promise.race([this.executeTask(task), timeoutPromise]);
      task.status = 'completed';
      this.logger.info(`Task completed: ${task.name}`);
      this.eventEmitter.emit('task:complete', { taskId, task });
    } catch (error) {
      task.retries++;
      if (task.retries < task.maxRetries) {
        task.status = 'pending';
        this.logger.warn(`Task failed, retrying (${task.retries}/${task.maxRetries}): ${task.name}`);
        this.eventEmitter.emit('task:retry', { taskId, task, error: error.message });
      } else {
        task.status = 'failed';
        task.error = error.message;
        this.logger.error(`Task failed: ${task.name} - ${error.message}`);
        this.eventEmitter.emit('task:fail', { taskId, task, error: error.message });
      }
    } finally {
      this.running.delete(taskId);

      if (task.type === 'once') {
        this.tasks.delete(taskId);
      } else if (task.type === 'recurring' && task.schedule) {
        task.nextRun = this.calculateNextRun(task.schedule);
        task.status = 'pending';
      }
    }
  }

  async executeTask(task) {
    this.logger.info(`Executing task action: ${task.action}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  }

  async cancel(params) {
    const { taskId } = params;
    const task = this.tasks.get(taskId);

    if (!task) throw new Error(`Task not found: ${taskId}`);

    if (this.intervals.has(taskId)) {
      clearInterval(this.intervals.get(taskId));
      this.intervals.delete(taskId);
    }

    task.status = 'cancelled';
    this.tasks.delete(taskId);

    return { success: true };
  }

  list() {
    return Array.from(this.tasks.values());
  }

  getTask(id) {
    return this.tasks.get(id);
  }

  tick() {
    for (const [id, task] of this.tasks) {
      if (task.status === 'pending' && task.nextRun && task.nextRun <= new Date()) {
        if (!this.running.has(id)) {
          this.runTask(id);
        }
      }
    }
  }
}

module.exports = TaskScheduler;
