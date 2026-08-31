const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ProjectEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.projects = new Map();
    this.tasks = new Map();
    this.milestones = new Map();
    this.teamMembers = new Map();
    this.projectDir = path.join(os.homedir(), '.pix/projects');
  }

  async initialize() {
    this.logger.info('Initializing Project Engine...');
    await fs.ensureDir(this.projectDir);
    await this.loadProjects();
    this.loadTemplates();
    this.loadStatuses();
    this.logger.info('Project Engine initialized');
  }

  async loadProjects() {
    try {
      const files = await fs.readdir(this.projectDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.projectDir, file));
          if (data.type === 'project') this.projects.set(data.id, data);
          else if (data.type === 'task') this.tasks.set(data.id, data);
          else if (data.type === 'milestone') this.milestones.set(data.id, data);
          else if (data.type === 'teamMember') this.teamMembers.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadTemplates() {
    this.templates = [
      {
        id: 'software',
        name: 'Software Development',
        description: 'Agile software development project',
        tasks: [
          'Requirements Gathering',
          'Architecture Design',
          'Implementation',
          'Testing',
          'Deployment'
        ]
      },
      {
        id: 'marketing',
        name: 'Marketing Campaign',
        description: 'Marketing campaign project',
        tasks: [
          'Market Research',
          'Strategy Planning',
          'Content Creation',
          'Launch',
          'Analysis'
        ]
      },
      {
        id: 'event',
        name: 'Event Planning',
        description: 'Event planning project',
        tasks: [
          'Venue Selection',
          'Budget Planning',
          'Vendor Management',
          'Marketing',
          'Execution'
        ]
      }
    ];
  }

  loadStatuses() {
    this.statuses = [
      { id: 'planning', name: 'Planning', color: '#9E9E9E', icon: '📋' },
      { id: 'active', name: 'Active', color: '#4CAF50', icon: '🚀' },
      { id: 'on-hold', name: 'On Hold', color: '#FFC107', icon: '⏸️' },
      { id: 'completed', name: 'Completed', color: '#2196F3', icon: '✅' },
      { id: 'cancelled', name: 'Cancelled', color: '#F44336', icon: '❌' }
    ];
  }

  async createProject(params) {
    const {
      name,
      description = '',
      status = 'planning',
      startDate = new Date().toISOString(),
      endDate = null,
      budget = 0,
      priority = 'medium',
      template = null,
      tags = []
    } = params;

    const id = uuidv4();
    const project = {
      id,
      name,
      description,
      status,
      startDate: new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : null,
      budget,
      spent: 0,
      priority,
      tags,
      taskIds: [],
      milestoneIds: [],
      teamMemberIds: [],
      progress: 0,
      type: 'project',
      createdAt: new Date().toISOString()
    };

    if (template) {
      const templateObj = this.templates.find(t => t.id === template);
      if (templateObj) {
        for (const taskName of templateObj.tasks) {
          const taskId = uuidv4();
          this.tasks.set(taskId, {
            id: taskId,
            projectId: id,
            title: taskName,
            status: 'pending',
            priority: 'medium',
            type: 'task',
            createdAt: new Date().toISOString()
          });
          project.taskIds.push(taskId);
        }
      }
    }

    this.projects.set(id, project);
    return project;
  }

  async updateProject(id, updates) {
    const project = this.projects.get(id);
    if (!project) throw new Error(`Project not found: ${id}`);

    const updated = { ...project, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  async completeProject(id) {
    const project = this.projects.get(id);
    if (!project) throw new Error(`Project not found: ${id}`);

    project.status = 'completed';
    project.completedAt = new Date().toISOString();
    project.progress = 100;
    this.projects.set(id, project);
    return project;
  }

  async deleteProject(id) {
    this.projects.delete(id);

    for (const [taskId, task] of this.tasks) {
      if (task.projectId === id) this.tasks.delete(taskId);
    }

    return { success: true };
  }

  async getProject(id) {
    return this.projects.get(id);
  }

  listProjects(options = {}) {
    const { status, priority, search } = options;
    let projects = Array.from(this.projects.values());

    if (status) projects = projects.filter(p => p.status === status);
    if (priority) projects = projects.filter(p => p.priority === priority);
    if (search) {
      const searchLower = search.toLowerCase();
      projects = projects.filter(p => p.name.toLowerCase().includes(searchLower));
    }

    return projects;
  }

  async addTask(params) {
    const {
      projectId,
      title,
      description = '',
      status = 'pending',
      priority = 'medium',
      assigneeId = null,
      dueDate = null,
      estimatedHours = 0,
      tags = []
    } = params;

    const id = uuidv4();
    const task = {
      id,
      projectId,
      title,
      description,
      status,
      priority,
      assigneeId,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      estimatedHours,
      actualHours: 0,
      tags,
      dependencies: [],
      subtaskIds: [],
      type: 'task',
      createdAt: new Date().toISOString()
    };

    this.tasks.set(id, task);

    const project = this.projects.get(projectId);
    if (project) {
      project.taskIds.push(id);
    }

    return task;
  }

  async updateTask(id, updates) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);

    const updated = { ...task, ...updates };
    this.tasks.set(id, updated);

    await this.updateProjectProgress(task.projectId);
    return updated;
  }

  async completeTask(id) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task not found: ${id}`);

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    this.tasks.set(id, task);

    await this.updateProjectProgress(task.projectId);
    return task;
  }

  async deleteTask(id) {
    const task = this.tasks.get(id);
    if (task) {
      const project = this.projects.get(task.projectId);
      if (project) {
        project.taskIds = project.taskIds.filter(tid => tid !== id);
      }
    }

    this.tasks.delete(id);
    return { success: true };
  }

  async getTask(id) {
    return this.tasks.get(id);
  }

  listTasks(projectId = null, options = {}) {
    const { status, priority, assigneeId } = options;
    let tasks = Array.from(this.tasks.values());

    if (projectId) tasks = tasks.filter(t => t.projectId === projectId);
    if (status) tasks = tasks.filter(t => t.status === status);
    if (priority) tasks = tasks.filter(t => t.priority === priority);
    if (assigneeId) tasks = tasks.filter(t => t.assigneeId === assigneeId);

    return tasks;
  }

  async addMilestone(params) {
    const {
      projectId,
      title,
      description = '',
      dueDate,
      taskIds = []
    } = params;

    const id = uuidv4();
    const milestone = {
      id,
      projectId,
      title,
      description,
      dueDate: new Date(dueDate).toISOString(),
      taskIds,
      completed: false,
      completedAt: null,
      type: 'milestone',
      createdAt: new Date().toISOString()
    };

    this.milestones.set(id, milestone);

    const project = this.projects.get(projectId);
    if (project) {
      project.milestoneIds.push(id);
    }

    return milestone;
  }

  async completeMilestone(id) {
    const milestone = this.milestones.get(id);
    if (!milestone) throw new Error(`Milestone not found: ${id}`);

    milestone.completed = true;
    milestone.completedAt = new Date().toISOString();
    this.milestones.set(id, milestone);
    return milestone;
  }

  listMilestones(projectId) {
    return Array.from(this.milestones.values())
      .filter(m => m.projectId === projectId);
  }

  async addTeamMember(params) {
    const {
      projectId,
      name,
      role = 'member',
      email = '',
      hourlyRate = 0
    } = params;

    const id = uuidv4();
    const member = {
      id,
      projectId,
      name,
      role,
      email,
      hourlyRate,
      tasksAssigned: 0,
      type: 'teamMember',
      createdAt: new Date().toISOString()
    };

    this.teamMembers.set(id, member);

    const project = this.projects.get(projectId);
    if (project) {
      project.teamMemberIds.push(id);
    }

    return member;
  }

  async updateTeamMember(id, updates) {
    const member = this.teamMembers.get(id);
    if (!member) throw new Error(`Team member not found: ${id}`);

    const updated = { ...member, ...updates };
    this.teamMembers.set(id, updated);
    return updated;
  }

  listTeamMembers(projectId) {
    return Array.from(this.teamMembers.values())
      .filter(m => m.projectId === projectId);
  }

  async updateProjectProgress(projectId) {
    const project = this.projects.get(projectId);
    if (!project) return;

    const tasks = this.listTasks(projectId);
    if (tasks.length === 0) return;

    const completedTasks = tasks.filter(t => t.status === 'completed');
    project.progress = Math.round((completedTasks.length / tasks.length) * 100);
    this.projects.set(projectId, project);
  }

  async getProjectStats(projectId) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const tasks = this.listTasks(projectId);
    const milestones = this.listMilestones(projectId);
    const teamMembers = this.listTeamMembers(projectId);

    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const totalActualHours = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);

    return {
      project,
      tasks: {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        pending: tasks.filter(t => t.status === 'pending').length
      },
      milestones: {
        total: milestones.length,
        completed: milestones.filter(m => m.completed).length
      },
      teamMembers: teamMembers.length,
      hours: {
        estimated: totalEstimatedHours,
        actual: totalActualHours
      }
    };
  }

  getTemplates() {
    return this.templates;
  }

  getStatuses() {
    return this.statuses;
  }

  async getOverallStats() {
    const projects = Array.from(this.projects.values());
    const tasks = Array.from(this.tasks.values());

    return {
      projects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      tasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      milestones: this.milestones.size,
      teamMembers: this.teamMembers.size
    };
  }

  async exportProjects(format = 'json') {
    const data = {
      projects: Array.from(this.projects.values()),
      tasks: Array.from(this.tasks.values()),
      milestones: Array.from(this.milestones.values()),
      teamMembers: Array.from(this.teamMembers.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = ProjectEngine;
