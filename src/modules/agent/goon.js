const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class GoOnEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.goals = new Map();
    this.milestones = new Map();
    this.thoughtLogs = new Map();
    this.goOnDir = path.join(os.homedir(), '.pix/goon');
  }

  async initialize() {
    this.logger.info('Initializing Go On Engine...');
    await fs.ensureDir(this.goOnDir);
    await this.loadData();
    this.loadGoalTypes();
    this.loadStrategies();
    this.logger.info('Go On Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.goOnDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.goOnDir, file));
          if (data.type === 'session') this.sessions.set(data.id, data);
          else if (data.type === 'goal') this.goals.set(data.id, data);
          else if (data.type === 'milestone') this.milestones.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadGoalTypes() {
    this.goalTypes = [
      { id: 'implement', name: 'Implement Feature', icon: '🔧', description: 'Build a new feature or component', autoDecompose: true },
      { id: 'fix', name: 'Fix Bug', icon: '🐛', description: 'Identify and fix a bug', autoDecompose: true },
      { id: 'refactor', name: 'Refactor Code', icon: '♻️', description: 'Improve code structure', autoDecompose: true },
      { id: 'optimize', name: 'Optimize', icon: '⚡', description: 'Improve performance', autoDecompose: true },
      { id: 'test', name: 'Write Tests', icon: '🧪', description: 'Create test coverage', autoDecompose: true },
      { id: 'document', name: 'Document', icon: '📝', description: 'Write documentation', autoDecompose: false },
      { id: 'research', name: 'Research', icon: '🔬', description: 'Research and gather information', autoDecompose: true },
      { id: 'learn', name: 'Learn', icon: '📚', description: 'Learn about a topic', autoDecompose: true },
      { id: 'build', name: 'Build Project', icon: '🏗️', description: 'Create a new project', autoDecompose: true },
      { id: 'deploy', name: 'Deploy', icon: '🚀', description: 'Deploy to production', autoDecompose: true },
      { id: 'review', name: 'Code Review', icon: '👁️', description: 'Review code quality', autoDecompose: false },
      { id: 'analyze', name: 'Analyze', icon: '📊', description: 'Analyze data or code', autoDecompose: true }
    ];
  }

  loadStrategies() {
    this.strategies = [
      { id: 'sequential', name: 'Sequential', description: 'Complete goals one at a time', icon: '➡️' },
      { id: 'parallel', name: 'Parallel', description: 'Work on multiple goals simultaneously', icon: '↔️' },
      { id: 'priority', name: 'Priority First', description: 'Always pick highest priority goal', icon: '⬆️' },
      { id: 'quickest', name: 'Quickest Win', description: 'Complete easiest goals first', icon: '🏃' },
      { id: 'deepest', name: 'Deepest First', description: 'Tackle hardest goals first', icon: '🏊' }
    ];
  }

  async startSession(params) {
    const {
      name,
      task,
      duration,
      durationUnit = 'minutes',
      strategy = 'priority',
      maxGoals = 10,
      context = {},
      aiModel = null,
      shareThoughts = true,
      autoDecompose = true
    } = params;

    const id = uuidv4();
    const durationMs = this.parseDuration(duration, durationUnit);

    const session = {
      id,
      name: name || `Go On ${id.slice(0, 8)}`,
      task,
      duration: durationMs,
      durationUnit,
      originalDuration: duration,
      strategy,
      maxGoals,
      context,
      aiModel,
      shareThoughts,
      autoDecompose,
      status: 'running',
      startedAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + durationMs).toISOString(),
      goals: [],
      completedGoals: [],
      failedGoals: [],
      currentGoal: null,
      thoughtLog: [],
      progress: 0,
      metrics: {
        totalGoals: 0,
        completedGoals: 0,
        failedGoals: 0,
        timeSpent: 0,
        timeRemaining: durationMs,
        linesChanged: 0,
        filesModified: 0,
        decisionsMade: 0
      },
      type: 'session'
    };

    this.sessions.set(id, session);
    await this.saveSession(session);

    return session;
  }

  parseDuration(value, unit) {
    const multipliers = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000
    };
    return value * (multipliers[unit] || multipliers.minutes);
  }

  async pauseSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    session.status = 'paused';
    session.pausedAt = new Date().toISOString();
    this.sessions.set(id, session);
    await this.saveSession(session);
    return session;
  }

  async resumeSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    if (session.pausedAt) {
      const pausedDuration = new Date() - new Date(session.pausedAt);
      session.endsAt = new Date(new Date(session.endsAt).getTime() + pausedDuration).toISOString();
    }

    session.status = 'running';
    session.pausedAt = null;
    this.sessions.set(id, session);
    await this.saveSession(session);
    return session;
  }

  async stopSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    session.status = 'stopped';
    session.stoppedAt = new Date().toISOString();
    session.metrics.timeSpent = new Date(session.stoppedAt) - new Date(session.startedAt);
    this.sessions.set(id, session);
    await this.saveSession(session);
    return session;
  }

  async createGoal(params) {
    const {
      sessionId,
      title,
      description = '',
      type = 'implement',
      priority = 'medium',
      estimatedTime = null,
      parentGoalId = null,
      dependencies = [],
      files = [],
      autoGenerated = false
    } = params;

    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const id = uuidv4();
    const goal = {
      id,
      sessionId,
      title,
      description,
      type,
      priority,
      estimatedTime,
      parentGoalId,
      dependencies,
      files,
      autoGenerated,
      status: 'pending',
      progress: 0,
      subGoals: [],
      results: [],
      thoughts: [],
      startedAt: null,
      completedAt: null,
      type: 'goal',
      createdAt: new Date().toISOString()
    };

    this.goals.set(id, goal);
    session.goals.push(id);
    session.metrics.totalGoals++;

    if (session.shareThoughts) {
      session.thoughtLog.push({
        timestamp: new Date().toISOString(),
        thought: `New goal created: "${title}". I'll work on this ${priority} priority task.`
      });
    }

    this.sessions.set(sessionId, session);
    await this.saveGoal(goal);
    await this.saveSession(session);

    return goal;
  }

  async decomposeGoal(goalId) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal not found: ${goalId}`);

    const subGoals = this.generateSubGoals(goal);

    for (const subGoal of subGoals) {
      const subGoalId = uuidv4();
      const newSubGoal = {
        id: subGoalId,
        sessionId: goal.sessionId,
        parentGoalId: goalId,
        title: subGoal.title,
        description: subGoal.description,
        type: goal.type,
        priority: subGoal.priority || goal.priority,
        estimatedTime: subGoal.estimatedTime,
        dependencies: subGoal.dependencies || [],
        files: goal.files,
        autoGenerated: true,
        status: 'pending',
        progress: 0,
        subGoals: [],
        results: [],
        thoughts: [],
        type: 'goal',
        createdAt: new Date().toISOString()
      };

      this.goals.set(subGoalId, newSubGoal);
      goal.subGoals.push(subGoalId);
    }

    this.goals.set(goalId, goal);
    await this.saveGoal(goal);

    return goal;
  }

  generateSubGoals(goal) {
    const templates = {
      implement: [
        { title: 'Analyze requirements', description: 'Understand what needs to be built', priority: 'high', estimatedTime: 5 },
        { title: 'Design solution', description: 'Create a design for the implementation', priority: 'high', estimatedTime: 10 },
        { title: 'Write core logic', description: 'Implement the main functionality', priority: 'high', estimatedTime: 20 },
        { title: 'Write tests', description: 'Create tests for the new code', priority: 'medium', estimatedTime: 10 },
        { title: 'Refactor and clean up', description: 'Clean up code and optimize', priority: 'low', estimatedTime: 5 }
      ],
      fix: [
        { title: 'Reproduce the bug', description: 'Find steps to reproduce the issue', priority: 'high', estimatedTime: 5 },
        { title: 'Identify root cause', description: 'Find the source of the problem', priority: 'high', estimatedTime: 10 },
        { title: 'Implement fix', description: 'Apply the fix', priority: 'high', estimatedTime: 10 },
        { title: 'Verify fix', description: 'Test that the fix works', priority: 'high', estimatedTime: 5 },
        { title: 'Add regression test', description: 'Prevent the bug from recurring', priority: 'medium', estimatedTime: 5 }
      ],
      refactor: [
        { title: 'Analyze current code', description: 'Understand the existing implementation', priority: 'high', estimatedTime: 5 },
        { title: 'Plan refactoring', description: 'Design the improved structure', priority: 'high', estimatedTime: 10 },
        { title: 'Apply changes', description: 'Refactor the code', priority: 'high', estimatedTime: 15 },
        { title: 'Run tests', description: 'Ensure nothing is broken', priority: 'high', estimatedTime: 5 },
        { title: 'Optimize', description: 'Performance improvements', priority: 'low', estimatedTime: 5 }
      ],
      optimize: [
        { title: 'Profile performance', description: 'Identify bottlenecks', priority: 'high', estimatedTime: 10 },
        { title: 'Plan optimizations', description: 'Design optimization strategy', priority: 'high', estimatedTime: 5 },
        { title: 'Implement optimizations', description: 'Apply performance improvements', priority: 'high', estimatedTime: 15 },
        { title: 'Benchmark', description: 'Measure improvement', priority: 'medium', estimatedTime: 5 }
      ],
      test: [
        { title: 'Identify test cases', description: 'Determine what needs testing', priority: 'high', estimatedTime: 5 },
        { title: 'Write unit tests', description: 'Create unit test files', priority: 'high', estimatedTime: 15 },
        { title: 'Write integration tests', description: 'Test component interactions', priority: 'medium', estimatedTime: 10 },
        { title: 'Run test suite', description: 'Execute all tests', priority: 'high', estimatedTime: 5 }
      ],
      research: [
        { title: 'Define research scope', description: 'Clarify what needs to be learned', priority: 'high', estimatedTime: 5 },
        { title: 'Gather information', description: 'Search and collect data', priority: 'high', estimatedTime: 15 },
        { title: 'Analyze findings', description: 'Process and understand information', priority: 'medium', estimatedTime: 10 },
        { title: 'Synthesize results', description: 'Create summary and recommendations', priority: 'medium', estimatedTime: 5 }
      ]
    };

    return templates[goal.type] || templates.implement;
  }

  async selectNextGoal(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const pendingGoals = session.goals
      .map(id => this.goals.get(id))
      .filter(g => g && g.status === 'pending');

    if (pendingGoals.length === 0) return null;

    let selected;

    switch (session.strategy) {
      case 'priority':
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        selected = pendingGoals.sort((a, b) =>
          (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
        )[0];
        break;

      case 'quickest':
        selected = pendingGoals.sort((a, b) =>
          (a.estimatedTime || 10) - (b.estimatedTime || 10)
        )[0];
        break;

      case 'deepest':
        selected = pendingGoals.sort((a, b) =>
          (b.estimatedTime || 10) - (a.estimatedTime || 10)
        )[0];
        break;

      case 'sequential':
      default:
        selected = pendingGoals[0];
    }

    return selected;
  }

  async startGoal(goalId) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal not found: ${goalId}`);

    goal.status = 'in-progress';
    goal.startedAt = new Date().toISOString();

    this.goals.set(goalId, goal);

    const session = this.sessions.get(goal.sessionId);
    if (session) {
      session.currentGoal = goalId;
      if (session.shareThoughts) {
        session.thoughtLog.push({
          timestamp: new Date().toISOString(),
          thought: `Starting work on: "${goal.title}". ${goal.description}`
        });
      }
      this.sessions.set(goal.sessionId, session);
      await this.saveSession(session);
    }

    await this.saveGoal(goal);
    return goal;
  }

  async updateGoalProgress(goalId, progress, results = null) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal not found: ${goalId}`);

    goal.progress = Math.min(100, progress);
    if (results) goal.results.push(results);

    if (goal.progress >= 100) {
      goal.status = 'completed';
      goal.completedAt = new Date().toISOString();

      const session = this.sessions.get(goal.sessionId);
      if (session) {
        session.completedGoals.push(goalId);
        session.metrics.completedGoals++;
        if (session.shareThoughts) {
          session.thoughtLog.push({
            timestamp: new Date().toISOString(),
            thought: `Completed: "${goal.title}". Moving on to the next task.`
          });
        }
        this.sessions.set(goal.sessionId, session);
        await this.saveSession(session);
      }
    }

    this.goals.set(goalId, goal);
    await this.saveGoal(goal);
    return goal;
  }

  async addThought(sessionId, thought) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const thoughtEntry = {
      timestamp: new Date().toISOString(),
      thought,
      goalId: session.currentGoal
    };

    session.thoughtLog.push(thoughtEntry);
    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    return thoughtEntry;
  }

  async getSessionStatus(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    const now = new Date();
    const endsAt = new Date(session.endsAt);
    const timeRemaining = Math.max(0, endsAt - now);
    const totalDuration = new Date(session.endsAt) - new Date(session.startedAt);
    const timeSpent = now - new Date(session.startedAt);
    const elapsed = timeSpent / totalDuration;

    session.metrics.timeRemaining = timeRemaining;
    session.metrics.timeSpent = timeSpent;
    session.progress = Math.round(elapsed * 100);

    this.sessions.set(id, session);

    const pendingGoals = session.goals.filter(gId => {
      const g = this.goals.get(gId);
      return g && g.status === 'pending';
    }).length;

    return {
      sessionId: id,
      status: session.status,
      progress: session.progress,
      timeRemaining,
      timeRemainingFormatted: this.formatDuration(timeRemaining),
      timeSpent,
      timeSpentFormatted: this.formatDuration(timeSpent),
      totalGoals: session.metrics.totalGoals,
      completedGoals: session.metrics.completedGoals,
      pendingGoals,
      currentGoal: session.currentGoal ? this.goals.get(session.currentGoal) : null,
      recentThoughts: session.thoughtLog.slice(-5)
    };
  }

  formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  async getSession(id) {
    return this.sessions.get(id);
  }

  listSessions(options = {}) {
    const { status } = options;
    let sessions = Array.from(this.sessions.values());
    if (status) sessions = sessions.filter(s => s.status === status);
    return sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  async getGoal(id) {
    return this.goals.get(id);
  }

  listGoals(sessionId) {
    return Array.from(this.goals.values())
      .filter(g => g.sessionId === sessionId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  getGoalTypes() {
    return this.goalTypes;
  }

  getStrategies() {
    return this.strategies;
  }

  async getStats() {
    const sessions = Array.from(this.sessions.values());
    const goals = Array.from(this.goals.values());

    return {
      sessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'running').length,
      goals: goals.length,
      completedGoals: goals.filter(g => g.status === 'completed').length,
      inProgressGoals: goals.filter(g => g.status === 'in-progress').length,
      totalThoughts: sessions.reduce((sum, s) => sum + s.thoughtLog.length, 0)
    };
  }

  async saveSession(session) {
    const filePath = path.join(this.goOnDir, `session-${session.id}.json`);
    await fs.writeJson(filePath, session, { spaces: 2 });
  }

  async saveGoal(goal) {
    const filePath = path.join(this.goOnDir, `goal-${goal.id}.json`);
    await fs.writeJson(filePath, goal, { spaces: 2 });
  }
}

module.exports = GoOnEngine;
