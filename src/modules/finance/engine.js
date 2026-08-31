const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class FinanceEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.accounts = new Map();
    this.transactions = new Map();
    this.budgets = new Map();
    this.goals = new Map();
    this.financeDir = path.join(os.homedir(), '.pix/finance');
  }

  async initialize() {
    this.logger.info('Initializing Finance Engine...');
    await fs.ensureDir(this.financeDir);
    await this.loadAccounts();
    await this.loadTransactions();
    this.loadDefaultCategories();
    this.logger.info('Finance Engine initialized');
  }

  async loadAccounts() {
    try {
      const files = await fs.readdir(this.financeDir);
      for (const file of files) {
        if (file.startsWith('account-') && file.endsWith('.json')) {
          const account = await fs.readJson(path.join(this.financeDir, file));
          this.accounts.set(account.id, account);
        }
      }
    } catch (e) {}
  }

  async loadTransactions() {
    try {
      const files = await fs.readdir(this.financeDir);
      for (const file of files) {
        if (file.startsWith('transaction-') && file.endsWith('.json')) {
          const transaction = await fs.readJson(path.join(this.financeDir, file));
          this.transactions.set(transaction.id, transaction);
        }
      }
    } catch (e) {}
  }

  loadDefaultCategories() {
    this.categories = [
      { id: 'food', name: 'Food & Dining', icon: '🍔', type: 'expense' },
      { id: 'transport', name: 'Transportation', icon: '🚗', type: 'expense' },
      { id: 'housing', name: 'Housing', icon: '🏠', type: 'expense' },
      { id: 'utilities', name: 'Utilities', icon: '💡', type: 'expense' },
      { id: 'entertainment', name: 'Entertainment', icon: '🎬', type: 'expense' },
      { id: 'shopping', name: 'Shopping', icon: '🛒', type: 'expense' },
      { id: 'health', name: 'Health', icon: '💊', type: 'expense' },
      { id: 'education', name: 'Education', icon: '📚', type: 'expense' },
      { id: 'salary', name: 'Salary', icon: '💰', type: 'income' },
      { id: 'freelance', name: 'Freelance', icon: '💻', type: 'income' },
      { id: 'investment', name: 'Investment', icon: '📈', type: 'income' },
      { id: 'other', name: 'Other', icon: '📦', type: 'both' }
    ];
  }

  async createAccount(params) {
    const {
      name,
      type = 'checking',
      balance = 0,
      currency = 'USD',
      color = '#4285f4',
      icon = '💳'
    } = params;

    const id = uuidv4();
    const account = {
      id,
      name,
      type,
      balance,
      currency,
      color,
      icon,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.accounts.set(id, account);
    await this.saveAccount(account);

    this.logger.info(`Account created: ${name}`);
    return account;
  }

  async updateAccount(id, updates) {
    const account = this.accounts.get(id);
    if (!account) throw new Error(`Account not found: ${id}`);

    const updated = {
      ...account,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.accounts.set(id, updated);
    await this.saveAccount(updated);

    return updated;
  }

  async deleteAccount(id) {
    this.accounts.delete(id);
    await fs.remove(path.join(this.financeDir, `account-${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getAccount(id) {
    return this.accounts.get(id);
  }

  listAccounts() {
    return Array.from(this.accounts.values());
  }

  async createTransaction(params) {
    const {
      accountId,
      amount,
      type = 'expense',
      category = 'other',
      description = '',
      date = new Date().toISOString(),
      tags = [],
      toAccountId = null,
      recurring = null
    } = params;

    const id = uuidv4();
    const transaction = {
      id,
      accountId,
      amount: Math.abs(amount),
      type,
      category,
      description,
      date: new Date(date).toISOString(),
      tags,
      toAccountId,
      recurring,
      createdAt: new Date().toISOString()
    };

    this.transactions.set(id, transaction);

    const account = this.accounts.get(accountId);
    if (account) {
      if (type === 'expense') {
        account.balance -= amount;
      } else if (type === 'income') {
        account.balance += amount;
      } else if (type === 'transfer' && toAccountId) {
        account.balance -= amount;
        const toAccount = this.accounts.get(toAccountId);
        if (toAccount) {
          toAccount.balance += amount;
          await this.saveAccount(toAccount);
        }
      }
      await this.saveAccount(account);
    }

    await this.saveTransaction(transaction);

    this.logger.info(`Transaction created: ${description}`);
    return transaction;
  }

  async updateTransaction(id, updates) {
    const transaction = this.transactions.get(id);
    if (!transaction) throw new Error(`Transaction not found: ${id}`);

    const updated = {
      ...transaction,
      ...updates,
      id
    };

    this.transactions.set(id, updated);
    await this.saveTransaction(updated);

    return updated;
  }

  async deleteTransaction(id) {
    this.transactions.delete(id);
    await fs.remove(path.join(this.financeDir, `transaction-${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getTransaction(id) {
    return this.transactions.get(id);
  }

  listTransactions(options = {}) {
    const { accountId, type, category, startDate, endDate, limit = 100 } = options;

    let transactions = Array.from(this.transactions.values());

    if (accountId) transactions = transactions.filter(t => t.accountId === accountId);
    if (type) transactions = transactions.filter(t => t.type === type);
    if (category) transactions = transactions.filter(t => t.category === category);
    if (startDate) transactions = transactions.filter(t => new Date(t.date) >= new Date(startDate));
    if (endDate) transactions = transactions.filter(t => new Date(t.date) <= new Date(endDate));

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    return transactions.slice(0, limit);
  }

  async createBudget(params) {
    const {
      name,
      category,
      amount,
      period = 'monthly',
      startDate = new Date().toISOString()
    } = params;

    const id = uuidv4();
    const budget = {
      id,
      name,
      category,
      amount,
      period,
      startDate: new Date(startDate).toISOString(),
      spent: 0,
      createdAt: new Date().toISOString()
    };

    this.budgets.set(id, budget);
    return budget;
  }

  async updateBudget(id, updates) {
    const budget = this.budgets.get(id);
    if (!budget) throw new Error(`Budget not found: ${id}`);

    const updated = { ...budget, ...updates };
    this.budgets.set(id, updated);
    return updated;
  }

  async deleteBudget(id) {
    this.budgets.delete(id);
    return { success: true };
  }

  listBudgets() {
    return Array.from(this.budgets.values());
  }

  async createGoal(params) {
    const {
      name,
      targetAmount,
      currentAmount = 0,
      deadline = null,
      category = 'savings',
      icon = '🎯'
    } = params;

    const id = uuidv4();
    const goal = {
      id,
      name,
      targetAmount,
      currentAmount,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      category,
      icon,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.goals.set(id, goal);
    return goal;
  }

  async updateGoal(id, updates) {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal not found: ${id}`);

    const updated = {
      ...goal,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.goals.set(id, updated);
    return updated;
  }

  async deleteGoal(id) {
    this.goals.delete(id);
    return { success: true };
  }

  listGoals() {
    return Array.from(this.goals.values());
  }

  async getMonthlySummary(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactions = this.listTransactions({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const byCategory = {};
    for (const t of transactions) {
      if (!byCategory[t.category]) {
        byCategory[t.category] = { income: 0, expense: 0 };
      }
      byCategory[t.category][t.type] += t.amount;
    }

    return {
      year,
      month,
      income,
      expenses,
      net: income - expenses,
      byCategory,
      transactionCount: transactions.length
    };
  }

  async getYearlySummary(year) {
    const monthlySummaries = [];
    for (let month = 1; month <= 12; month++) {
      const summary = await this.getMonthlySummary(year, month);
      monthlySummaries.push(summary);
    }

    const totalIncome = monthlySummaries.reduce((sum, m) => sum + m.income, 0);
    const totalExpenses = monthlySummaries.reduce((sum, m) => sum + m.expenses, 0);

    return {
      year,
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
      monthly: monthlySummaries
    };
  }

  async getStats() {
    const accounts = Array.from(this.accounts.values());
    const transactions = Array.from(this.transactions.values());
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

    return {
      totalAccounts: accounts.length,
      totalBalance,
      totalTransactions: transactions.length,
      budgets: this.budgets.size,
      goals: this.goals.size
    };
  }

  getCategories() {
    return this.categories;
  }

  async exportData(format = 'json') {
    const data = {
      accounts: Array.from(this.accounts.values()),
      transactions: Array.from(this.transactions.values()),
      budgets: Array.from(this.budgets.values()),
      goals: Array.from(this.goals.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }

  async saveAccount(account) {
    const filePath = path.join(this.financeDir, `account-${account.id}.json`);
    await fs.writeJson(filePath, account, { spaces: 2 });
  }

  async saveTransaction(transaction) {
    const filePath = path.join(this.financeDir, `transaction-${transaction.id}.json`);
    await fs.writeJson(filePath, transaction, { spaces: 2 });
  }
}

module.exports = FinanceEngine;
