const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class StrategyEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.strategies = new Map();
    this.plans = new Map();
    this.evaluations = new Map();
    this.strategyDir = path.join(os.homedir(), '.pix/strategy');
  }

  async initialize() {
    this.logger.info('Initializing Strategy Engine...');
    await fs.ensureDir(this.strategyDir);
    await this.loadData();
    this.loadPatterns();
    this.loadAlgorithms();
    this.loadHeuristics();
    this.logger.info('Strategy Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.strategyDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.strategyDir, file));
          if (data.type === 'strategy') this.strategies.set(data.id, data);
          else if (data.type === 'plan') this.plans.set(data.id, data);
          else if (data.type === 'evaluation') this.evaluations.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadPatterns() {
    this.patterns = [
      { id: 'decompose', name: 'Decomposition', icon: '✂️', description: 'Break complex problem into smaller parts' },
      { id: 'pattern-recognition', name: 'Pattern Recognition', icon: '🔍', description: 'Identify patterns in data or problems' },
      { id: 'abstraction', name: 'Abstraction', icon: '🌫️', description: 'Focus on essential features, ignore details' },
      { id: 'generalization', name: 'Generalization', icon: '📊', description: 'Apply solutions from specific to general cases' },
      { id: 'analogy', name: 'Analogy', icon: '🔗', description: 'Use similar problems as reference' },
      { id: 'iteration', name: 'Iteration', icon: '🔄', description: 'Refine solution through repeated cycles' },
      { id: 'backtracking', name: 'Backtracking', icon: '🔙', description: 'Undo decisions when hitting dead ends' },
      { id: 'greedy', name: 'Greedy', icon: '💰', description: 'Make locally optimal choice at each step' },
      { id: 'dynamic', name: 'Dynamic Programming', icon: '💾', description: 'Cache subproblem solutions' },
      { id: 'branch-bound', name: 'Branch and Bound', icon: '🌳', description: 'Prune search space systematically' },
      { id: 'heuristic', name: 'Heuristic', icon: '🎯', description: 'Use rule-of-thumb for quick solutions' },
      { id: 'metaheuristic', name: 'Metaheuristic', icon: '🧬', description: 'Higher-level optimization strategies' }
    ];
  }

  loadAlgorithms() {
    this.algorithms = [
      { id: 'binary-search', name: 'Binary Search', type: 'search', complexity: 'O(log n)', description: 'Efficient search in sorted data' },
      { id: 'quicksort', name: 'Quicksort', type: 'sort', complexity: 'O(n log n)', description: 'Efficient divide-and-conquer sorting' },
      { id: 'bfs', name: 'Breadth-First Search', type: 'graph', complexity: 'O(V + E)', description: 'Explore graph level by level' },
      { id: 'dfs', name: 'Depth-First Search', type: 'graph', complexity: 'O(V + E)', description: 'Explore graph depth first' },
      { id: 'dijkstra', name: "Dijkstra's Algorithm", type: 'graph', complexity: 'O((V + E) log V)', description: 'Shortest path in weighted graph' },
      { id: 'a-star', name: 'A* Search', type: 'graph', complexity: 'O(E)', description: 'Heuristic-guided pathfinding' },
      { id: 'minimax', name: 'Minimax', type: 'game', complexity: 'O(b^d)', description: 'Game theory decision making' },
      { id: 'dynamic-programming', name: 'Dynamic Programming', type: 'optimization', complexity: 'Various', description: 'Optimal substructure problems' },
      { id: 'greedy-algorithm', name: 'Greedy Algorithm', type: 'optimization', complexity: 'Varies', description: 'Locally optimal choices' },
      { id: 'backtracking-algo', name: 'Backtracking', type: 'search', complexity: 'O(n!)', description: 'Systematic trial and error' }
    ];
  }

  loadHeuristics() {
    this.heuristics = [
      { id: 'shortest-path', name: 'Shortest Path First', description: 'Always explore most promising node', icon: '🛤️' },
      { id: 'most-constrained', name: 'Most Constrained Variable', description: 'Start with most constrained choice', icon: '🔗' },
      { id: 'least-constrained', name: 'Least Constrained Value', description: 'Try value that rules out fewest options', icon: '📊' },
      { id: 'forward-checking', name: 'Forward Checking', description: 'Check consistency before assigning', icon: '🔍' },
      { id: 'arc-consistency', name: 'Arc Consistency', description: 'Enforce local consistency', icon: '🔄' },
      { id: 'constraint-propagation', name: 'Constraint Propagation', description: 'Propagate constraints through network', icon: '📡' }
    ];
  }

  async createStrategy(params) {
    const {
      name,
      description = '',
      pattern = 'decompose',
      algorithms = [],
      heuristics = [],
      parameters = {},
      priority = 'medium'
    } = params;

    const id = uuidv4();
    const strategy = {
      id,
      name,
      description,
      pattern,
      algorithms,
      heuristics,
      parameters,
      priority,
      status: 'active',
      successRate: 0,
      usageCount: 0,
      lastUsed: null,
      type: 'strategy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.strategies.set(id, strategy);
    await this.saveStrategy(strategy);
    return strategy;
  }

  async updateStrategy(id, updates) {
    const strategy = this.strategies.get(id);
    if (!strategy) throw new Error(`Strategy not found: ${id}`);

    const updated = {
      ...strategy,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.strategies.set(id, updated);
    await this.saveStrategy(updated);
    return updated;
  }

  async deleteStrategy(id) {
    this.strategies.delete(id);
    await fs.remove(path.join(this.strategyDir, `strategy-${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getStrategy(id) {
    return this.strategies.get(id);
  }

  listStrategies() {
    return Array.from(this.strategies.values());
  }

  async createPlan(params) {
    const {
      strategyId,
      goal,
      context = {},
      constraints = [],
      resources = {},
      maxSteps = 50
    } = params;

    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Strategy not found: ${strategyId}`);

    const id = uuidv4();
    const steps = this.generatePlanSteps(strategy, goal, context, constraints, maxSteps);

    const plan = {
      id,
      strategyId,
      goal,
      context,
      constraints,
      resources,
      steps,
      currentStep: 0,
      status: 'created',
      progress: 0,
      results: [],
      type: 'plan',
      createdAt: new Date().toISOString()
    };

    this.plans.set(id, plan);
    strategy.usageCount++;
    strategy.lastUsed = new Date().toISOString();
    this.strategies.set(strategyId, strategy);

    await this.savePlan(plan);
    await this.saveStrategy(strategy);

    return plan;
  }

  generatePlanSteps(strategy, goal, context, constraints, maxSteps) {
    const steps = [];
    const pattern = this.patterns.find(p => p.id === strategy.pattern);

    steps.push({
      id: uuidv4(),
      order: 1,
      action: 'analyze',
      description: 'Analyze the problem and requirements',
      status: 'pending',
      inputs: { goal, context },
      estimatedTime: '30s'
    });

    if (pattern) {
      steps.push({
        id: uuidv4(),
        order: 2,
        action: 'apply-pattern',
        description: `Apply ${pattern.name} pattern`,
        pattern: strategy.pattern,
        status: 'pending',
        estimatedTime: '1m'
      });
    }

    if (strategy.algorithms.length > 0) {
      steps.push({
        id: uuidv4(),
        order: steps.length + 1,
        action: 'apply-algorithms',
        description: `Apply algorithms: ${strategy.algorithms.join(', ')}`,
        algorithms: strategy.algorithms,
        status: 'pending',
        estimatedTime: '2m'
      });
    }

    if (strategy.heuristics.length > 0) {
      steps.push({
        id: uuidv4(),
        order: steps.length + 1,
        action: 'apply-heuristics',
        description: `Apply heuristics: ${strategy.heuristics.join(', ')}`,
        heuristics: strategy.heuristics,
        status: 'pending',
        estimatedTime: '30s'
      });
    }

    steps.push({
      id: uuidv4(),
      order: steps.length + 1,
      action: 'execute',
      description: 'Execute the plan',
      status: 'pending',
      estimatedTime: '5m'
    });

    steps.push({
      id: uuidv4(),
      order: steps.length + 1,
      action: 'evaluate',
      description: 'Evaluate results',
      status: 'pending',
      estimatedTime: '1m'
    });

    steps.push({
      id: uuidv4(),
      order: steps.length + 1,
      action: 'optimize',
      description: 'Optimize if needed',
      status: 'pending',
      estimatedTime: '2m'
    });

    return steps;
  }

  async executePlan(planId) {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    plan.status = 'executing';
    plan.startedAt = new Date().toISOString();
    this.plans.set(planId, plan);

    return plan;
  }

  async completeStep(planId, stepId, result = null) {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    const step = plan.steps.find(s => s.id === stepId);
    if (!step) throw new Error(`Step not found: ${stepId}`);

    step.status = 'completed';
    step.result = result;
    step.completedAt = new Date().toISOString();

    plan.results.push({ stepId, result });

    const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
    plan.progress = Math.round((completedSteps / plan.steps.length) * 100);
    plan.currentStep = plan.steps.findIndex(s => s.status === 'pending');

    if (plan.currentStep === -1) {
      plan.status = 'completed';
      plan.completedAt = new Date().toISOString();
    }

    this.plans.set(planId, plan);
    return plan;
  }

  async evaluateStrategy(strategyId, params) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) throw new Error(`Strategy not found: ${strategyId}`);

    const { success, duration, metrics = {} } = params;

    const id = uuidv4();
    const evaluation = {
      id,
      strategyId,
      success,
      duration,
      metrics,
      type: 'evaluation',
      createdAt: new Date().toISOString()
    };

    this.evaluations.set(id, evaluation);

    const evaluations = Array.from(this.evaluations.values())
      .filter(e => e.strategyId === strategyId);

    const successCount = evaluations.filter(e => e.success).length;
    strategy.successRate = Math.round((successCount / evaluations.length) * 100);

    this.strategies.set(strategyId, strategy);
    await this.saveEvaluation(evaluation);
    await this.saveStrategy(strategy);

    return evaluation;
  }

  async getStrategyRecommendation(problem, context = {}) {
    const strategies = Array.from(this.strategies.values()).filter(s => s.status === 'active');

    if (strategies.length === 0) {
      return this.createDefaultStrategy(problem);
    }

    const scored = strategies.map(strategy => {
      let score = 50;

      score += strategy.successRate / 2;

      if (strategy.usageCount > 0) {
        score += Math.min(strategy.usageCount / 10, 10);
      }

      const keywords = problem.toLowerCase().split(/\s+/);
      if (keywords.some(k => ['search', 'find', 'locate'].includes(k))) {
        if (strategy.pattern === 'binary-search' || strategy.pattern === 'heuristic') score += 20;
      }
      if (keywords.some(k => ['optimize', 'improve', 'best'].includes(k))) {
        if (strategy.pattern === 'dynamic' || strategy.pattern === 'greedy') score += 20;
      }
      if (keywords.some(k => ['path', 'route', 'navigate'].includes(k))) {
        if (strategy.pattern === 'branch-bound') score += 20;
      }
      if (keywords.some(k => ['game', 'decision', 'compete'].includes(k))) {
        if (strategy.pattern === 'metaheuristic') score += 20;
      }

      return { ...strategy, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  createDefaultStrategy(problem) {
    return {
      id: 'default',
      name: 'Default Strategy',
      description: 'General problem-solving strategy',
      pattern: 'decompose',
      algorithms: ['binary-search', 'dynamic-programming'],
      heuristics: ['shortest-path'],
      parameters: {},
      successRate: 50,
      usageCount: 0
    };
  }

  async analyzeProblem(problem) {
    const analysis = {
      keywords: problem.toLowerCase().split(/\s+/),
      type: this.classifyProblem(problem),
      complexity: this.estimateComplexity(problem),
      requiredPatterns: this.suggestPatterns(problem),
      requiredAlgorithms: this.suggestAlgorithms(problem)
    };

    return analysis;
  }

  classifyProblem(problem) {
    const keywords = problem.toLowerCase().split(/\s+/);

    if (keywords.some(k => ['search', 'find', 'locate', 'lookup'].includes(k))) return 'search';
    if (keywords.some(k => ['sort', 'order', 'arrange', 'organize'].includes(k))) return 'sorting';
    if (keywords.some(k => ['optimize', 'minimize', 'maximize', 'best'].includes(k))) return 'optimization';
    if (keywords.some(k => ['path', 'route', 'navigate', 'graph'].includes(k))) return 'graph';
    if (keywords.some(k => ['game', 'play', 'compete', 'strategy'].includes(k))) return 'game-theory';
    if (keywords.some(k => ['decide', 'choose', 'select', 'recommend'].includes(k))) return 'decision';
    if (keywords.some(k => ['predict', 'forecast', 'estimate'].includes(k))) return 'prediction';
    if (keywords.some(k => ['cluster', 'group', 'classify'].includes(k))) return 'classification';

    return 'general';
  }

  estimateComplexity(problem) {
    const keywords = problem.toLowerCase().split(/\s+/);
    let complexity = 1;

    if (keywords.length > 20) complexity++;
    if (keywords.some(k => ['complex', 'difficult', 'hard', 'challenging'].includes(k))) complexity++;
    if (keywords.some(k => ['optimize', 'perfect', 'best', 'optimal'].includes(k))) complexity++;
    if (keywords.some(k => ['all', 'every', 'complete', 'exhaustive'].includes(k))) complexity++;

    return Math.min(5, complexity);
  }

  suggestPatterns(problem) {
    const analysis = this.analyzeProblemSync(problem);
    const suggestions = [];

    if (analysis.type === 'search') suggestions.push('binary-search', 'pattern-recognition');
    if (analysis.type === 'sorting') suggestions.push('divide-and-conquer');
    if (analysis.type === 'optimization') suggestions.push('dynamic', 'greedy');
    if (analysis.type === 'graph') suggestions.push('branch-bound', 'heuristic');
    if (analysis.type === 'game-theory') suggestions.push('metaheuristic');
    if (analysis.type === 'decision') suggestions.push('abstraction', 'generalization');
    if (analysis.complexity > 3) suggestions.push('decompose', 'iteration');

    if (suggestions.length === 0) suggestions.push('decompose', 'pattern-recognition');

    return suggestions;
  }

  suggestAlgorithms(problem) {
    const analysis = this.analyzeProblemSync(problem);
    const suggestions = [];

    if (analysis.type === 'search') suggestions.push('binary-search', 'bfs', 'dfs');
    if (analysis.type === 'sorting') suggestions.push('quicksort');
    if (analysis.type === 'graph') suggestions.push('dijkstra', 'a-star', 'bfs', 'dfs');
    if (analysis.type === 'game-theory') suggestions.push('minimax');
    if (analysis.type === 'optimization') suggestions.push('dynamic-programming', 'greedy-algorithm');

    return suggestions;
  }

  analyzeProblemSync(problem) {
    const keywords = problem.toLowerCase().split(/\s+/);
    let type = 'general';
    let complexity = 1;

    if (keywords.some(k => ['search', 'find', 'locate'].includes(k))) type = 'search';
    if (keywords.some(k => ['sort', 'order'].includes(k))) type = 'sorting';
    if (keywords.some(k => ['optimize', 'best'].includes(k))) type = 'optimization';
    if (keywords.some(k => ['path', 'graph', 'route'].includes(k))) type = 'graph';
    if (keywords.some(k => ['game', 'compete'].includes(k))) type = 'game-theory';

    if (keywords.length > 20) complexity++;
    if (keywords.some(k => ['complex', 'difficult'].includes(k))) complexity++;

    return { type, complexity };
  }

  getPatterns() {
    return this.patterns;
  }

  getAlgorithms() {
    return this.algorithms;
  }

  getHeuristics() {
    return this.heuristics;
  }

  async getStats() {
    const strategies = Array.from(this.strategies.values());
    const plans = Array.from(this.plans.values());
    const evaluations = Array.from(this.evaluations.values());

    return {
      strategies: strategies.length,
      activeStrategies: strategies.filter(s => s.status === 'active').length,
      plans: plans.length,
      completedPlans: plans.filter(p => p.status === 'completed').length,
      evaluations: evaluations.length,
      averageSuccessRate: strategies.length > 0
        ? Math.round(strategies.reduce((sum, s) => sum + s.successRate, 0) / strategies.length)
        : 0,
      patterns: this.patterns.length,
      algorithms: this.algorithms.length,
      heuristics: this.heuristics.length
    };
  }

  async saveStrategy(strategy) {
    const filePath = path.join(this.strategyDir, `strategy-${strategy.id}.json`);
    await fs.writeJson(filePath, strategy, { spaces: 2 });
  }

  async savePlan(plan) {
    const filePath = path.join(this.strategyDir, `plan-${plan.id}.json`);
    await fs.writeJson(filePath, plan, { spaces: 2 });
  }

  async saveEvaluation(evaluation) {
    const filePath = path.join(this.strategyDir, `evaluation-${evaluation.id}.json`);
    await fs.writeJson(filePath, evaluation, { spaces: 2 });
  }

  async exportStrategy(format = 'json') {
    const data = {
      strategies: Array.from(this.strategies.values()),
      plans: Array.from(this.plans.values()),
      evaluations: Array.from(this.evaluations.values()),
      patterns: this.patterns,
      algorithms: this.algorithms,
      heuristics: this.heuristics,
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = StrategyEngine;
