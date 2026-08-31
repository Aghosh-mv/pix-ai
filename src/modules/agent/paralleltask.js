const { v4: uuidv4 } = require('uuid');
const os = require('os');

class ParallelTaskEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.workers = new Map();
    this.jobs = new Map();
    this.pools = new Map();
    this.results = new Map();
    this.maxWorkers = os.cpus().length;
    this.activeWorkers = 0;

    this.poolPresets = [
      { id: 'cpu-intensive', name: 'CPU Intensive', workers: this.maxWorkers, priority: 'high', description: 'Max workers for heavy computation' },
      { id: 'io-intensive', name: 'IO Intensive', workers: this.maxWorkers * 2, priority: 'medium', description: 'More workers for IO bound tasks' },
      { id: 'balanced', name: 'Balanced', workers: Math.max(2, Math.floor(this.maxWorkers / 2)), priority: 'medium', description: 'Balanced worker count' },
      { id: 'lightweight', name: 'Lightweight', workers: 2, priority: 'low', description: 'Minimal workers for small tasks' },
      { id: 'gpu', name: 'GPU Tasks', workers: 1, priority: 'high', description: 'Single worker for GPU tasks' }
    ];

    this.strategies = [
      { id: 'round-robin', name: 'Round Robin', description: 'Distribute tasks evenly across workers' },
      { id: 'least-loaded', name: 'Least Loaded', description: 'Assign to worker with fewest tasks' },
      { id: 'priority', name: 'Priority Queue', description: 'Higher priority tasks first' },
      { id: 'sticky', name: 'Sticky', description: 'Same worker gets same task type' },
      { id: 'random', name: 'Random', description: 'Random worker assignment' }
    ];

    this.taskStates = ['pending', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'];
  }

  async initialize() {
    this.logger.info('Initializing Parallel Task Engine...');
    this.loadSettings();
    this.createDefaultPool();
    this.logger.info('Parallel Task Engine initialized');
  }

  loadSettings() {
    this.settings = {
      enabled: true,
      defaultStrategy: 'least-loaded',
      defaultPool: 'balanced',
      maxConcurrentJobs: 100,
      autoRestart: true,
      timeout: 60000,
      retryAttempts: 3
    };
  }

  createDefaultPool() {
    this.createPool('default', { preset: 'balanced' });
  }

  createPool(name, params = {}) {
    const id = uuidv4();
    const preset = this.poolPresets.find(p => p.id === (params.preset || 'balanced'));
    const pool = {
      id,
      name,
      preset: preset?.id || 'balanced',
      maxWorkers: params.workers || preset?.workers || this.maxWorkers,
      strategy: params.strategy || this.settings.defaultStrategy,
      workers: [],
      queue: [],
      status: 'active',
      createdAt: new Date().toISOString()
    };
    this.pools.set(id, pool);
    return pool;
  }

  submitJob(params) {
    const {
      poolId = Array.from(this.pools.keys())[0],
      name,
      type = 'task',
      input = null,
      priority = 'medium',
      timeout = this.settings.timeout,
      callback = null,
      tags = []
    } = params;

    const id = uuidv4();
    const job = {
      id,
      poolId,
      name: name || `job-${id.slice(0, 6)}`,
      type,
      input,
      priority,
      timeout,
      callback,
      tags,
      status: 'queued',
      workerId: null,
      result: null,
      error: null,
      progress: 0,
      logs: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null
    };
    this.jobs.set(id, job);
    const pool = this.pools.get(poolId);
    if (pool) { pool.queue.push(id); this.pools.set(poolId, pool); }
    this.processQueue(poolId);
    return job;
  }

  async processQueue(poolId) {
    const pool = this.pools.get(poolId);
    if (!pool || pool.queue.length === 0) return;

    const availableWorkers = pool.maxWorkers - pool.workers.length;
    if (availableWorkers <= 0) return;

    const sortedQueue = [...pool.queue].sort((a, b) => {
      const jobA = this.jobs.get(a);
      const jobB = this.jobs.get(b);
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[jobA?.priority] || 1) - (priorityOrder[jobB?.priority] || 1);
    });

    const jobsToProcess = sortedQueue.slice(0, availableWorkers);
    for (const jobId of jobsToProcess) {
      const workerId = this.createWorker(poolId);
      await this.executeJob(jobId, workerId);
    }
  }

  createWorker(poolId) {
    const id = uuidv4();
    const worker = {
      id,
      poolId,
      status: 'idle',
      currentJob: null,
      totalJobs: 0,
      createdAt: new Date().toISOString()
    };
    this.workers.set(id, worker);
    const pool = this.pools.get(poolId);
    if (pool) { pool.workers.push(id); this.pools.set(poolId, pool); }
    return id;
  }

  async executeJob(jobId, workerId) {
    const job = this.jobs.get(jobId);
    const worker = this.workers.get(workerId);
    if (!job || !worker) return;

    job.status = 'running';
    job.workerId = workerId;
    job.startedAt = new Date().toISOString();
    worker.status = 'busy';
    worker.currentJob = jobId;

    const pool = this.pools.get(job.poolId);
    if (pool) { pool.queue = pool.queue.filter(id => id !== jobId); this.pools.set(job.poolId, pool); }

    this.jobs.set(jobId, job);
    this.workers.set(workerId, worker);

    try {
      const result = await this.runJob(job);
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date().toISOString();
      job.progress = 100;
      this.results.set(jobId, result);
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date().toISOString();
    }

    worker.status = 'idle';
    worker.currentJob = null;
    worker.totalJobs++;
    this.jobs.set(jobId, job);
    this.workers.set(workerId, worker);
    this.processQueue(job.poolId);
  }

  async runJob(job) {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    return { jobId: job.id, output: `Job "${job.name}" completed`, data: job.input, metrics: { duration: Math.floor(Math.random() * 1000) } };
  }

  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    this.jobs.set(jobId, job);
    if (job.workerId) {
      const worker = this.workers.get(job.workerId);
      if (worker) { worker.status = 'idle'; worker.currentJob = null; this.workers.set(job.workerId, worker); }
    }
    return job;
  }

  getJob(id) { return this.jobs.get(id); }
  listJobs(status = null) {
    let jobs = Array.from(this.jobs.values());
    if (status) jobs = jobs.filter(j => j.status === status);
    return jobs;
  }
  getWorker(id) { return this.workers.get(id); }
  listWorkers(poolId = null) {
    let workers = Array.from(this.workers.values());
    if (poolId) workers = workers.filter(w => w.poolId === poolId);
    return workers;
  }
  getPool(id) { return this.pools.get(id); }
  listPools() { return Array.from(this.pools.values()); }
  getPoolPresets() { return this.poolPresets; }
  getStrategies() { return this.strategies; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    const jobs = Array.from(this.jobs.values());
    const workers = Array.from(this.workers.values());
    return {
      jobs: jobs.length, running: jobs.filter(j => j.status === 'running').length, queued: jobs.filter(j => j.status === 'queued').length,
      completed: jobs.filter(j => j.status === 'completed').length, failed: jobs.filter(j => j.status === 'failed').length,
      workers: workers.length, idleWorkers: workers.filter(w => w.status === 'idle').length, busyWorkers: workers.filter(w => w.status === 'busy').length,
      pools: this.pools.size, maxWorkers: this.maxWorkers
    };
  }
}

module.exports = ParallelTaskEngine;
