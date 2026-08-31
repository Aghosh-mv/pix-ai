const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn, exec, execSync } = require('child_process');

class AIAgentCore {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.agents = new Map();
    this.sessions = new Map();
    this.thoughts = new Map();
    this.plans = new Map();
    this.memories = new Map();
    this.agentDir = path.join(os.homedir(), '.pix/agent');
    this.sandboxDir = path.join(os.homedir(), '.pix/sandbox');
  }

  async initialize() {
    this.logger.info('Initializing AI Agent Core...');
    await fs.ensureDir(this.agentDir);
    await fs.ensureDir(this.sandboxDir);
    await this.loadAgents();
    this.loadCapabilities();
    this.loadStrategies();
    this.loadPersonality();
    this.logger.info('AI Agent Core initialized');
  }

  async loadAgents() {
    try {
      const files = await fs.readdir(this.agentDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.agentDir, file));
          if (data.type === 'agent') this.agents.set(data.id, data);
          else if (data.type === 'session') this.sessions.set(data.id, data);
          else if (data.type === 'thought') this.thoughts.set(data.id, data);
          else if (data.type === 'plan') this.plans.set(data.id, data);
          else if (data.type === 'memory') this.memories.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadCapabilities() {
    this.capabilities = [
      { id: 'think', name: 'Think & Reason', icon: '🧠', description: 'Analyze problems, break them down, and reason through solutions', enabled: true },
      { id: 'plan', name: 'Plan & Strategize', icon: '📋', description: 'Create step-by-step plans with dependencies and priorities', enabled: true },
      { id: 'execute', name: 'Execute Commands', icon: '⚡', description: 'Run shell commands, scripts, and programs', enabled: true },
      { id: 'code', name: 'Write & Edit Code', icon: '💻', description: 'Create, modify, and debug code files', enabled: true },
      { id: 'web', name: 'Web Browsing', icon: '🌐', description: 'Fetch web pages, search, and interact with websites', enabled: true },
      { id: 'click', name: 'Click & Interact', icon: '🖱️', description: 'Click buttons, fill forms, and interact with UI elements', enabled: true },
      { id: 'type', name: 'Type & Input', icon: '⌨️', description: 'Type text, fill fields, and send input', enabled: true },
      { id: 'files', name: 'File Operations', icon: '📁', description: 'Read, write, create, delete, and manage files', enabled: true },
      { id: 'terminal', name: 'Terminal Access', icon: '🖥️', description: 'Full terminal access with AI assistance', enabled: true },
      { id: 'sandbox', name: 'Sandbox Execution', icon: '📦', description: 'Run code in isolated sandbox environments', enabled: true },
      { id: 'memory', name: 'Long-term Memory', icon: '🧠', description: 'Remember past interactions and learn from them', enabled: true },
      { id: 'monitor', name: 'Monitor & Observe', icon: '👁️', description: 'Watch processes, logs, and system activity', enabled: true },
      { id: 'automate', name: 'Automate Tasks', icon: '🤖', description: 'Create and run automation workflows', enabled: true },
      { id: 'analyze', name: 'Analyze Data', icon: '📊', description: 'Parse, analyze, and visualize data', enabled: true }
    ];
  }

  loadStrategies() {
    this.strategies = [
      { id: 'sequential', name: 'Sequential', description: 'Execute steps one by one', icon: '➡️' },
      { id: 'parallel', name: 'Parallel', description: 'Execute independent steps simultaneously', icon: '↔️' },
      { id: 'recursive', name: 'Recursive', description: 'Break problem into sub-problems', icon: '🔄' },
      { id: 'trial-error', name: 'Trial and Error', description: 'Try different approaches until one works', icon: '🎲' },
      { id: 'divide-conquer', name: 'Divide and Conquer', description: 'Split problem into independent parts', icon: '✂️' },
      { id: 'backtracking', name: 'Backtracking', description: 'Undo steps when hitting dead ends', icon: '🔙' },
      { id: 'greedy', name: 'Greedy', description: 'Always choose locally optimal option', icon: '💰' },
      { id: 'dynamic', name: 'Dynamic Programming', description: 'Cache results of subproblems', icon: '💾' }
    ];
  }

  loadPersonality() {
    this.personality = {
      name: 'Pix',
      traits: ['helpful', 'curious', 'thorough', 'creative', 'reliable'],
      communicationStyle: 'concise and technical',
      problemSolving: 'methodical and systematic',
      learningMode: 'active - learns from every interaction'
    };
  }

  async createAgent(params) {
    const {
      name = 'Pix Agent',
      description = 'AI Assistant Agent',
      capabilities = [],
      personality = {},
      model = null
    } = params;

    const id = uuidv4();
    const agent = {
      id,
      name,
      description,
      capabilities: capabilities.length > 0 ? capabilities : this.capabilities.map(c => c.id),
      personality: { ...this.personality, ...personality },
      model,
      status: 'idle',
      currentTask: null,
      tasksCompleted: 0,
      tasksFailed: 0,
      memory: [],
      context: [],
      type: 'agent',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };

    this.agents.set(id, agent);
    await this.saveAgent(agent);
    return agent;
  }

  async updateAgent(id, updates) {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Agent not found: ${id}`);

    const updated = {
      ...agent,
      ...updates,
      id,
      lastActive: new Date().toISOString()
    };

    this.agents.set(id, updated);
    await this.saveAgent(updated);
    return updated;
  }

  async deleteAgent(id) {
    this.agents.delete(id);
    await fs.remove(path.join(this.agentDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getAgent(id) {
    return this.agents.get(id);
  }

  listAgents() {
    return Array.from(this.agents.values());
  }

  async think(params) {
    const { agentId, problem, context = [], depth = 'medium' } = params;
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    const thoughtId = uuidv4();
    const thought = {
      id: thoughtId,
      agentId,
      problem,
      context,
      depth,
      steps: [],
      conclusion: null,
      confidence: 0,
      type: 'thought',
      createdAt: new Date().toISOString()
    };

    const analysisSteps = this.analyzeProblem(problem, context, depth);
    thought.steps = analysisSteps;
    thought.conclusion = this.synthesizeConclusion(analysisSteps);
    thought.confidence = this.calculateConfidence(analysisSteps);

    this.thoughts.set(thoughtId, thought);
    agent.context.push({ type: 'thought', id: thoughtId, summary: thought.conclusion });
    agent.lastActive = new Date().toISOString();
    this.agents.set(agentId, agent);

    return thought;
  }

  analyzeProblem(problem, context, depth) {
    const steps = [];
    const depthMultiplier = { shallow: 1, medium: 2, deep: 3 }[depth] || 2;

    steps.push({
      step: 1,
      type: 'decompose',
      action: 'Breaking down the problem into components',
      result: this.decomposeProblem(problem)
    });

    steps.push({
      step: 2,
      type: 'identify',
      action: 'Identifying key requirements and constraints',
      result: this.identifyRequirements(problem, context)
    });

    steps.push({
      step: 3,
      type: 'explore',
      action: 'Exploring possible approaches',
      result: this.exploreApproaches(problem, depthMultiplier)
    });

    steps.push({
      step: 4,
      type: 'evaluate',
      action: 'Evaluating each approach',
      result: this.evaluateApproaches(steps[2].result)
    });

    steps.push({
      step: 5,
      type: 'select',
      action: 'Selecting the best approach',
      result: this.selectBestApproach(steps[3].result)
    });

    return steps;
  }

  decomposeProblem(problem) {
    const keywords = problem.toLowerCase().split(/\s+/);
    const components = [];

    if (keywords.some(k => ['create', 'build', 'make', 'write'].includes(k))) {
      components.push({ type: 'creation', priority: 'high' });
    }
    if (keywords.some(k => ['fix', 'debug', 'solve', 'repair'].includes(k))) {
      components.push({ type: 'debugging', priority: 'high' });
    }
    if (keywords.some(k => ['analyze', 'understand', 'explain'].includes(k))) {
      components.push({ type: 'analysis', priority: 'medium' });
    }
    if (keywords.some(k => ['optimize', 'improve', 'enhance'].includes(k))) {
      components.push({ type: 'optimization', priority: 'medium' });
    }
    if (keywords.some(k => ['test', 'verify', 'validate'].includes(k))) {
      components.push({ type: 'testing', priority: 'high' });
    }
    if (keywords.some(k => ['deploy', 'ship', 'release'].includes(k))) {
      components.push({ type: 'deployment', priority: 'high' });
    }

    if (components.length === 0) {
      components.push({ type: 'general', priority: 'medium' });
    }

    return { components, totalComponents: components.length };
  }

  identifyRequirements(problem, context) {
    return {
      explicit: this.extractExplicitRequirements(problem),
      implicit: this.extractImplicitRequirements(problem, context),
      constraints: this.identifyConstraints(problem, context)
    };
  }

  extractExplicitRequirements(problem) {
    const requirements = [];
    const sentences = problem.split(/[.!?]+/).filter(s => s.trim());

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 5) {
        requirements.push({
          text: trimmed,
          type: 'requirement'
        });
      }
    }

    return requirements;
  }

  extractImplicitRequirements(problem, context) {
    const implicit = [];

    if (context.length > 0) {
      implicit.push({ text: 'Consider existing context and history', type: 'context' });
    }

    if (problem.includes('file') || problem.includes('code')) {
      implicit.push({ text: 'File system operations may be needed', type: 'technical' });
    }

    if (problem.includes('web') || problem.includes('search')) {
      implicit.push({ text: 'Web access may be required', type: 'technical' });
    }

    return implicit;
  }

  identifyConstraints(problem, context) {
    const constraints = [];
    constraints.push({ type: 'time', value: 'reasonable execution time' });
    constraints.push({ type: 'resources', value: 'available system resources' });

    if (context.some(c => c.type === 'project')) {
      constraints.push({ type: 'scope', value: 'stay within project scope' });
    }

    return constraints;
  }

  exploreApproaches(problem, depth) {
    const approaches = [];

    approaches.push({
      id: 'direct',
      name: 'Direct Approach',
      description: 'Solve the problem directly with minimal overhead',
      pros: ['Fast', 'Simple', 'Low resource usage'],
      cons: ['May not handle edge cases', 'Limited flexibility'],
      estimatedComplexity: 'low'
    });

    approaches.push({
      id: 'modular',
      name: 'Modular Approach',
      description: 'Break into modules and solve each independently',
      pros: ['Maintainable', 'Testable', 'Reusable'],
      cons: ['More initial setup', 'More files to manage'],
      estimatedComplexity: 'medium'
    });

    approaches.push({
      id: 'automated',
      name: 'Automated Approach',
      description: 'Create automated solution that can be reused',
      pros: ['Reusable', 'Consistent', 'Scalable'],
      cons: ['More development time', 'Requires maintenance'],
      estimatedComplexity: 'high'
    });

    if (depth >= 2) {
      approaches.push({
        id: 'iterative',
        name: 'Iterative Approach',
        description: 'Start simple and iterate to improve',
        pros: ['Quick start', 'Continuous improvement', 'Low risk'],
        cons: ['May require refactoring', 'Technical debt possible'],
        estimatedComplexity: 'medium'
      });
    }

    if (depth >= 3) {
      approaches.push({
        id: 'ai-assisted',
        name: 'AI-Assisted Approach',
        description: 'Use AI to generate and optimize solution',
        pros: ['Potentially optimal solution', 'Fast generation', 'Creative solutions'],
        cons: ['May need human review', 'Dependency on AI quality'],
        estimatedComplexity: 'medium'
      });
    }

    return approaches;
  }

  evaluateApproaches(approaches) {
    return approaches.map(approach => {
      let score = 50;
      score += approach.pros.length * 10;
      score -= approach.cons.length * 5;

      const complexityPenalty = { low: 0, medium: 10, high: 20 };
      score -= complexityPenalty[approach.estimatedComplexity] || 0;

      return {
        ...approach,
        score: Math.max(0, Math.min(100, score))
      };
    });
  }

  selectBestApproach(evaluatedApproaches) {
    const sorted = [...evaluatedApproaches].sort((a, b) => b.score - a.score);
    return {
      selected: sorted[0],
      alternatives: sorted.slice(1),
      reasoning: `Selected ${sorted[0].name} because it scored highest (${sorted[0].score}/100) with ${sorted[0].pros.length} advantages`
    };
  }

  synthesizeConclusion(steps) {
    const selected = steps[4]?.result?.selected;
    if (selected) {
      return `Based on analysis, the recommended approach is: ${selected.name}. ${selected.description}. This approach has ${selected.pros.length} advantages and an estimated complexity of ${selected.estimatedComplexity}.`;
    }
    return 'Analysis complete. Recommend proceeding with direct approach.';
  }

  calculateConfidence(steps) {
    let confidence = 60;
    const identifiedCount = steps[1]?.result?.explicit?.length || 0;
    confidence += identifiedCount * 5;
    const approachCount = steps[2]?.result?.length || 0;
    confidence += approachCount * 2;
    return Math.min(95, confidence);
  }

  async createPlan(params) {
    const { agentId, goal, context = [], strategy = 'sequential', maxSteps = 20 } = params;
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    const planId = uuidv4();
    const steps = this.generatePlanSteps(goal, context, strategy, maxSteps);

    const plan = {
      id: planId,
      agentId,
      goal,
      context,
      strategy,
      steps,
      currentStep: 0,
      status: 'created',
      progress: 0,
      type: 'plan',
      createdAt: new Date().toISOString()
    };

    this.plans.set(planId, plan);
    agent.currentTask = planId;
    agent.status = 'planning';
    agent.lastActive = new Date().toISOString();
    this.agents.set(agentId, agent);

    return plan;
  }

  generatePlanSteps(goal, context, strategy, maxSteps) {
    const steps = [];
    const goalLower = goal.toLowerCase();

    steps.push({
      id: uuidv4(),
      order: 1,
      action: 'analyze',
      description: 'Analyze the goal and gather requirements',
      status: 'pending',
      dependencies: [],
      estimatedTime: '30s'
    });

    if (goalLower.includes('create') || goalLower.includes('build') || goalLower.includes('write')) {
      steps.push({
        id: uuidv4(),
        order: 2,
        action: 'design',
        description: 'Design the solution architecture',
        status: 'pending',
        dependencies: [steps[0].id],
        estimatedTime: '1m'
      });

      steps.push({
        id: uuidv4(),
        order: 3,
        action: 'implement',
        description: 'Implement the solution',
        status: 'pending',
        dependencies: [steps[1].id],
        estimatedTime: '5m'
      });

      steps.push({
        id: uuidv4(),
        order: 4,
        action: 'test',
        description: 'Test the implementation',
        status: 'pending',
        dependencies: [steps[2].id],
        estimatedTime: '2m'
      });

      steps.push({
        id: uuidv4(),
        order: 5,
        action: 'verify',
        description: 'Verify results and report',
        status: 'pending',
        dependencies: [steps[3].id],
        estimatedTime: '30s'
      });
    } else if (goalLower.includes('fix') || goalLower.includes('debug')) {
      steps.push({
        id: uuidv4(),
        order: 2,
        action: 'diagnose',
        description: 'Diagnose the issue',
        status: 'pending',
        dependencies: [steps[0].id],
        estimatedTime: '1m'
      });

      steps.push({
        id: uuidv4(),
        order: 3,
        action: 'locate',
        description: 'Locate the root cause',
        status: 'pending',
        dependencies: [steps[1].id],
        estimatedTime: '2m'
      });

      steps.push({
        id: uuidv4(),
        order: 4,
        action: 'fix',
        description: 'Apply the fix',
        status: 'pending',
        dependencies: [steps[2].id],
        estimatedTime: '1m'
      });

      steps.push({
        id: uuidv4(),
        order: 5,
        action: 'verify',
        description: 'Verify the fix works',
        status: 'pending',
        dependencies: [steps[3].id],
        estimatedTime: '1m'
      });
    } else if (goalLower.includes('search') || goalLower.includes('find')) {
      steps.push({
        id: uuidv4(),
        order: 2,
        action: 'search',
        description: 'Search for relevant information',
        status: 'pending',
        dependencies: [steps[0].id],
        estimatedTime: '1m'
      });

      steps.push({
        id: uuidv4(),
        order: 3,
        action: 'filter',
        description: 'Filter and rank results',
        status: 'pending',
        dependencies: [steps[1].id],
        estimatedTime: '30s'
      });

      steps.push({
        id: uuidv4(),
        order: 4,
        action: 'present',
        description: 'Present findings',
        status: 'pending',
        dependencies: [steps[2].id],
        estimatedTime: '30s'
      });
    } else {
      steps.push({
        id: uuidv4(),
        order: 2,
        action: 'plan',
        description: 'Create detailed execution plan',
        status: 'pending',
        dependencies: [steps[0].id],
        estimatedTime: '1m'
      });

      steps.push({
        id: uuidv4(),
        order: 3,
        action: 'execute',
        description: 'Execute the plan',
        status: 'pending',
        dependencies: [steps[1].id],
        estimatedTime: '5m'
      });

      steps.push({
        id: uuidv4(),
        order: 4,
        action: 'report',
        description: 'Report results',
        status: 'pending',
        dependencies: [steps[2].id],
        estimatedTime: '30s'
      });
    }

    return steps;
  }

  async executePlan(planId) {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan not found: ${planId}`);

    plan.status = 'executing';
    const agent = this.agents.get(plan.agentId);
    if (agent) {
      agent.status = 'executing';
      agent.lastActive = new Date().toISOString();
      this.agents.set(plan.agentId, agent);
    }

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

  async addMemory(params) {
    const { agentId, type = 'interaction', content, importance = 'medium', tags = [] } = params;

    const id = uuidv4();
    const memory = {
      id,
      agentId,
      type,
      content,
      importance,
      tags,
      accessCount: 0,
      lastAccessed: null,
      type: 'memory',
      createdAt: new Date().toISOString()
    };

    this.memories.set(id, memory);
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.memory.push(id);
      this.agents.set(agentId, agent);
    }

    return memory;
  }

  async recallMemory(query, agentId = null) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, memory] of this.memories) {
      if (agentId && memory.agentId !== agentId) continue;

      let score = 0;
      const contentLower = memory.content.toLowerCase();

      if (contentLower.includes(queryLower)) score += 10;
      if (memory.tags.some(t => t.toLowerCase().includes(queryLower))) score += 5;

      if (memory.importance === 'high') score *= 1.5;
      else if (memory.importance === 'low') score *= 0.5;

      if (score > 0) {
        memory.accessCount++;
        memory.lastAccessed = new Date().toISOString();
        results.push({ ...memory, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getAgentStats() {
    const agents = Array.from(this.agents.values());
    const plans = Array.from(this.plans.values());
    const memories = Array.from(this.memories.values());

    return {
      agents: agents.length,
      activeAgents: agents.filter(a => a.status !== 'idle').length,
      plans: plans.length,
      activePlans: plans.filter(p => p.status === 'executing').length,
      completedPlans: plans.filter(p => p.status === 'completed').length,
      memories: memories.length,
      thoughts: this.thoughts.size,
      capabilities: this.capabilities.length,
      strategies: this.strategies.length
    };
  }

  async saveAgent(agent) {
    const filePath = path.join(this.agentDir, `${agent.id}.json`);
    await fs.writeJson(filePath, agent, { spaces: 2 });
  }

  getCapabilities() {
    return this.capabilities;
  }

  getStrategies() {
    return this.strategies;
  }

  getPersonality() {
    return this.personality;
  }

  async exportAgent(format = 'json') {
    const data = {
      agents: Array.from(this.agents.values()),
      plans: Array.from(this.plans.values()),
      memories: Array.from(this.memories.values()),
      thoughts: Array.from(this.thoughts.values()),
      capabilities: this.capabilities,
      strategies: this.strategies
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = AIAgentCore;
