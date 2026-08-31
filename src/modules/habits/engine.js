const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class HabitEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.habits = new Map();
    this.completions = new Map();
    this.habitDir = path.join(os.homedir(), '.pix/habits');
  }

  async initialize() {
    this.logger.info('Initializing Habit Engine...');
    await fs.ensureDir(this.habitDir);
    await this.loadHabits();
    this.logger.info('Habit Engine initialized');
  }

  async loadHabits() {
    try {
      const files = await fs.readdir(this.habitDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const habit = await fs.readJson(path.join(this.habitDir, file));
          this.habits.set(habit.id, habit);
        }
      }
    } catch (e) {}
  }

  async create(params) {
    const {
      name,
      description = '',
      frequency = 'daily',
      targetCount = 1,
      category = 'health',
      color = '#4285f4',
      icon = '✅',
      reminderTime = null,
      startDate = new Date().toISOString()
    } = params;

    const id = uuidv4();
    const habit = {
      id,
      name,
      description,
      frequency,
      targetCount,
      category,
      color,
      icon,
      reminderTime,
      startDate: new Date(startDate).toISOString(),
      currentStreak: 0,
      bestStreak: 0,
      totalCompletions: 0,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.habits.set(id, habit);
    await this.saveHabit(habit);

    this.logger.info(`Habit created: ${name}`);
    return habit;
  }

  async update(id, updates) {
    const habit = this.habits.get(id);
    if (!habit) throw new Error(`Habit not found: ${id}`);

    const updated = {
      ...habit,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.habits.set(id, updated);
    await this.saveHabit(updated);

    return updated;
  }

  async delete(id) {
    this.habits.delete(id);
    await fs.remove(path.join(this.habitDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async get(id) {
    return this.habits.get(id);
  }

  async complete(id, date = new Date().toISOString()) {
    const habit = this.habits.get(id);
    if (!habit) throw new Error(`Habit not found: ${id}`);

    const dateStr = new Date(date).toISOString().split('T')[0];
    const completionId = `${id}:${dateStr}`;

    if (!this.completions.has(completionId)) {
      this.completions.set(completionId, {
        habitId: id,
        date: dateStr,
        completedAt: new Date().toISOString()
      });

      habit.totalCompletions++;
      habit.currentStreak++;
      if (habit.currentStreak > habit.bestStreak) {
        habit.bestStreak = habit.currentStreak;
      }

      habit.updatedAt = new Date().toISOString();
      this.habits.set(id, habit);
      await this.saveHabit(habit);
    }

    return habit;
  }

  async uncomplete(id, date = new Date().toISOString()) {
    const habit = this.habits.get(id);
    if (!habit) throw new Error(`Habit not found: ${id}`);

    const dateStr = new Date(date).toISOString().split('T')[0];
    const completionId = `${id}:${dateStr}`;

    if (this.completions.has(completionId)) {
      this.completions.delete(completionId);

      habit.totalCompletions = Math.max(0, habit.totalCompletions - 1);
      habit.currentStreak = Math.max(0, habit.currentStreak - 1);

      habit.updatedAt = new Date().toISOString();
      this.habits.set(id, habit);
      await this.saveHabit(habit);
    }

    return habit;
  }

  async getCompletions(id, startDate, endDate) {
    const completions = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (const [key, completion] of this.completions) {
      if (completion.habitId === id) {
        const completionDate = new Date(completion.date);
        if (completionDate >= start && completionDate <= end) {
          completions.push(completion);
        }
      }
    }

    return completions.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async isCompleted(id, date = new Date().toISOString()) {
    const dateStr = new Date(date).toISOString().split('T')[0];
    const completionId = `${id}:${dateStr}`;
    return this.completions.has(completionId);
  }

  list(options = {}) {
    const { category, active, limit = 100 } = options;

    let habits = Array.from(this.habits.values());

    if (category) habits = habits.filter(h => h.category === category);
    if (active !== undefined) habits = habits.filter(h => h.active === active);

    return habits.slice(0, limit);
  }

  async getTodayHabits() {
    const habits = this.list({ active: true });
    const today = new Date().toISOString().split('T')[0];

    for (const habit of habits) {
      habit.completedToday = await this.isCompleted(habit.id, today);
    }

    return habits;
  }

  async getWeeklyStats() {
    const habits = this.list({ active: true });
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const stats = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      let completed = 0;
      for (const habit of habits) {
        if (await this.isCompleted(habit.id, dateStr)) {
          completed++;
        }
      }

      stats.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        completed,
        total: habits.length,
        percentage: habits.length > 0 ? Math.round((completed / habits.length) * 100) : 0
      });
    }

    return stats;
  }

  async getMonthlyStats() {
    const habits = this.list({ active: true });
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    let totalCompleted = 0;
    let totalPossible = 0;

    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      for (const habit of habits) {
        totalPossible++;
        if (await this.isCompleted(habit.id, dateStr)) {
          totalCompleted++;
        }
      }
    }

    return {
      completed: totalCompleted,
      possible: totalPossible,
      percentage: totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0
    };
  }

  async getStats() {
    const habits = this.list();
    const activeHabits = habits.filter(h => h.active);
    const totalCompletions = habits.reduce((sum, h) => sum + h.totalCompletions, 0);
    const bestStreak = Math.max(...habits.map(h => h.bestStreak), 0);

    return {
      totalHabits: habits.length,
      activeHabits: activeHabits.length,
      totalCompletions,
      bestStreak,
      categories: this.getCategories()
    };
  }

  getCategories() {
    const categories = new Map();
    for (const habit of this.habits.values()) {
      categories.set(habit.category, (categories.get(habit.category) || 0) + 1);
    }
    return Object.fromEntries(categories);
  }

  async saveHabit(habit) {
    const filePath = path.join(this.habitDir, `${habit.id}.json`);
    await fs.writeJson(filePath, habit, { spaces: 2 });
  }

  async exportHabits(format = 'json') {
    const habits = Array.from(this.habits.values());

    if (format === 'json') {
      return JSON.stringify(habits, null, 2);
    }

    return habits;
  }
}

module.exports = HabitEngine;
