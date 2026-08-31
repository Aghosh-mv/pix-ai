const { v4: uuidv4 } = require('uuid');

class TodoTrackerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.todos = new Map();
    this.lists = new Map();
    this.reminders = new Map();
    this.history = new Map();
    this.autoUpdates = new Map();

    this.priorities = [
      { id: 'critical', name: 'Critical', icon: '🔴', weight: 10, color: '#F44336' },
      { id: 'high', name: 'High', icon: '🟠', weight: 7, color: '#FF9800' },
      { id: 'medium', name: 'Medium', icon: '🟡', weight: 5, color: '#FFEB3B' },
      { id: 'low', name: 'Low', icon: '🟢', weight: 3, color: '#4CAF50' },
      { id: 'idea', name: 'Idea', icon: '💡', weight: 1, color: '#9C27B0' }
    ];

    this.statuses = [
      { id: 'pending', name: 'Pending', icon: '⏳', color: '#9E9E9E' },
      { id: 'in-progress', name: 'In Progress', icon: '🔄', color: '#2196F3' },
      { id: 'completed', name: 'Completed', icon: '✅', color: '#4CAF50' },
      { id: 'cancelled', name: 'Cancelled', icon: '❌', color: '#F44336' },
      { id: 'blocked', name: 'Blocked', icon: '🚫', color: '#FF5722' },
      { id: 'deferred', name: 'Deferred', icon: '⏰', color: '#FF9800' }
    ];

    this.categories = [
      { id: 'coding', name: 'Coding', icon: '💻', color: '#2196F3' },
      { id: 'debugging', name: 'Debugging', icon: '🐛', color: '#F44336' },
      { id: 'research', name: 'Research', icon: '🔍', color: '#FF9800' },
      { id: 'planning', name: 'Planning', icon: '📋', color: '#4CAF50' },
      { id: 'testing', name: 'Testing', icon: '🧪', color: '#9C27B0' },
      { id: 'deployment', name: 'Deployment', icon: '🚀', color: '#E91E63' },
      { id: 'documentation', name: 'Documentation', icon: '📝', color: '#00BCD4' },
      { id: 'meeting', name: 'Meeting', icon: '📅', color: '#795548' },
      { id: 'learning', name: 'Learning', icon: '📚', color: '#607D8B' },
      { id: 'personal', name: 'Personal', icon: '🏠', color: '#FF5722' },
      { id: 'work', name: 'Work', icon: '💼', color: '#3F51B5' },
      { id: 'health', name: 'Health', icon: '❤️', color: '#E91E63' }
    ];

    this.recurrenceOptions = [
      { id: 'none', name: 'None', description: 'No recurrence' },
      { id: 'daily', name: 'Daily', description: 'Every day' },
      { id: 'weekly', name: 'Weekly', description: 'Every week' },
      { id: 'biweekly', name: 'Bi-weekly', description: 'Every 2 weeks' },
      { id: 'monthly', name: 'Monthly', description: 'Every month' },
      { id: 'yearly', name: 'Yearly', description: 'Every year' },
      { id: 'weekdays', name: 'Weekdays', description: 'Monday-Friday' },
      { id: 'custom', name: 'Custom', description: 'Custom interval' }
    ];

    this.autoUpdateRules = [
      { id: 'auto-complete-subtasks', name: 'Auto-complete Parent', description: 'Complete parent when all subtasks done', trigger: 'all-subtasks-done', action: 'complete-parent' },
      { id: 'auto-start-blocked', name: 'Auto-start Unblocked', description: 'Start task when blockers removed', trigger: 'blocker-removed', action: 'start-task' },
      { id: 'auto-assign-next', name: 'Auto-assign Next', description: 'Auto-assign next pending task', trigger: 'task-completed', action: 'assign-next' },
      { id: 'auto-notify-overdue', name: 'Notify Overdue', description: 'Notify when task is overdue', trigger: 'task-overdue', action: 'send-notification' },
      { id: 'auto-escalate', name: 'Auto-escalate', description: 'Escalate priority if overdue', trigger: 'task-overdue-24h', action: 'escalate-priority' },
      { id: 'auto-archive-completed', name: 'Auto-archive', description: 'Archive completed tasks after 7 days', trigger: 'task-completed-7d', action: 'archive-task' },
      { id: 'auto-sync-progress', name: 'Sync Progress', description: 'Auto-update progress from subtasks', trigger: 'subtask-updated', action: 'sync-progress' },
      { id: 'auto-create-checklist', name: 'Auto-checklist', description: 'Generate checklist from task description', trigger: 'task-created', action: 'create-checklist' }
    ];

    this.views = [
      { id: 'list', name: 'List View', icon: '📋', description: 'Simple list' },
      { id: 'board', name: 'Kanban Board', icon: '📊', description: 'Board view by status' },
      { id: 'timeline', name: 'Timeline', icon: '📅', description: 'Timeline/Gantt view' },
      { id: 'calendar', name: 'Calendar', icon: '📆', description: 'Calendar view' },
      { id: 'priority', name: 'Priority', icon: '🔺', description: 'Sorted by priority' },
      { id: 'category', name: 'Category', icon: '🏷️', description: 'Grouped by category' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Todo Tracker Engine...');
    this.createDefaultList();
    this.loadSettings();
    this.logger.info('Todo Tracker Engine initialized');
  }

  createDefaultList() {
    const id = uuidv4();
    this.lists.set(id, { id, name: 'Default', description: 'Default todo list', todos: [], status: 'active', createdAt: new Date().toISOString() });
  }

  loadSettings() {
    this.settings = { enabled: true, defaultList: Array.from(this.lists.keys())[0], autoUpdateEnabled: true, notificationsEnabled: true, overdueThreshold: 24, archiveAfterDays: 7 };
  }

  createTodo(params) {
    const { title, description = '', listId = this.settings.defaultList, priority = 'medium', status = 'pending', category = null, dueDate = null, recurrence = 'none', tags = [], subtasks = [], dependencies = [], assignee = null, reminder = null } = params;
    const id = uuidv4();
    const todo = { id, title, description, listId, priority, status, category, dueDate, recurrence, tags, subtasks: subtasks.map(s => ({ id: uuidv4(), title: s, completed: false })), dependencies, assignee, reminder, progress: 0, comments: [], attachments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: null };
    this.todos.set(id, todo);
    const list = this.lists.get(listId);
    if (list) { list.todos.push(id); this.lists.set(listId, list); }
    this.triggerAutoUpdate('task-created', todo);
    return todo;
  }

  async updateTodo(id, updates) {
    const todo = this.todos.get(id);
    if (!todo) throw new Error('Todo not found');
    Object.assign(todo, updates, { updatedAt: new Date().toISOString() });
    if (updates.status === 'completed') { todo.completedAt = new Date().toISOString(); todo.progress = 100; }
    this.todos.set(id, todo);
    this.triggerAutoUpdate('task-updated', todo);
    return todo;
  }

  async completeTodo(id) { return this.updateTodo(id, { status: 'completed' }); }
  async cancelTodo(id) { return this.updateTodo(id, { status: 'cancelled' }); }
  async deferTodo(id) { return this.updateTodo(id, { status: 'deferred' }); }

  async addSubtask(todoId, title) {
    const todo = this.todos.get(todoId);
    if (!todo) throw new Error('Todo not found');
    const subtask = { id: uuidv4(), title, completed: false };
    todo.subtasks.push(subtask);
    this.todos.set(todoId, todo);
    return subtask;
  }

  async completeSubtask(todoId, subtaskId) {
    const todo = this.todos.get(todoId);
    if (!todo) throw new Error('Todo not found');
    const subtask = todo.subtasks.find(s => s.id === subtaskId);
    if (!subtask) throw new Error('Subtask not found');
    subtask.completed = true;
    todo.progress = Math.round((todo.subtasks.filter(s => s.completed).length / todo.subtasks.length) * 100);
    this.todos.set(todoId, todo);
    this.triggerAutoUpdate('subtask-updated', todo);
    return todo;
  }

  triggerAutoUpdate(trigger, data) {
    if (!this.settings.autoUpdateEnabled) return;
    const rules = this.autoUpdateRules.filter(r => r.trigger === trigger);
    for (const rule of rules) {
      this.executeAutoUpdate(rule, data);
    }
  }

  async executeAutoUpdate(rule, data) {
    switch (rule.action) {
      case 'complete-parent':
        if (data.subtasks && data.subtasks.every(s => s.completed)) { await this.completeTodo(data.id); }
        break;
      case 'send-notification':
        this.logger.info(`Notification: Task "${data.title}" is overdue`);
        break;
      case 'sync-progress':
        if (data.subtasks) { data.progress = Math.round((data.subtasks.filter(s => s.completed).length / data.subtasks.length) * 100); this.todos.set(data.id, data); }
        break;
    }
  }

  getTodo(id) { return this.todos.get(id); }
  listTodos(listId = null) { let todos = Array.from(this.todos.values()); if (listId) todos = todos.filter(t => t.listId === listId); return todos; }
  listByPriority(priority) { return Array.from(this.todos.values()).filter(t => t.priority === priority); }
  listByStatus(status) { return Array.from(this.todos.values()).filter(t => t.status === status); }
  listByCategory(category) { return Array.from(this.todos.values()).filter(t => t.category === category); }
  listOverdue() { const now = new Date(); return Array.from(this.todos.values()).filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed'); }
  getLists() { return Array.from(this.lists.values()); }
  getPriorities() { return this.priorities; }
  getStatuses() { return this.statuses; }
  getCategories() { return this.categories; }
  getRecurrenceOptions() { return this.recurrenceOptions; }
  getAutoUpdateRules() { return this.autoUpdateRules; }
  getViews() { return this.views; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    const todos = Array.from(this.todos.values());
    return { todos: todos.length, pending: todos.filter(t => t.status === 'pending').length, inProgress: todos.filter(t => t.status === 'in-progress').length, completed: todos.filter(t => t.status === 'completed').length, overdue: this.listOverdue().length, lists: this.lists.size };
  }
}

module.exports = TodoTrackerEngine;
