const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class TodoEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.todos = new Map();
    this.lists = new Map();
    this.tags = new Set();
    this.todoDir = path.join(os.homedir(), '.pix/todos');
  }

  async initialize() {
    this.logger.info('Initializing Todo Engine...');
    await fs.ensureDir(this.todoDir);
    await this.loadTodos();
    this.loadDefaultLists();
    this.logger.info('Todo Engine initialized');
  }

  async loadTodos() {
    try {
      const files = await fs.readdir(this.todoDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const todo = await fs.readJson(path.join(this.todoDir, file));
          this.todos.set(todo.id, todo);
          if (todo.tags) todo.tags.forEach(t => this.tags.add(t));
        }
      }
    } catch (e) {}
  }

  loadDefaultLists() {
    const lists = [
      { id: 'inbox', name: 'Inbox', icon: '📥', color: '#4285f4' },
      { id: 'today', name: 'Today', icon: '📅', color: '#ea4335' },
      { id: 'upcoming', name: 'Upcoming', icon: '📆', color: '#fbbc04' },
      { id: 'completed', name: 'Completed', icon: '✅', color: '#34a853' }
    ];

    lists.forEach(list => {
      this.lists.set(list.id, list);
    });
  }

  async create(params) {
    const {
      title,
      description = '',
      listId = 'inbox',
      priority = 'medium',
      dueDate = null,
      tags = [],
      subtasks = [],
      recurrence = null
    } = params;

    const id = uuidv4();
    const todo = {
      id,
      title,
      description,
      listId,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      tags,
      subtasks: subtasks.map(st => ({
        id: uuidv4(),
        title: st.title || st,
        completed: false
      })),
      recurrence,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.todos.set(id, todo);
    tags.forEach(t => this.tags.add(t));

    await this.saveTodo(todo);

    this.logger.info(`Todo created: ${title}`);
    return todo;
  }

  async update(id, updates) {
    const todo = this.todos.get(id);
    if (!todo) throw new Error(`Todo not found: ${id}`);

    const updated = {
      ...todo,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    if (updates.tags) {
      updates.tags.forEach(t => this.tags.add(t));
    }

    this.todos.set(id, updated);
    await this.saveTodo(updated);

    return updated;
  }

  async complete(id) {
    const todo = this.todos.get(id);
    if (!todo) throw new Error(`Todo not found: ${id}`);

    todo.completed = true;
    todo.completedAt = new Date().toISOString();
    todo.updatedAt = new Date().toISOString();

    if (todo.recurrence) {
      const nextDue = this.calculateNextDue(todo.dueDate, todo.recurrence);
      await this.create({
        title: todo.title,
        description: todo.description,
        listId: todo.listId,
        priority: todo.priority,
        dueDate: nextDue,
        tags: [...todo.tags],
        recurrence: todo.recurrence
      });
    }

    this.todos.set(id, todo);
    await this.saveTodo(todo);

    return todo;
  }

  calculateNextDue(dueDate, recurrence) {
    const date = new Date(dueDate);
    switch (recurrence) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date.toISOString();
  }

  async delete(id) {
    this.todos.delete(id);
    await fs.remove(path.join(this.todoDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async get(id) {
    return this.todos.get(id);
  }

  list(options = {}) {
    const { listId, priority, tags, completed, dueBefore, dueAfter, limit = 100 } = options;

    let todos = Array.from(this.todos.values());

    if (listId) todos = todos.filter(t => t.listId === listId);
    if (priority) todos = todos.filter(t => t.priority === priority);
    if (tags && tags.length > 0) todos = todos.filter(t => tags.some(tag => t.tags.includes(tag)));
    if (completed !== undefined) todos = todos.filter(t => t.completed === completed);
    if (dueBefore) todos = todos.filter(t => t.dueDate && new Date(t.dueDate) <= new Date(dueBefore));
    if (dueAfter) todos = todos.filter(t => t.dueDate && new Date(t.dueDate) >= new Date(dueAfter));

    todos.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return {
      todos: todos.slice(0, limit),
      total: todos.length
    };
  }

  async search(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, todo] of this.todos) {
      let score = 0;

      if (todo.title.toLowerCase().includes(queryLower)) score += 10;
      if (todo.description.toLowerCase().includes(queryLower)) score += 5;
      if (todo.tags.some(t => t.toLowerCase().includes(queryLower))) score += 3;

      if (score > 0) {
        results.push({ ...todo, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async completeSubtask(todoId, subtaskId) {
    const todo = this.todos.get(todoId);
    if (!todo) throw new Error(`Todo not found: ${todoId}`);

    const subtask = todo.subtasks.find(st => st.id === subtaskId);
    if (!subtask) throw new Error(`Subtask not found: ${subtaskId}`);

    subtask.completed = !subtask.completed;
    todo.updatedAt = new Date().toISOString();

    this.todos.set(todoId, todo);
    await this.saveTodo(todo);

    return todo;
  }

  async addSubtask(id, title) {
    const todo = this.todos.get(id);
    if (!todo) throw new Error(`Todo not found: ${id}`);

    todo.subtasks.push({
      id: uuidv4(),
      title,
      completed: false
    });

    todo.updatedAt = new Date().toISOString();
    this.todos.set(id, todo);
    await this.saveTodo(todo);

    return todo;
  }

  async removeSubtask(todoId, subtaskId) {
    const todo = this.todos.get(todoId);
    if (!todo) throw new Error(`Todo not found: ${todoId}`);

    todo.subtasks = todo.subtasks.filter(st => st.id !== subtaskId);
    todo.updatedAt = new Date().toISOString();

    this.todos.set(todoId, todo);
    await this.saveTodo(todo);

    return todo;
  }

  createList(params) {
    const { id, name, icon = '📋', color = '#4285f4' } = params;
    const list = { id, name, icon, color };
    this.lists.set(id, list);
    return list;
  }

  updateList(id, updates) {
    const list = this.lists.get(id);
    if (!list) throw new Error(`List not found: ${id}`);

    const updated = { ...list, ...updates };
    this.lists.set(id, updated);
    return updated;
  }

  deleteList(id) {
    this.lists.delete(id);
    return { success: true };
  }

  listLists() {
    return Array.from(this.lists.values());
  }

  getAllTags() {
    return Array.from(this.tags);
  }

  async getTodayTodos() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.list({
      completed: false,
      dueBefore: tomorrow.toISOString(),
      dueAfter: today.toISOString()
    });
  }

  async getOverdueTodos() {
    return this.list({
      completed: false,
      dueBefore: new Date().toISOString()
    });
  }

  async getUpcomingTodos(days = 7) {
    const now = new Date();
    const future = new Date(now);
    future.setDate(future.getDate() + days);

    return this.list({
      completed: false,
      dueAfter: now.toISOString(),
      dueBefore: future.toISOString()
    });
  }

  async getStats() {
    const todos = Array.from(this.todos.values());
    const completed = todos.filter(t => t.completed);
    const pending = todos.filter(t => !t.completed);

    return {
      total: todos.length,
      completed: completed.length,
      pending: pending.length,
      overdue: (await this.getOverdueTodos()).total,
      today: (await this.getTodayTodos()).total,
      lists: this.lists.size,
      tags: this.tags.size
    };
  }

  async exportTodos(format = 'json') {
    const todos = Array.from(this.todos.values());

    if (format === 'json') {
      return JSON.stringify(todos, null, 2);
    }

    if (format === 'markdown') {
      let md = '# Todo List\n\n';
      for (const todo of todos) {
        const checkbox = todo.completed ? '[x]' : '[ ]';
        md += `- ${checkbox} ${todo.title}`;
        if (todo.dueDate) md += ` (Due: ${new Date(todo.dueDate).toLocaleDateString()})`;
        md += '\n';
      }
      return md;
    }

    return todos;
  }

  async importTodos(data) {
    const todos = Array.isArray(data) ? data : JSON.parse(data);
    let imported = 0;

    for (const todo of todos) {
      await this.create({
        title: todo.title,
        description: todo.description,
        listId: todo.listId,
        priority: todo.priority,
        dueDate: todo.dueDate,
        tags: todo.tags || [],
        completed: todo.completed
      });
      imported++;
    }

    return { imported };
  }

  async saveTodo(todo) {
    const filePath = path.join(this.todoDir, `${todo.id}.json`);
    await fs.writeJson(filePath, todo, { spaces: 2 });
  }
}

module.exports = TodoEngine;
