const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class TaskPlannerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.projects = new Map();
    this.tasks = new Map();
    this.dependencies = new Map();
    this.templates = new Map();
    this.plannerDir = path.join(os.homedir(), '.pix/planner');
  }

  async initialize() {
    this.logger.info('Initializing Task Planner Engine...');
    await fs.ensureDir(this.plannerDir);
    await this.loadData();
    this.loadTemplates();
    this.loadStrategies();
    this.loadPriorities();
    this.logger.info('Task Planner Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.plannerDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.plannerDir, file));
          if (data.type === 'project') this.projects.set(data.id, data);
          else if (data.type === 'task') this.tasks.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadTemplates() {
    const defaults = [
      {
        id: 'sprint',
        name: 'Sprint Planning',
        icon: '🏃',
        description: '2-week sprint with daily tasks',
        phases: ['Planning', 'Development', 'Testing', 'Review', 'Deploy'],
        defaultDuration: 14,
        tasksPerPhase: 5
      },
      {
        id: 'feature',
        name: 'Feature Development',
        icon: '✨',
        description: 'Full feature lifecycle',
        phases: ['Requirements', 'Design', 'Implement', 'Test', 'Document', 'Ship'],
        defaultDuration: 7,
        tasksPerPhase: 3
      },
      {
        id: 'bugfix',
        name: 'Bug Fix',
        icon: '🐛',
        description: 'Bug investigation and fix',
        phases: ['Reproduce', 'Investigate', 'Fix', 'Test', 'Verify'],
        defaultDuration: 3,
        tasksPerPhase: 2
      },
      {
        id: 'project',
        name: 'Project',
        icon: '📂',
        description: 'Full project management',
        phases: ['Initiation', 'Planning', 'Execution', 'Monitoring', 'Closure'],
        defaultDuration: 30,
        tasksPerPhase: 10
      },
      {
        id: 'research',
        name: 'Research',
        icon: '🔬',
        description: 'Research and exploration',
        phases: ['Define', 'Search', 'Analyze', 'Synthesize', 'Report'],
        defaultDuration: 5,
        tasksPerPhase: 3
      }
    ];

    defaults.forEach(template => {
      this.templates.set(template.id, { ...template, type: 'template' });
    });
  }

  loadStrategies() {
    this.strategyList = [
      { id: 'waterfall', name: 'Waterfall', icon: '💧', description: 'Sequential phases, each completed before next begins' },
      { id: 'agile', name: 'Agile', icon: '🔄', description: 'Iterative approach with regular feedback loops' },
      { id: 'kanban', name: 'Kanban', icon: '📋', description: 'Visual workflow with WIP limits' },
      { id: 'scrum', name: 'Scrum', icon: '🏉', description: 'Sprint-based with defined roles' },
      { id: 'critical', name: 'Critical Path', icon: '🎯', description: 'Focus on longest dependency chain' },
      { id: 'parallel', name: 'Parallel', icon: '↔️', description: 'Execute independent tasks simultaneously' },
      { id: 'priority', name: 'Priority First', icon: '⬆️', description: 'Always work on highest priority items' },
      { id: 'dependency', name: 'Dependency Driven', icon: '🔗', description: 'Work flows based on dependency completion' }
    ];
  }

  loadPriorities() {
    this.priorityList = [
      { id: 'critical', name: 'Critical', icon: '🔴', color: '#FF0000', order: 1 },
      { id: 'high', name: 'High', icon: '🟠', color: '#FF8C00', order: 2 },
      { id: 'medium', name: 'Medium', icon: '🟡', color: '#FFD700', order: 3 },
      { id: 'low', name: 'Low', icon: '🟢', color: '#00FF00', order: 4 },
      { id: 'none', name: 'None', icon: '⚪', color: '#CCCCCC', order: 5 }
    ];
  }

  async createProject(params) {
    const {
      name,
      description = '',
      template = 'project',
      strategy = 'agile',
      startDate = new Date().toISOString(),
      endDate = null,
      tags = [],
      color = '#4A90D9'
    } = params;

    const id = uuidv4();
    const projectTemplate = this.templates.get(template);

    const project = {
      id,
      name,
      description,
      template,
      strategy,
      color,
      tags,
      status: 'active',
      progress: 0,
      phases: projectTemplate ? projectTemplate.phases.map((phase, i) => ({
        id: uuidv4(),
        name: phase,
        order: i,
        status: 'pending',
        progress: 0
      })) : [],
      members: [],
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        averageCompletionTime: 0
      },
      startDate,
      endDate,
      type: 'project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.projects.set(id, project);
    await this.saveProject(project);
    return project;
  }

  async updateProject(id, updates) {
    const project = this.projects.get(id);
    if (!project) throw new Error(`Project not found: ${id}`);

    const updated = {
      ...project,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.projects.set(id, updated);
    await this.saveProject(updated);
    return updated;
  }

  async deleteProject(id) {
    const tasks = Array.from(this.tasks.values()).filter(t => t.projectId === id);
    for (const task of tasks) {
      this.tasks.delete(task.id);
    }

    this.projects.delete(id);
    await fs.remove(path.join(this.plannerDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getProject(id) {
    return this.projects.get(id);
  }

  listProjects(options = {}) {
    const { status, search } = options;
    let projects = Array.from(this.projects.values());

    if (status) projects = projects.filter(p => p.status === status);
    if (search) {
      const searchLower = search.toLowerCase();
      projects = projects.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async createTask(params) {
    const {
      projectId,
      title,
      description = '',
      priority = 'medium',
      status = 'todo',
      assignee = null,
      tags = [],
      startDate = null,
      dueDate = null,
      estimatedHours = null,
      parentTaskId = null,
      phaseId = null
    } = params;

    const id = uuidv4();
    const task = {
      id,
      projectId,
      title,
      description,
      priority,
      status,
      assignee,
      tags,
      startDate,
      dueDate,
      estimatedHours,
      actualHours: null,
      parentTaskId,
      phaseId,
      subtasks: [],
      dependencies: [],
      comments: [],
      attachments: [],
      checklist: [],
      progress: 0,
      completedAt: null,
      type: 'task',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tasks.set(id, task);

    if (parentTaskId) {
      const parent = this.tasks.get(parentTaskId);
      if (parent) {
        parent.subtasks.push(id);
        this.tasks.set(parentTaskId, parent);
      }
    }

    const project = this.projects.get(projectId);
    if (project) {
      project.metrics.totalTasks++;
      project.updatedAt = new Date().toISOString();
      this.projects.set(projectId, project);
    }

    await this.saveTask(task);
    return task;
  }

  async updateTask(id, updates) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);

    const updated = {
      ...task,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    if (updates.status === 'done' && task.status !== 'done') {
      updated.completedAt = new Date().toISOString();
      updated.progress = 100;
    }

    this.tasks.set(id, updated);
    await this.saveTask(updated);
    return updated;
  }

  async deleteTask(id) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);

    for (const subtaskId of task.subtasks) {
      this.tasks.delete(subtaskId);
    }

    this.tasks.delete(id);
    await fs.remove(path.join(this.plannerDir, `task-${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getTask(id) {
    return this.tasks.get(id);
  }

  listTasks(projectId = null, options = {}) {
    const { status, priority, assignee, search, sort = 'createdAt', order = 'desc' } = options;
    let tasks = Array.from(this.tasks.values());

    if (projectId) tasks = tasks.filter(t => t.projectId === projectId);
    if (status) tasks = tasks.filter(t => t.status === status);
    if (priority) tasks = tasks.filter(t => t.priority === priority);
    if (assignee) tasks = tasks.filter(t => t.assignee === assignee);
    if (search) {
      const searchLower = search.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower)
      );
    }

    return tasks.sort((a, b) => {
      if (order === 'desc') return b[sort] > a[sort] ? 1 : -1;
      return a[sort] > b[sort] ? 1 : -1;
    });
  }

  async addDependency(taskId, dependsOnTaskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const dependency = this.tasks.get(dependsOnTaskId);
    if (!dependency) throw new Error(`Dependency task not found: ${dependsOnTaskId}`);

    if (!task.dependencies.includes(dependsOnTaskId)) {
      task.dependencies.push(dependsOnTaskId);
      task.updatedAt = new Date().toISOString();
      this.tasks.set(taskId, task);
    }

    return task;
  }

  async removeDependency(taskId, dependsOnTaskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    task.dependencies = task.dependencies.filter(d => d !== dependsOnTaskId);
    task.updatedAt = new Date().toISOString();
    this.tasks.set(taskId, task);

    return task;
  }

  async getDependencyChain(taskId) {
    const chain = [];
    const visited = new Set();

    const traverse = (id) => {
      if (visited.has(id)) return;
      visited.add(id);

      const task = this.tasks.get(id);
      if (task) {
        chain.push({ id, title: task.title, status: task.status });
        for (const dep of task.dependencies) {
          traverse(dep);
        }
      }
    };

    traverse(taskId);
    return chain;
  }

  async checkCircularDependency(taskId, newDependencyId) {
    const visited = new Set();

    const hasCycle = (id) => {
      if (id === taskId) return true;
      if (visited.has(id)) return false;
      visited.add(id);

      const task = this.tasks.get(id);
      if (task) {
        for (const dep of task.dependencies) {
          if (hasCycle(dep)) return true;
        }
      }

      return false;
    };

    return hasCycle(newDependencyId);
  }

  async getTaskProgress(projectId) {
    const tasks = Array.from(this.tasks.values()).filter(t => t.projectId === projectId);

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const blocked = tasks.filter(t => t.status === 'blocked').length;
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length;

    const byPriority = {
      critical: tasks.filter(t => t.priority === 'critical').length,
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length
    };

    return {
      total,
      completed,
      inProgress,
      blocked,
      overdue,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      byPriority,
      estimatedHours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
      actualHours: tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0)
    };
  }

  async getCriticalPath(projectId) {
    const tasks = Array.from(this.tasks.values()).filter(t => t.projectId === projectId);
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    const getLongestPath = (taskId, visited = new Set()) => {
      if (visited.has(taskId)) return [];
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return [];

      let longestPath = [taskId];

      for (const dep of task.dependencies) {
        const depPath = getLongestPath(dep, visited);
        if (depPath.length > longestPath.length - 1) {
          longestPath = [...depPath, taskId];
        }
      }

      return longestPath;
    };

    let criticalPath = [];

    for (const task of tasks) {
      if (task.dependencies.length === 0) {
        const path = getLongestPath(task.id);
        if (path.length > criticalPath.length) {
          criticalPath = path;
        }
      }
    }

    return criticalPath.map(id => {
      const task = taskMap.get(id);
      return { id, title: task.title, status: task.status };
    });
  }

  async getUpcomingDeadlines(days = 7) {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return Array.from(this.tasks.values())
      .filter(t => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= future && t.status !== 'done')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }

  async searchTasks(query) {
    const queryLower = query.toLowerCase();
    return Array.from(this.tasks.values())
      .filter(t =>
        t.title.toLowerCase().includes(queryLower) ||
        t.description.toLowerCase().includes(queryLower) ||
        t.tags.some(tag => tag.toLowerCase().includes(queryLower))
      )
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  getTemplates() {
    return Array.from(this.templates.values());
  }

  getStrategies() {
    return this.strategyList;
  }

  getPriorities() {
    return this.priorityList;
  }

  async getStats() {
    const projects = Array.from(this.projects.values());
    const tasks = Array.from(this.tasks.values());

    return {
      projects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      tasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'done').length,
      overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length,
      templates: this.templates.size,
      strategies: this.strategyList.length
    };
  }

  async saveProject(project) {
    const filePath = path.join(this.plannerDir, `${project.id}.json`);
    await fs.writeJson(filePath, project, { spaces: 2 });
  }

  async saveTask(task) {
    const filePath = path.join(this.plannerDir, `task-${task.id}.json`);
    await fs.writeJson(filePath, task, { spaces: 2 });
  }

  async exportPlanner(format = 'json') {
    const data = {
      projects: Array.from(this.projects.values()),
      tasks: Array.from(this.tasks.values()),
      templates: Array.from(this.templates.values()),
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = TaskPlannerEngine;
