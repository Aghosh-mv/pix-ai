const { v4: uuidv4 } = require('uuid');
const os = require('os');

class SubAgentEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.agents = new Map();
    this.tasks = new Map();
    this.workers = new Map();
    this.queues = new Map();
    this.results = new Map();
    this.logs = new Map();
    this.dependencies = new Map();

    this.agentTypes = [
      { id: 'researcher', name: 'Researcher', icon: '🔍', description: 'Searches web, reads docs, gathers info', capabilities: ['web_search', 'file_read', 'summarize'] },
      { id: 'coder', name: 'Coder', icon: '💻', description: 'Writes, edits, debugs code', capabilities: ['file_write', 'file_edit', 'execute', 'debug'] },
      { id: 'reviewer', name: 'Reviewer', icon: '👁️', description: 'Reviews code quality, security, performance', capabilities: ['file_read', 'analyze', 'report'] },
      { id: 'writer', name: 'Writer', icon: '✍️', description: 'Writes docs, READMEs, comments', capabilities: ['file_write', 'format', 'summarize'] },
      { id: 'planner', name: 'Planner', icon: '📋', description: 'Breaks tasks into subtasks', capabilities: ['analyze', 'decompose', 'prioritize'] },
      { id: 'debugger', name: 'Debugger', icon: '🐛', description: 'Finds and fixes bugs', capabilities: ['execute', 'analyze', 'file_edit'] },
      { id: 'tester', name: 'Tester', icon: '🧪', description: 'Writes and runs tests', capabilities: ['file_write', 'execute', 'report'] },
      { id: 'optimizer', name: 'Optimizer', icon: '⚡', description: 'Optimizes performance', capabilities: ['analyze', 'file_edit', 'benchmark'] },
      { id: 'security', name: 'Security', icon: '🛡️', description: 'Audits security vulnerabilities', capabilities: ['analyze', 'scan', 'report'] },
      { id: 'devops', name: 'DevOps', icon: '🚀', description: 'CI/CD, deployment, infrastructure', capabilities: ['execute', 'deploy', 'monitor'] },
      { id: 'data', name: 'Data Analyst', icon: '📊', description: 'Analyzes data, creates visualizations', capabilities: ['analyze', 'transform', 'visualize'] },
      { id: 'designer', name: 'Designer', icon: '🎨', description: 'UI/UX design, CSS, layouts', capabilities: ['file_write', 'file_edit', 'preview'] },
      { id: 'database', name: 'DB Admin', icon: '🗄️', description: 'Database queries, optimization', capabilities: ['execute', 'analyze', 'optimize'] },
      { id: 'api', name: 'API Builder', icon: '🔌', description: 'Designs and tests APIs', capabilities: ['file_write', 'execute', 'test'] },
      { id: 'migration', name: 'Migrator', icon: '🔄', description: 'Code migration, refactoring', capabilities: ['file_read', 'file_write', 'transform'] }
    ];

    this.strategies = [
      { id: 'fan-out', name: 'Fan-Out', description: 'Split task among N agents, merge results', useCase: 'Large tasks that can be parallelized' },
      { id: 'pipeline', name: 'Pipeline', description: 'Sequential chain of agents', useCase: 'Tasks with sequential dependencies' },
      { id: 'map-reduce', name: 'Map-Reduce', description: 'Map to workers, reduce results', useCase: 'Data processing tasks' },
      { id: 'hierarchical', name: 'Hierarchical', description: 'Manager agents with sub-managers', useCase: 'Complex multi-level tasks' },
      { id: 'consensus', name: 'Consensus', description: 'Multiple agents vote on approach', useCase: 'Decision-making tasks' },
      { id: 'race', name: 'Race', description: 'Multiple agents race, first wins', useCase: 'Time-critical tasks' },
      { id: 'retry', name: 'Retry', description: 'Retry failed tasks with different agent', useCase: 'Unreliable operations' },
      { id: 'load-balance', name: 'Load Balance', description: 'Distribute work evenly', useCase: 'High-volume tasks' },
      { id: 'adaptive', name: 'Adaptive', description: 'Choose strategy based on task type', useCase: 'Unknown or mixed tasks' }
    ];

    this.taskStatuses = ['queued', 'assigned', 'running', 'paused', 'completed', 'failed', 'cancelled'];

    this.dependencyTypes = [
      { id: 'finish-to-start', name: 'Finish-to-Start', description: 'B starts after A finishes' },
      { id: 'start-to-start', name: 'Start-to-Start', description: 'B starts when A starts' },
      { id: 'finish-to-finish', name: 'Finish-to-Finish', description: 'B finishes when A finishes' },
      { id: 'start-to-finish', name: 'Start-to-Finish', description: 'B finishes when A starts' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Sub-Agent Engine...');
    this.logger.info('Sub-Agent Engine initialized');
  }

  createAgent(type, params = {}) {
    const agentType = this.agentTypes.find(t => t.id === type);
    if (!agentType) throw new Error(`Unknown agent type: ${type}`);

    const id = uuidv4();
    const agent = {
      id,
      type,
      name: params.name || `${agentType.name}-${id.slice(0, 6)}`,
      icon: agentType.icon,
      capabilities: agentType.capabilities,
      status: 'idle',
      currentTask: null,
      taskHistory: [],
      totalTasks: 0,
      successRate: 100,
      avgDuration: 0,
      config: params.config || {},
      context: params.context || {},
      createdAt: new Date().toISOString()
    };

    this.agents.set(id, agent);
    return agent;
  }

  createTask(params) {
    const {
      name,
      description = '',
      type = 'general',
      priority = 'medium',
      input = null,
      agentType = null,
      strategy = 'adaptive',
      maxRetries = 3,
      timeout = 30000,
      dependencies = [],
      tags = [],
      metadata = {}
    } = params;

    const id = uuidv4();
    const task = {
      id,
      name,
      description,
      type,
      priority,
      input,
      agentType,
      strategy,
      maxRetries,
      timeout,
      retries: 0,
      dependencies,
      tags,
      metadata,
      status: 'queued',
      assignedAgent: null,
      result: null,
      error: null,
      subtasks: [],
      parentId: null,
      progress: 0,
      logs: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null
    };

    this.tasks.set(id, task);
    return task;
  }

  async assignTask(taskId, agentId) {
    const task = this.tasks.get(taskId);
    const agent = this.agents.get(agentId);
    if (!task || !agent) throw new Error('Task or agent not found');

    if (!this.areDependenciesMet(taskId)) {
      throw new Error(`Dependencies not met for task: ${taskId}`);
    }

    task.status = 'assigned';
    task.assignedAgent = agentId;

    agent.status = 'busy';
    agent.currentTask = taskId;

    this.tasks.set(taskId, task);
    this.agents.set(agentId, agent);

    return { task, agent };
  }

  async executeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = 'running';
    task.startedAt = new Date().toISOString();
    task.progress = 0;
    this.tasks.set(taskId, task);

    this.addLog(taskId, 'Task execution started');

    try {
      if (task.subtasks.length > 0) {
        return await this.executeWithSubtasks(taskId);
      }

      if (!task.assignedAgent) {
        const agent = this.selectBestAgent(task);
        if (agent) {
          await this.assignTask(taskId, agent.id);
        }
      }

      const result = await this.runAgentTask(task);
      task.status = 'completed';
      task.result = result;
      task.progress = 100;
      task.completedAt = new Date().toISOString();
      task.duration = new Date(task.completedAt) - new Date(task.startedAt);

      const agent = this.agents.get(task.assignedAgent);
      if (agent) {
        agent.status = 'idle';
        agent.currentTask = null;
        agent.totalTasks++;
        agent.taskHistory.push(taskId);
        this.agents.set(agent.id, agent);
      }

      this.tasks.set(taskId, task);
      this.addLog(taskId, 'Task completed successfully');

      return task;
    } catch (error) {
      task.retries++;
      task.error = error.message;
      this.addLog(taskId, `Task failed: ${error.message}`);

      if (task.retries < task.maxRetries) {
        this.addLog(taskId, `Retrying (${task.retries}/${task.maxRetries})...`);
        task.status = 'queued';
        task.progress = 0;
        task.startedAt = null;
        this.tasks.set(taskId, task);
        return this.executeTask(taskId);
      }

      task.status = 'failed';
      task.completedAt = new Date().toISOString();
      this.tasks.set(taskId, task);

      const agent = this.agents.get(task.assignedAgent);
      if (agent) {
        agent.status = 'idle';
        agent.currentTask = null;
        this.agents.set(agent.id, agent);
      }

      throw error;
    }
  }

  async executeWithSubtasks(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const results = [];
    const totalSubtasks = task.subtasks.length;

    for (let i = 0; i < task.subtasks.length; i++) {
      const subtask = task.subtasks[i];
      const subtaskId = uuidv4();

      subtask.id = subtaskId;
      subtask.parentId = taskId;
      subtask.status = 'queued';
      subtask.retries = 0;
      subtask.progress = 0;

      this.tasks.set(subtaskId, subtask);

      this.addLog(taskId, `Starting subtask ${i + 1}/${totalSubtasks}: ${subtask.name}`);

      try {
        await this.executeTask(subtaskId);
        const subtaskResult = this.tasks.get(subtaskId);
        results.push(subtaskResult.result);
        task.progress = Math.round(((i + 1) / totalSubtasks) * 100);
        this.tasks.set(taskId, task);
      } catch (error) {
        results.push({ error: error.message });
      }
    }

    task.status = 'completed';
    task.result = results;
    task.progress = 100;
    task.completedAt = new Date().toISOString();
    task.duration = new Date(task.completedAt) - new Date(task.startedAt);
    this.tasks.set(taskId, task);

    this.addLog(taskId, 'All subtasks completed');

    return task;
  }

  async runAgentTask(task) {
    const agent = this.agents.get(task.assignedAgent);
    if (!agent) throw new Error('No agent assigned');

    await this.delay(100 + Math.random() * 200);

    return {
      taskId: task.id,
      agentId: agent.id,
      agentType: agent.type,
      output: `Task "${task.name}" completed by ${agent.name}`,
      data: task.input,
      metrics: {
        executionTime: Math.floor(Math.random() * 1000),
        memoryUsed: Math.floor(Math.random() * 100),
        cpuUsed: Math.floor(Math.random() * 50)
      }
    };
  }

  selectBestAgent(task) {
    const available = Array.from(this.agents.values()).filter(a => a.status === 'idle');

    if (available.length === 0) return null;

    if (task.agentType) {
      const typed = available.find(a => a.type === task.agentType);
      if (typed) return typed;
    }

    return available[0];
  }

  areDependenciesMet(taskId) {
    const task = this.tasks.get(taskId);
    if (!task || task.dependencies.length === 0) return true;

    return task.dependencies.every(depId => {
      const dep = this.tasks.get(depId);
      return dep && dep.status === 'completed';
    });
  }

  addLog(taskId, message) {
    const log = {
      id: uuidv4(),
      taskId,
      message,
      timestamp: new Date().toISOString()
    };

    const task = this.tasks.get(taskId);
    if (task) {
      task.logs.push(log);
      this.tasks.set(taskId, task);
    }
  }

  async createSubtask(parentTaskId, params) {
    const parentTask = this.tasks.get(parentTaskId);
    if (!parentTask) throw new Error(`Parent task not found: ${parentTaskId}`);

    const subtask = this.createTask({
      ...params,
      parentId: parentTaskId
    });

    parentTask.subtasks.push(subtask);
    this.tasks.set(parentTaskId, parentTask);

    return subtask;
  }

  async pauseTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = 'paused';
    this.tasks.set(taskId, task);
    this.addLog(taskId, 'Task paused');
    return task;
  }

  async resumeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = 'queued';
    this.tasks.set(taskId, task);
    this.addLog(taskId, 'Task resumed');
    return task;
  }

  async cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.status = 'cancelled';
    task.completedAt = new Date().toISOString();
    this.tasks.set(taskId, task);

    if (task.assignedAgent) {
      const agent = this.agents.get(task.assignedAgent);
      if (agent) {
        agent.status = 'idle';
        agent.currentTask = null;
        this.agents.set(agent.id, agent);
      }
    }

    this.addLog(taskId, 'Task cancelled');
    return task;
  }

  getAgent(id) {
    return this.agents.get(id);
  }

  listAgents(type = null) {
    let agents = Array.from(this.agents.values());
    if (type) agents = agents.filter(a => a.type === type);
    return agents;
  }

  listIdleAgents() {
    return Array.from(this.agents.values()).filter(a => a.status === 'idle');
  }

  listBusyAgents() {
    return Array.from(this.agents.values()).filter(a => a.status === 'busy');
  }

  getTask(id) {
    return this.tasks.get(id);
  }

  listTasks(status = null) {
    let tasks = Array.from(this.tasks.values());
    if (status) tasks = tasks.filter(t => t.status === status);
    return tasks;
  }

  listQueuedTasks() {
    return Array.from(this.tasks.values()).filter(t => t.status === 'queued');
  }

  listRunningTasks() {
    return Array.from(this.tasks.values()).filter(t => t.status === 'running');
  }

  getAgentTypes() {
    return this.agentTypes;
  }

  getStrategies() {
    return this.strategies;
  }

  getDependencyTypes() {
    return this.dependencyTypes;
  }

  async getStats() {
    const agents = Array.from(this.agents.values());
    const tasks = Array.from(this.tasks.values());

    return {
      agents: agents.length,
      idleAgents: agents.filter(a => a.status === 'idle').length,
      busyAgents: agents.filter(a => a.status === 'busy').length,
      tasks: tasks.length,
      queuedTasks: tasks.filter(t => t.status === 'queued').length,
      runningTasks: tasks.filter(t => t.status === 'running').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      avgCompletionTime: this.calculateAvgCompletionTime(tasks)
    };
  }

  calculateAvgCompletionTime(tasks) {
    const completed = tasks.filter(t => t.status === 'completed' && t.duration);
    if (completed.length === 0) return 0;
    return Math.round(completed.reduce((sum, t) => sum + t.duration, 0) / completed.length);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SubAgentEngine;
