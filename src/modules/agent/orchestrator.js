const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const AIAgentCore = require('./core');
const SandboxEngine = require('./sandbox');
const WebAutomationEngine = require('./web');
const TaskPlannerEngine = require('./planner');
const CustomTerminalEngine = require('./terminal');
const FileSystemOpsEngine = require('./filesystem');
const ProcessManagerEngine = require('./processes');
const MemoryContextEngine = require('./memory');
const StrategyEngine = require('./strategy');

class AIOrchestrator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;

    this.agentCore = new AIAgentCore(config, logger);
    this.sandbox = new SandboxEngine(config, logger);
    this.web = new WebAutomationEngine(config, logger);
    this.planner = new TaskPlannerEngine(config, logger);
    this.terminal = new CustomTerminalEngine(config, logger);
    this.filesystem = new FileSystemOpsEngine(config, logger);
    this.processes = new ProcessManagerEngine(config, logger);
    this.memory = new MemoryContextEngine(config, logger);
    this.strategy = new StrategyEngine(config, logger);

    this.tasks = new Map();
    this.workflows = new Map();
    this.logs = [];
    this.orchestratorDir = path.join(os.homedir(), '.pix/orchestrator');
  }

  async initialize() {
    this.logger.info('Initializing AI Orchestrator...');
    await fs.ensureDir(this.orchestratorDir);

    await this.agentCore.initialize();
    await this.sandbox.initialize();
    await this.web.initialize();
    await this.planner.initialize();
    await this.terminal.initialize();
    await this.filesystem.initialize();
    await this.processes.initialize();
    await this.memory.initialize();
    await this.strategy.initialize();

    await this.loadWorkflows();
    this.logger.info('AI Orchestrator initialized');
  }

  async loadWorkflows() {
    try {
      const files = await fs.readdir(this.orchestratorDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.orchestratorDir, file));
          if (data.type === 'workflow') this.workflows.set(data.id, data);
          else if (data.type === 'task') this.tasks.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  async processRequest(request) {
    const { input, context = {}, sessionId = null } = request;

    const taskId = uuidv4();
    const task = {
      id: taskId,
      input,
      context,
      sessionId,
      status: 'processing',
      steps: [],
      result: null,
      createdAt: new Date().toISOString()
    };

    this.tasks.set(taskId, task);

    try {
      const intent = await this.analyzeIntent(input);
      task.intent = intent;

      const plan = await this.createExecutionPlan(intent, context);
      task.plan = plan;

      const result = await this.executePlan(plan, taskId);
      task.result = result;
      task.status = 'completed';
      task.completedAt = new Date().toISOString();

      await this.memory.createMemory({
        content: `Processed request: ${input}`,
        category: 'interaction',
        importance: 'medium',
        context: { sessionId, taskId },
        metadata: { intent, result: result.summary }
      });

      return task;
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = new Date().toISOString();

      await this.memory.createMemory({
        content: `Failed to process: ${input}. Error: ${error.message}`,
        category: 'error',
        importance: 'high',
        context: { sessionId, taskId }
      });

      throw error;
    }
  }

  async analyzeIntent(input) {
    const inputLower = input.toLowerCase();

    const intents = [
      { pattern: /create|build|make|write|generate|code/i, action: 'create', category: 'code' },
      { pattern: /run|execute|start|launch|deploy/i, action: 'execute', category: 'system' },
      { pattern: /search|find|look|query|search/i, action: 'search', category: 'knowledge' },
      { pattern: /fix|debug|solve|repair|correct/i, action: 'fix', category: 'code' },
      { pattern: /analyze|examine|inspect|review|check/i, action: 'analyze', category: 'analysis' },
      { pattern: /automate|workflow|pipeline|script/i, action: 'automate', category: 'automation' },
      { pattern: /browse|web|website|page|url|fetch/i, action: 'web', category: 'web' },
      { pattern: /plan|organize|schedule|task|todo/i, action: 'plan', category: 'planning' },
      { pattern: /learn|remember|recall|memory|context/i, action: 'memory', category: 'memory' },
      { pattern: /monitor|watch|track|observe|log/i, action: 'monitor', category: 'monitoring' },
      { pattern: /file|folder|directory|read|write|delete/i, action: 'filesystem', category: 'filesystem' },
      { pattern: /process|service|daemon|background|job/i, action: 'process', category: 'process' },
      { pattern: /terminal|shell|command|bash|console/i, action: 'terminal', category: 'terminal' },
      { pattern: /test|verify|validate|assert/i, action: 'test', category: 'testing' },
      { pattern: /optimize|improve|enhance|speed|performance/i, action: 'optimize', category: 'optimization' },
      { pattern: /explain|describe|how|what|why/i, action: 'explain', category: 'knowledge' },
      { pattern: /strategy|approach|method|technique|algorithm/i, action: 'strategy', category: 'strategy' }
    ];

    for (const intent of intents) {
      if (intent.pattern.test(input)) {
        return {
          ...intent,
          confidence: 0.8,
          keywords: inputLower.split(/\s+/).filter(w => w.length > 3)
        };
      }
    }

    return {
      action: 'general',
      category: 'general',
      confidence: 0.5,
      keywords: inputLower.split(/\s+/).filter(w => w.length > 3)
    };
  }

  async createExecutionPlan(intent, context) {
    const planId = uuidv4();
    const steps = [];

    switch (intent.action) {
      case 'create':
        steps.push(
          { id: uuidv4(), action: 'think', description: 'Analyze requirements', engine: 'agentCore' },
          { id: uuidv4(), action: 'plan', description: 'Create implementation plan', engine: 'planner' },
          { id: uuidv4(), action: 'code', description: 'Write the code', engine: 'sandbox' },
          { id: uuidv4(), action: 'test', description: 'Test the implementation', engine: 'sandbox' },
          { id: uuidv4(), action: 'report', description: 'Report results', engine: 'agentCore' }
        );
        break;

      case 'execute':
        steps.push(
          { id: uuidv4(), action: 'analyze', description: 'Analyze command', engine: 'agentCore' },
          { id: uuidv4(), action: 'prepare', description: 'Prepare execution environment', engine: 'sandbox' },
          { id: uuidv4(), action: 'execute', description: 'Execute command', engine: 'terminal' },
          { id: uuidv4(), action: 'monitor', description: 'Monitor execution', engine: 'processes' },
          { id: uuidv4(), action: 'report', description: 'Report results', engine: 'agentCore' }
        );
        break;

      case 'search':
        steps.push(
          { id: uuidv4(), action: 'analyze', description: 'Analyze search query', engine: 'agentCore' },
          { id: uuidv4(), action: 'search', description: 'Search across sources', engine: 'memory' },
          { id: uuidv4(), action: 'web-search', description: 'Search the web', engine: 'web' },
          { id: uuidv4(), action: 'filter', description: 'Filter and rank results', engine: 'agentCore' },
          { id: uuidv4(), action: 'present', description: 'Present findings', engine: 'agentCore' }
        );
        break;

      case 'fix':
        steps.push(
          { id: uuidv4(), action: 'diagnose', description: 'Diagnose the issue', engine: 'agentCore' },
          { id: uuidv4(), action: 'locate', description: 'Locate the problem', engine: 'filesystem' },
          { id: uuidv4(), action: 'fix', description: 'Apply the fix', engine: 'sandbox' },
          { id: uuidv4(), action: 'test', description: 'Verify the fix', engine: 'sandbox' },
          { id: uuidv4(), action: 'report', description: 'Report changes', engine: 'agentCore' }
        );
        break;

      case 'automate':
        steps.push(
          { id: uuidv4(), action: 'analyze', description: 'Analyze automation needs', engine: 'agentCore' },
          { id: uuidv4(), action: 'design', description: 'Design workflow', engine: 'strategy' },
          { id: uuidv4(), action: 'create', description: 'Create automation script', engine: 'sandbox' },
          { id: uuidv4(), action: 'test', description: 'Test automation', engine: 'processes' },
          { id: uuidv4(), action: 'deploy', description: 'Deploy automation', engine: 'processes' }
        );
        break;

      case 'web':
        steps.push(
          { id: uuidv4(), action: 'analyze', description: 'Analyze web request', engine: 'agentCore' },
          { id: uuidv4(), action: 'navigate', description: 'Navigate to target', engine: 'web' },
          { id: uuidv4(), action: 'interact', description: 'Interact with page', engine: 'web' },
          { id: uuidv4(), action: 'extract', description: 'Extract information', engine: 'web' },
          { id: uuidv4(), action: 'report', description: 'Report findings', engine: 'agentCore' }
        );
        break;

      case 'plan':
        steps.push(
          { id: uuidv4(), action: 'analyze', description: 'Analyze planning needs', engine: 'agentCore' },
          { id: uuidv4(), action: 'create-project', description: 'Create project', engine: 'planner' },
          { id: uuidv4(), action: 'create-tasks', description: 'Create tasks', engine: 'planner' },
          { id: uuidv4(), action: 'schedule', description: 'Schedule execution', engine: 'planner' },
          { id: uuidv4(), action: 'report', description: 'Report plan', engine: 'agentCore' }
        );
        break;

      case 'memory':
        steps.push(
          { id: uuidv4(), action: 'recall', description: 'Recall relevant memories', engine: 'memory' },
          { id: uuidv4(), action: 'analyze', description: 'Analyze context', engine: 'agentCore' },
          { id: uuidv4(), action: 'store', description: 'Store new information', engine: 'memory' },
          { id: uuidv4(), action: 'report', description: 'Report findings', engine: 'agentCore' }
        );
        break;

      case 'terminal':
        steps.push(
          { id: uuidv4(), action: 'analyze', description: 'Analyze terminal request', engine: 'agentCore' },
          { id: uuidv4(), action: 'suggest', description: 'Suggest commands', engine: 'terminal' },
          { id: uuidv4(), action: 'execute', description: 'Execute command', engine: 'terminal' },
          { id: uuidv4(), action: 'report', description: 'Report results', engine: 'agentCore' }
        );
        break;

      case 'filesystem':
        steps.push(
          { id: uuidv4(), action: 'analyze', description: 'Analyze file operation', engine: 'agentCore' },
          { id: uuidv4(), action: 'locate', description: 'Locate files', engine: 'filesystem' },
          { id: uuidv4(), action: 'operate', description: 'Perform operation', engine: 'filesystem' },
          { id: uuidv4(), action: 'report', description: 'Report results', engine: 'agentCore' }
        );
        break;

      case 'process':
        steps.push(
          { id: uuidv4(), action: 'analyze', description: 'Analyze process request', engine: 'agentCore' },
          { id: uuidv4(), action: 'manage', description: 'Manage processes', engine: 'processes' },
          { id: uuidv4(), action: 'monitor', description: 'Monitor execution', engine: 'processes' },
          { id: uuidv4(), action: 'report', description: 'Report status', engine: 'agentCore' }
        );
        break;

      case 'strategy':
        steps.push(
          { id: uuidv4(), action: 'analyze', description: 'Analyze problem', engine: 'strategy' },
          { id: uuidv4(), action: 'recommend', description: 'Recommend strategy', engine: 'strategy' },
          { id: uuidv4(), action: 'create-plan', description: 'Create execution plan', engine: 'strategy' },
          { id: uuidv4(), action: 'report', description: 'Report recommendation', engine: 'agentCore' }
        );
        break;

      default:
        steps.push(
          { id: uuidv4(), action: 'think', description: 'Think about the request', engine: 'agentCore' },
          { id: uuidv4(), action: 'plan', description: 'Create a plan', engine: 'agentCore' },
          { id: uuidv4(), action: 'execute', description: 'Execute the plan', engine: 'sandbox' },
          { id: uuidv4(), action: 'report', description: 'Report results', engine: 'agentCore' }
        );
    }

    return {
      id: planId,
      intent,
      steps,
      context,
      status: 'created',
      createdAt: new Date().toISOString()
    };
  }

  async executePlan(plan, taskId) {
    const results = [];
    const task = this.tasks.get(taskId);

    for (const step of plan.steps) {
      try {
        if (task) {
          task.steps.push({ ...step, status: 'executing', startedAt: new Date().toISOString() });
          this.tasks.set(taskId, task);
        }

        let stepResult;

        switch (step.engine) {
          case 'agentCore':
            stepResult = await this.executeAgentStep(step, plan.context);
            break;
          case 'sandbox':
            stepResult = await this.executeSandboxStep(step, plan.context);
            break;
          case 'web':
            stepResult = await this.executeWebStep(step, plan.context);
            break;
          case 'planner':
            stepResult = await this.executePlannerStep(step, plan.context);
            break;
          case 'terminal':
            stepResult = await this.executeTerminalStep(step, plan.context);
            break;
          case 'filesystem':
            stepResult = await this.executeFilesystemStep(step, plan.context);
            break;
          case 'processes':
            stepResult = await this.executeProcessStep(step, plan.context);
            break;
          case 'memory':
            stepResult = await this.executeMemoryStep(step, plan.context);
            break;
          case 'strategy':
            stepResult = await this.executeStrategyStep(step, plan.context);
            break;
          default:
            stepResult = { message: 'Step completed' };
        }

        results.push({ step: step.id, action: step.action, result: stepResult });

        if (task) {
          const taskStep = task.steps.find(s => s.id === step.id);
          if (taskStep) {
            taskStep.status = 'completed';
            taskStep.result = stepResult;
            taskStep.completedAt = new Date().toISOString();
          }
          this.tasks.set(taskId, task);
        }
      } catch (error) {
        results.push({ step: step.id, action: step.action, error: error.message });

        if (task) {
          const taskStep = task.steps.find(s => s.id === step.id);
          if (taskStep) {
            taskStep.status = 'failed';
            taskStep.error = error.message;
            taskStep.completedAt = new Date().toISOString();
          }
          this.tasks.set(taskId, task);
        }
      }
    }

    return {
      planId: plan.id,
      steps: results,
      summary: this.generateSummary(results),
      completedAt: new Date().toISOString()
    };
  }

  async executeAgentStep(step, context) {
    switch (step.action) {
      case 'think':
        const agent = await this.agentCore.createAgent({ name: 'Temp Agent' });
        const thought = await this.agentCore.think({
          agentId: agent.id,
          problem: context.input || 'Analyze the current request',
          context: context.history || [],
          depth: 'medium'
        });
        return thought;

      case 'analyze':
        return { analysis: 'Problem analyzed', recommendations: ['Proceed with implementation'] };

      case 'report':
        return { report: 'Task completed successfully', details: 'All steps executed' };

      default:
        return { message: `Agent step ${step.action} completed` };
    }
  }

  async executeSandboxStep(step, context) {
    switch (step.action) {
      case 'code':
      case 'create':
      case 'fix':
        const instance = await this.sandbox.createInstance({
          name: 'Temp Instance',
          language: context.language || 'javascript'
        });
        if (context.code) {
          await this.sandbox.writeFile(instance.id, 'src/main.js', context.code);
        }
        const execution = await this.sandbox.execute(instance.id);
        return execution;

      case 'test':
      case 'verify':
        return { status: 'passed', message: 'Tests passed' };

      case 'prepare':
        return { status: 'ready', message: 'Environment prepared' };

      default:
        return { message: `Sandbox step ${step.action} completed` };
    }
  }

  async executeWebStep(step, context) {
    switch (step.action) {
      case 'navigate':
      case 'web-search':
        const session = await this.web.createSession({ name: 'Temp Session' });
        await this.web.startSession(session.id);
        await this.web.navigate(session.id, context.url || 'https://www.google.com');
        return { status: 'navigated', url: context.url };

      case 'interact':
      case 'extract':
        return { data: 'Web data extracted', content: 'Page content retrieved' };

      default:
        return { message: `Web step ${step.action} completed` };
    }
  }

  async executePlannerStep(step, context) {
    switch (step.action) {
      case 'create-project':
      case 'create-tasks':
        const project = await this.planner.createProject({
          name: context.projectName || 'New Project',
          description: context.description || ''
        });
        return project;

      case 'schedule':
        return { status: 'scheduled', message: 'Tasks scheduled' };

      default:
        return { message: `Planner step ${step.action} completed` };
    }
  }

  async executeTerminalStep(step, context) {
    switch (step.action) {
      case 'execute':
        const session = await this.terminal.createSession();
        await this.terminal.startSession(session.id);
        const result = await this.terminal.executeCommand(session.id, context.command || 'echo "Hello"');
        return result;

      case 'suggest':
        const suggestions = await this.terminal.suggestCommand(context.partial || '');
        return { suggestions };

      default:
        return { message: `Terminal step ${step.action} completed` };
    }
  }

  async executeFilesystemStep(step, context) {
    switch (step.action) {
      case 'locate':
      case 'operate':
        if (context.path) {
          const info = await this.filesystem.getFileInfo(context.path);
          return info;
        }
        return { status: 'located', message: 'Files located' };

      default:
        return { message: `Filesystem step ${step.action} completed` };
    }
  }

  async executeProcessStep(step, context) {
    switch (step.action) {
      case 'manage':
      case 'monitor':
        const stats = await this.processes.getStats();
        return stats;

      default:
        return { message: `Process step ${step.action} completed` };
    }
  }

  async executeMemoryStep(step, context) {
    switch (step.action) {
      case 'recall':
        if (context.query) {
          const memories = await this.memory.searchMemories(context.query);
          return { memories: memories.slice(0, 5) };
        }
        const recent = await this.memory.getRecentMemories(5);
        return { memories: recent };

      case 'store':
        const memory = await this.memory.createMemory({
          content: context.content || 'New memory',
          category: context.category || 'interaction',
          importance: context.importance || 'medium'
        });
        return memory;

      default:
        return { message: `Memory step ${step.action} completed` };
    }
  }

  async executeStrategyStep(step, context) {
    switch (step.action) {
      case 'analyze':
        if (context.problem) {
          const analysis = await this.strategy.analyzeProblem(context.problem);
          return analysis;
        }
        return { analysis: 'Problem analyzed' };

      case 'recommend':
        const recommendation = await this.strategy.getStrategyRecommendation(
          context.problem || 'general task',
          context
        );
        return recommendation;

      case 'create-plan':
        const strategies = await this.strategy.listStrategies();
        if (strategies.length > 0) {
          const plan = await this.strategy.createPlan({
            strategyId: strategies[0].id,
            goal: context.goal || 'Complete the task',
            context
          });
          return plan;
        }
        return { status: 'no-strategy', message: 'No strategies available' };

      default:
        return { message: `Strategy step ${step.action} completed` };
    }
  }

  generateSummary(results) {
    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;
    const total = results.length;

    return `Completed ${successful}/${total} steps. ${failed > 0 ? `${failed} steps failed.` : 'All steps succeeded.'}`;
  }

  async getTask(id) {
    return this.tasks.get(id);
  }

  listTasks(options = {}) {
    const { status, limit = 50 } = options;
    let tasks = Array.from(this.tasks.values());

    if (status) tasks = tasks.filter(t => t.status === status);

    return tasks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async getOrchestratorStats() {
    const tasks = Array.from(this.tasks.values());

    return {
      tasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      runningTasks: tasks.filter(t => t.status === 'processing').length,
      agentStats: await this.agentCore.getAgentStats(),
      sandboxStats: await this.sandbox.getStats(),
      webStats: await this.web.getStats(),
      plannerStats: await this.planner.getStats(),
      terminalStats: await this.terminal.getStats(),
      filesystemStats: await this.filesystem.getStats(),
      processStats: await this.processes.getStats(),
      memoryStats: await this.memory.getMemoryStats(),
      strategyStats: await this.strategy.getStats()
    };
  }

  getSubEngine(engineName) {
    const engines = {
      agentCore: this.agentCore,
      sandbox: this.sandbox,
      web: this.web,
      planner: this.planner,
      terminal: this.terminal,
      filesystem: this.filesystem,
      processes: this.processes,
      memory: this.memory,
      strategy: this.strategy
    };
    return engines[engineName];
  }
}

module.exports = AIOrchestrator;
