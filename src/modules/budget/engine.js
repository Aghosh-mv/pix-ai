const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class BudgetEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.budgets = new Map();
    this.expenses = new Map();
    this.income = new Map();
    this.budgetDir = path.join(os.homedir(), '.pix/budget');
  }

  async initialize() {
    this.logger.info('Initializing Budget Engine...');
    await fs.ensureDir(this.budgetDir);
    await this.loadBudgets();
    this.loadDefaultCategories();
    this.logger.info('Budget Engine initialized');
  }

  async loadBudgets() {
    try {
      const files = await fs.readdir(this.budgetDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.budgetDir, file));
          if (data.type === 'budget') this.budgets.set(data.id, data);
          else if (data.type === 'expense') this.expenses.set(data.id, data);
          else if (data.type === 'income') this.income.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadDefaultCategories() {
    this.expenseCategories = [
      { id: 'housing', name: 'Housing', icon: '🏠' },
      { id: 'utilities', name: 'Utilities', icon: '💡' },
      { id: 'food', name: 'Food & Dining', icon: '🍕' },
      { id: 'transport', name: 'Transportation', icon: '🚗' },
      { id: 'healthcare', name: 'Healthcare', icon: '🏥' },
      { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
      { id: 'shopping', name: 'Shopping', icon: '🛍️' },
      { id: 'education', name: 'Education', icon: '📚' },
      { id: 'savings', name: 'Savings', icon: '💰' },
      { id: 'other', name: 'Other', icon: '📦' }
    ];

    this.incomeCategories = [
      { id: 'salary', name: 'Salary', icon: '💼' },
      { id: 'freelance', name: 'Freelance', icon: '💻' },
      { id: 'investment', name: 'Investment', icon: '📈' },
      { id: 'rental', name: 'Rental', icon: '🏠' },
      { id: 'other', name: 'Other', icon: '💵' }
    ];
  }

  async createBudget(params) {
    const {
      name,
      amount,
      period = 'monthly',
      category = 'other',
      startDate = new Date().toISOString(),
      notes = ''
    } = params;

    const id = uuidv4();
    const budget = {
      id,
      name,
      amount,
      period,
      category,
      startDate: new Date(startDate).toISOString(),
      spent: 0,
      remaining: amount,
      notes,
      active: true,
      type: 'budget',
      createdAt: new Date().toISOString()
    };

    this.budgets.set(id, budget);
    return budget;
  }

  async updateBudget(id, updates) {
    const budget = this.budgets.get(id);
    if (!budget) throw new Error(`Budget not found: ${id}`);

    const updated = { ...budget, ...updates };
    updated.remaining = updated.amount - updated.spent;
    this.budgets.set(id, updated);
    return updated;
  }

  async deleteBudget(id) {
    this.budgets.delete(id);
    return { success: true };
  }

  listBudgets(options = {}) {
    const { active, category } = options;
    let budgets = Array.from(this.budgets.values());

    if (active !== undefined) budgets = budgets.filter(b => b.active === active);
    if (category) budgets = budgets.filter(b => b.category === category);

    return budgets;
  }

  async addExpense(params) {
    const {
      amount,
      category,
      description = '',
      date = new Date().toISOString(),
      paymentMethod = 'cash',
      notes = '',
      budgetId = null
    } = params;

    const id = uuidv4();
    const expense = {
      id,
      amount,
      category,
      description,
      date: new Date(date).toISOString(),
      paymentMethod,
      notes,
      budgetId,
      type: 'expense',
      createdAt: new Date().toISOString()
    };

    this.expenses.set(id, expense);

    if (budgetId) {
      const budget = this.budgets.get(budgetId);
      if (budget) {
        budget.spent += amount;
        budget.remaining = budget.amount - budget.spent;
      }
    }

    return expense;
  }

  async updateExpense(id, updates) {
    const expense = this.expenses.get(id);
    if (!expense) throw new Error(`Expense not found: ${id}`);

    const updated = { ...expense, ...updates };
    this.expenses.set(id, updated);
    return updated;
  }

  async deleteExpense(id) {
    const expense = this.expenses.get(id);
    if (expense && expense.budgetId) {
      const budget = this.budgets.get(expense.budgetId);
      if (budget) {
        budget.spent -= expense.amount;
        budget.remaining = budget.amount - budget.spent;
      }
    }

    this.expenses.delete(id);
    return { success: true };
  }

  listExpenses(options = {}) {
    const { category, startDate, endDate, paymentMethod, search } = options;
    let expenses = Array.from(this.expenses.values());

    if (category) expenses = expenses.filter(e => e.category === category);
    if (paymentMethod) expenses = expenses.filter(e => e.paymentMethod === paymentMethod);
    if (search) {
      const searchLower = search.toLowerCase();
      expenses = expenses.filter(e => e.description.toLowerCase().includes(searchLower));
    }

    if (startDate) {
      const start = new Date(startDate);
      expenses = expenses.filter(e => new Date(e.date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      expenses = expenses.filter(e => new Date(e.date) <= end);
    }

    return expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async addIncome(params) {
    const {
      amount,
      category = 'salary',
      description = '',
      date = new Date().toISOString(),
      recurring = false,
      frequency = 'monthly',
      notes = ''
    } = params;

    const id = uuidv4();
    const incomeRecord = {
      id,
      amount,
      category,
      description,
      date: new Date(date).toISOString(),
      recurring,
      frequency,
      notes,
      type: 'income',
      createdAt: new Date().toISOString()
    };

    this.income.set(id, incomeRecord);
    return incomeRecord;
  }

  async updateIncome(id, updates) {
    const incomeRecord = this.income.get(id);
    if (!incomeRecord) throw new Error(`Income not found: ${id}`);

    const updated = { ...incomeRecord, ...updates };
    this.income.set(id, updated);
    return updated;
  }

  async deleteIncome(id) {
    this.income.delete(id);
    return { success: true };
  }

  listIncome(options = {}) {
    const { category, recurring } = options;
    let income = Array.from(this.income.values());

    if (category) income = income.filter(i => i.category === category);
    if (recurring !== undefined) income = income.filter(i => i.recurring === recurring);

    return income.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async getMonthlySummary(year, month) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    const expenses = Array.from(this.expenses.values())
      .filter(e => {
        const date = new Date(e.date);
        return date >= start && date <= end;
      });

    const income = Array.from(this.income.values())
      .filter(i => {
        const date = new Date(i.date);
        return date >= start && date <= end;
      });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);

    return {
      year,
      month,
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
      expensesByCategory: this.groupByCategory(expenses),
      incomeByCategory: this.groupByCategory(income)
    };
  }

  async getYearlySummary(year) {
    const monthlySummaries = [];

    for (let month = 1; month <= 12; month++) {
      const summary = await this.getMonthlySummary(year, month);
      monthlySummaries.push(summary);
    }

    const totalIncome = monthlySummaries.reduce((sum, m) => sum + m.totalIncome, 0);
    const totalExpenses = monthlySummaries.reduce((sum, m) => sum + m.totalExpenses, 0);

    return {
      year,
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
      monthly: monthlySummaries
    };
  }

  groupByCategory(items) {
    const grouped = {};

    for (const item of items) {
      if (!grouped[item.category]) {
        grouped[item.category] = 0;
      }
      grouped[item.category] += item.amount;
    }

    return grouped;
  }

  async getBudgetStats() {
    const budgets = Array.from(this.budgets.values());
    const expenses = Array.from(this.expenses.values());
    const income = Array.from(this.income.values());

    return {
      budgets: budgets.length,
      activeBudgets: budgets.filter(b => b.active).length,
      totalExpenses: expenses.length,
      totalIncome: income.length,
      totalExpenseAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
      totalIncomeAmount: income.reduce((sum, i) => sum + i.amount, 0)
    };
  }

  async exportBudget(format = 'json') {
    const data = {
      budgets: Array.from(this.budgets.values()),
      expenses: Array.from(this.expenses.values()),
      income: Array.from(this.income.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'csv') {
      const headers = ['date', 'type', 'category', 'description', 'amount'];
      const rows = [
        ...expenses.map(e => [e.date, 'expense', e.category, e.description, e.amount]),
        ...income.map(i => [i.date, 'income', i.category, i.description, i.amount])
      ];
      return [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    }

    return data;
  }
}

module.exports = BudgetEngine;
