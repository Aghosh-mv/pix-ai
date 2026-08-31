const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class GoalEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.goals = new Map();
    this.milestones = new Map();
    this.checkIns = new Map();
    this.goalDir = path.join(os.homedir(), '.pix/goals');
  }

  async initialize() {
    this.logger.info('Initializing Goal Engine...');
    await fs.ensureDir(this.goalDir);
    await this.loadGoals();
    this.loadCategories();
    this.logger.info('Goal Engine initialized');
  }

  async loadGoals() {
    try {
      const files = await fs.readdir(this.goalDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.goalDir, file));
          if (data.type === 'goal') this.goals.set(data.id, data);
          else if (data.type === 'milestone') this.milestones.set(data.id, data);
          else if (data.type === 'checkIn') this.checkIns.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadCategories() {
    this.categories = [
      { id: 'career', name: 'Career', icon: '💼', color: '#2196F3' },
      { id: 'health', name: 'Health & Fitness', icon: '💪', color: '#4CAF50' },
      { id: 'finance', name: 'Finance', icon: '💰', color: '#FFC107' },
      { id: 'education', name: 'Education', icon: '📚', color: '#9C27B0' },
      { id: 'personal', name: 'Personal Growth', icon: '🌱', color: '#FF5722' },
      { id: 'relationships', name: 'Relationships', icon: '❤️', color: '#E91E63' },
      { id: 'creative', name: 'Creative', icon: '🎨', color: '#00BCD4' },
      { id: 'other', name: 'Other', icon: '✨', color: '#607D8B' }
    ];
  }

  async createGoal(params) {
    const {
      title,
      description = '',
      category = 'other',
      type = 'binary',
      targetValue = 100,
      unit = '%',
      startDate = new Date().toISOString(),
      deadline = null,
      priority = 'medium',
      tags = []
    } = params;

    const id = uuidv4();
    const goal = {
      id,
      title,
      description,
      category,
      type,
      targetValue,
      currentValue: 0,
      unit,
      progress: 0,
      startDate: new Date(startDate).toISOString(),
      deadline: deadline ? new Date(deadline).toISOString() : null,
      priority,
      tags,
      status: 'active',
      completedAt: null,
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
    updated.progress = Math.min(100, Math.round((updated.currentValue / updated.targetValue) * 100));
    this.goals.set(id, updated);
    return updated;
  }

  async completeGoal(id) {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal not found: ${id}`);

    goal.status = 'completed';
    goal.completedAt = new Date().toISOString();
    goal.progress = 100;
    goal.currentValue = goal.targetValue;
    this.goals.set(id, goal);
    return goal;
  }

  async abandonGoal(id, reason = '') {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal not found: ${id}`);

    goal.status = 'abandoned';
    goal.abandonedAt = new Date().toISOString();
    goal.abandonReason = reason;
    this.goals.set(id, goal);
    return goal;
  }

  async deleteGoal(id) {
    this.goals.delete(id);
    return { success: true };
  }

  listGoals(options = {}) {
    const { status, category, priority, search } = options;
    let goals = Array.from(this.goals.values());

    if (status) goals = goals.filter(g => g.status === status);
    if (category) goals = goals.filter(g => g.category === category);
    if (priority) goals = goals.filter(g => g.priority === priority);
    if (search) {
      const searchLower = search.toLowerCase();
      goals = goals.filter(g => g.title.toLowerCase().includes(searchLower));
    }

    return goals;
  }

  async getGoal(id) {
    return this.goals.get(id);
  }

  async addMilestone(params) {
    const { goalId, title, description = '', targetDate = null, value = null } = params;

    const id = uuidv4();
    const milestone = {
      id,
      goalId,
      title,
      description,
      targetDate: targetDate ? new Date(targetDate).toISOString() : null,
      value,
      completed: false,
      completedAt: null,
      type: 'milestone',
      createdAt: new Date().toISOString()
    };

    this.milestones.set(id, milestone);
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

  async deleteMilestone(id) {
    this.milestones.delete(id);
    return { success: true };
  }

  listMilestones(goalId) {
    return Array.from(this.milestones.values())
      .filter(m => m.goalId === goalId)
      .sort((a, b) => (a.targetDate || a.createdAt) - (b.targetDate || b.createdAt));
  }

  async addCheckIn(params) {
    const { goalId, value, notes = '', mood = null } = params;

    const id = uuidv4();
    const checkIn = {
      id,
      goalId,
      value,
      notes,
      mood,
      type: 'checkIn',
      createdAt: new Date().toISOString()
    };

    this.checkIns.set(id, checkIn);

    const goal = this.goals.get(goalId);
    if (goal) {
      goal.currentValue = value;
      goal.progress = Math.min(100, Math.round((value / goal.targetValue) * 100));
      this.goals.set(goalId, goal);
    }

    return checkIn;
  }

  listCheckIns(goalId, limit = 30) {
    return Array.from(this.checkIns.values())
      .filter(c => c.goalId === goalId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async getGoalProgress(goalId) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal not found: ${goalId}`);

    const checkIns = this.listCheckIns(goalId, 100);
    const milestones = this.listMilestones(goalId);

    const daysActive = Math.ceil(
      (new Date() - new Date(goal.startDate)) / (1000 * 60 * 60 * 24)
    );

    const daysUntilDeadline = goal.deadline
      ? Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      goal,
      checkIns: checkIns.length,
      milestones: milestones.length,
      completedMilestones: milestones.filter(m => m.completed).length,
      daysActive,
      daysUntilDeadline,
      averageValue: checkIns.length > 0
        ? checkIns.reduce((sum, c) => sum + c.value, 0) / checkIns.length
        : 0
    };
  }

  getCategories() {
    return this.categories;
  }

  async getStats() {
    const goals = Array.from(this.goals.values());

    return {
      totalGoals: goals.length,
      active: goals.filter(g => g.status === 'active').length,
      completed: goals.filter(g => g.status === 'completed').length,
      abandoned: goals.filter(g => g.status === 'abandoned').length,
      milestones: this.milestones.size,
      completedMilestones: Array.from(this.milestones.values()).filter(m => m.completed).length,
      checkIns: this.checkIns.size
    };
  }

  async exportGoals(format = 'json') {
    const data = {
      goals: Array.from(this.goals.values()),
      milestones: Array.from(this.milestones.values()),
      checkIns: Array.from(this.checkIns.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = GoalEngine;
