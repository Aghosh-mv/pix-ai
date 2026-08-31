const fs = require('fs');
const path = require('path');

class CostTracker {
  constructor(pixHome) {
    this.costFile = path.join(pixHome, 'costs.json');
    this.configFile = path.join(pixHome, 'budget-config.json');
  }

  loadCosts() {
    try {
      if (fs.existsSync(this.costFile)) return JSON.parse(fs.readFileSync(this.costFile, 'utf8'));
    } catch (e) {}
    return { sessions: [], totalCost: 0, totalTokens: 0 };
  }

  saveCosts(costs) {
    fs.writeFileSync(this.costFile, JSON.stringify(costs, null, 2));
  }

  loadBudget() {
    try {
      if (fs.existsSync(this.configFile)) return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
    } catch (e) {}
    return { dailyLimit: 5.0, monthlyLimit: 50.0, alertAt: 0.8, enabled: false };
  }

  saveBudget(budget) {
    fs.writeFileSync(this.configFile, JSON.stringify(budget, null, 2));
  }

  logUsage(provider, model, inputTokens, outputTokens) {
    const costs = this.loadCosts();
    const pricing = this.getPricing(provider, model);
    const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;

    const entry = {
      timestamp: new Date().toISOString(),
      provider, model,
      inputTokens, outputTokens,
      cost: Math.round(cost * 1000000) / 1000000
    };

    costs.sessions.push(entry);
    costs.totalCost = Math.round((costs.totalCost + cost) * 1000000) / 1000000;
    costs.totalTokens += inputTokens + outputTokens;
    this.saveCosts(costs);

    this.checkBudget(costs.totalCost);
    return entry;
  }

  getPricing(provider, model) {
    const prices = {
      'openrouter': { input: 0.00015, output: 0.0006 },
      'gemini': { input: 0.00025, output: 0.0005 },
      'groq': { input: 0.00005, output: 0.00008 },
      'openai': { input: 0.0005, output: 0.0015 },
      'anthropic': { input: 0.00025, output: 0.00125 },
      'mistral': { input: 0.0002, output: 0.0006 }
    };
    return prices[provider] || { input: 0.0001, output: 0.0003 };
  }

  checkBudget(totalCost) {
    const budget = this.loadBudget();
    if (!budget.enabled) return null;
    const today = new Date().toISOString().split('T')[0];
    const todayCosts = this.loadCosts().sessions
      .filter(s => s.timestamp.startsWith(today))
      .reduce((sum, s) => sum + s.cost, 0);

    if (todayCosts >= budget.dailyLimit) return { exceeded: true, type: 'daily', amount: todayCosts, limit: budget.dailyLimit };
    if (todayCosts >= budget.dailyLimit * budget.alertAt) return { warning: true, type: 'daily', amount: todayCosts, limit: budget.dailyLimit };
    return null;
  }

  getStats() {
    const costs = this.loadCosts();
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = costs.sessions.filter(s => s.timestamp.startsWith(today));
    const todayCost = todaySessions.reduce((sum, s) => sum + s.cost, 0);

    const byProvider = {};
    costs.sessions.forEach(s => {
      if (!byProvider[s.provider]) byProvider[s.provider] = { cost: 0, tokens: 0, calls: 0 };
      byProvider[s.provider].cost += s.cost;
      byProvider[s.provider].tokens += s.inputTokens + s.outputTokens;
      byProvider[s.provider].calls++;
    });

    return {
      total: costs.totalCost,
      totalTokens: costs.totalTokens,
      totalCalls: costs.sessions.length,
      today: todayCost,
      todayCalls: todaySessions.length,
      byProvider,
      budget: this.loadBudget()
    };
  }

  getDailyHistory(days = 7) {
    const costs = this.loadCosts();
    const history = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayCosts = costs.sessions.filter(s => s.timestamp.startsWith(dateStr));
      history.push({
        date: dateStr,
        cost: dayCosts.reduce((sum, s) => sum + s.cost, 0),
        calls: dayCosts.length,
        tokens: dayCosts.reduce((sum, s) => sum + s.inputTokens + s.outputTokens, 0)
      });
    }
    return history.reverse();
  }
}

module.exports = CostTracker;
