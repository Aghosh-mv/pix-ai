const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class WorkflowEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.workflows = new Map();
    this.executions = new Map();
    this.templates = new Map();
    this.eventEmitter = new EventEmitter();
    this.workflowsDir = path.join(os.homedir(), '.pix/workflows');
  }

  async initialize() {
    this.logger.info('Initializing Workflow Engine...');
    await fs.ensureDir(this.workflowsDir);
    await this.loadWorkflows();
    this.loadTemplates();
    this.logger.info('Workflow Engine initialized');
  }

  async loadWorkflows() {
    try {
      const files = await fs.readdir(this.workflowsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const workflow = await fs.readJson(path.join(this.workflowsDir, file));
          this.workflows.set(workflow.id, workflow);
        }
      }
    } catch (e) {}
  }

  loadTemplates() {
    const builtInTemplates = [
      {
        id: 'auto-deploy',
        name: 'Auto Deploy',
        description: 'Automatically deploy code after testing',
        steps: [
          { type: 'execute', language: 'bash', code: 'npm test' },
          { type: 'condition', check: 'exitCode === 0' },
          { type: 'execute', language: 'bash', code: 'npm run build' },
          { type: 'execute', language: 'bash', code: 'npm run deploy' }
        ],
        tags: ['deployment', 'ci-cd']
      },
      {
        id: 'code-review',
        name: 'Code Review',
        description: 'Automated code review with AI',
        steps: [
          { type: 'screenshot', description: 'Capture current code' },
          { type: 'ai:vision', prompt: 'Review this code for issues' },
          { type: 'ai:complete', prompt: 'Provide detailed review' },
          { type: 'output', format: 'report' }
        ],
        tags: ['review', 'quality']
      },
      {
        id: 'data-pipeline',
        name: 'Data Pipeline',
        description: 'Process and transform data',
        steps: [
          { type: 'input', source: 'file' },
          { type: 'transform', operation: 'clean' },
          { type: 'transform', operation: 'validate' },
          { type: 'output', destination: 'database' }
        ],
        tags: ['data', 'etl']
      },
      {
        id: 'app-monitor',
        name: 'App Monitor',
        description: 'Monitor application health',
        steps: [
          { type: 'execute', language: 'bash', code: 'curl -s http://localhost:3000/health' },
          { type: 'condition', check: 'response.status === 200' },
          { type: 'notification', message: 'App is healthy' },
          { type: 'else' },
          { type: 'notification', message: 'App is down!', priority: 'high' }
        ],
        tags: ['monitoring', 'devops']
      },
      {
        id: 'screenshot-report',
        name: 'Screenshot Report',
        description: 'Take screenshots and generate report',
        steps: [
          { type: 'automation:screenshot', region: 'full' },
          { type: 'ai:vision', prompt: 'Describe what you see' },
          { type: 'storage:save', category: 'report' },
          { type: 'notification', message: 'Report generated' }
        ],
        tags: ['reporting', 'screenshots']
      },
      {
        id: 'learn-app',
        name: 'Learn Application',
        description: 'Learn how to use an application',
        steps: [
          { type: 'automation:app:open', name: '{{appName}}' },
          { type: 'delay', ms: 3000 },
          { type: 'automation:screenshot' },
          { type: 'ai:vision', prompt: 'Analyze this application interface' },
          { type: 'learning:teach', type: 'app-pattern' },
          { type: 'automation:app:close', name: '{{appName}}' }
        ],
        tags: ['learning', 'automation']
      },
      {
        id: 'web-scraper',
        name: 'Web Scraper',
        description: 'Scrape data from websites',
        steps: [
          { type: 'knowledge:search', query: '{{searchQuery}}' },
          { type: 'transform', operation: 'extract-data' },
          { type: 'storage:save', category: 'data' },
          { type: 'output', format: 'json' }
        ],
        tags: ['scraping', 'data']
      },
      {
        id: 'code-migration',
        name: 'Code Migration',
        description: 'Migrate code between languages',
        steps: [
          { type: 'input', source: 'file' },
          { type: 'ai:complete', prompt: 'Convert this {{sourceLang}} code to {{targetLang}}' },
          { type: 'sandbox:execute', language: '{{targetLang}}' },
          { type: 'condition', check: 'exitCode === 0' },
          { type: 'storage:save', language: '{{targetLang}}' }
        ],
        tags: ['migration', 'conversion']
      }
    ];

    builtInTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  async create(params) {
    const {
      name,
      description = '',
      steps = [],
      variables = {},
      tags = [],
      schedule = null,
      enabled = true
    } = params;

    const id = uuidv4();
    const workflow = {
      id,
      name,
      description,
      steps,
      variables,
      tags,
      schedule,
      enabled,
      version: 1,
      executions: 0,
      lastExecution: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.workflows.set(id, workflow);
    await this.saveWorkflow(workflow);

    this.logger.info(`Workflow created: ${name}`);
    return workflow;
  }

  async update(params) {
    const { id, ...updates } = params;
    const workflow = this.workflows.get(id);

    if (!workflow) throw new Error(`Workflow not found: ${id}`);

    const updated = {
      ...workflow,
      ...updates,
      version: workflow.version + 1,
      updatedAt: new Date().toISOString()
    };

    this.workflows.set(id, updated);
    await this.saveWorkflow(updated);

    return updated;
  }

  async delete(params) {
    const { id } = params;
    const workflow = this.workflows.get(id);

    if (!workflow) throw new Error(`Workflow not found: ${id}`);

    this.workflows.delete(id);
    await fs.remove(path.join(this.workflowsDir, `${id}.json`)).catch(() => {});

    return { success: true };
  }

  async execute(params) {
    const { id, variables = {}, dryRun = false } = params;
    const workflow = this.workflows.get(id);

    if (!workflow) throw new Error(`Workflow not found: ${id}`);

    const executionId = uuidv4();
    const execution = {
      id: executionId,
      workflowId: id,
      workflowName: workflow.name,
      status: 'running',
      variables: { ...workflow.variables, ...variables },
      steps: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null
    };

    this.executions.set(executionId, execution);
    this.eventEmitter.emit('execution:start', execution);

    if (dryRun) {
      execution.status = 'dry-run';
      execution.completedAt = new Date().toISOString();
      return execution;
    }

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const stepResult = {
          index: i,
          type: step.type,
          status: 'running',
          input: step,
          output: null,
          error: null,
          startedAt: new Date().toISOString(),
          completedAt: null
        };

        execution.steps.push(stepResult);
        this.eventEmitter.emit('step:start', { executionId, step: stepResult });

        try {
          const output = await this.executeStep(step, execution.variables);
          stepResult.output = output;
          stepResult.status = 'completed';
        } catch (error) {
          stepResult.error = error.message;
          stepResult.status = 'failed';
          throw error;
        } finally {
          stepResult.completedAt = new Date().toISOString();
          this.eventEmitter.emit('step:complete', { executionId, step: stepResult });
        }
      }

      execution.status = 'completed';
      workflow.executions++;
      workflow.lastExecution = new Date().toISOString();
      await this.saveWorkflow(workflow);
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
    } finally {
      execution.completedAt = new Date().toISOString();
      this.eventEmitter.emit('execution:complete', execution);
    }

    return execution;
  }

  async executeStep(step, variables) {
    const resolvedStep = this.resolveVariables(step, variables);

    switch (resolvedStep.type) {
      case 'execute':
        return { result: 'executed', code: resolvedStep.code };

      case 'ai:complete':
        return { result: 'ai-response', prompt: resolvedStep.prompt };

      case 'ai:vision':
        return { result: 'vision-analysis', prompt: resolvedStep.prompt };

      case 'screenshot':
        return { result: 'screenshot-taken', region: resolvedStep.region };

      case 'automation:screenshot':
        return { result: 'screenshot-taken' };

      case 'automation:app:open':
        return { result: 'app-opened', name: resolvedStep.name };

      case 'automation:app:close':
        return { result: 'app-closed', name: resolvedStep.name };

      case 'storage:save':
        return { result: 'saved', category: resolvedStep.category };

      case 'knowledge:search':
        return { result: 'search-completed', query: resolvedStep.query };

      case 'learning:teach':
        return { result: 'taught', type: resolvedStep.type };

      case 'condition':
        return { result: 'condition-evaluated', check: resolvedStep.check };

      case 'delay':
        await new Promise(resolve => setTimeout(resolve, resolvedStep.ms || 1000));
        return { result: 'delayed', ms: resolvedStep.ms };

      case 'notification':
        return { result: 'notified', message: resolvedStep.message };

      case 'output':
        return { result: 'output-generated', format: resolvedStep.format };

      case 'input':
        return { result: 'input-received', source: resolvedStep.source };

      case 'transform':
        return { result: 'transformed', operation: resolvedStep.operation };

      case 'sandbox:execute':
        return { result: 'sandbox-executed', language: resolvedStep.language };

      case 'else':
        return { result: 'else-branch' };

      default:
        return { result: 'unknown-step', type: resolvedStep.type };
    }
  }

  resolveVariables(obj, variables) {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] || match);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveVariables(item, variables));
    }

    if (typeof obj === 'object' && obj !== null) {
      const resolved = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveVariables(value, variables);
      }
      return resolved;
    }

    return obj;
  }

  list() {
    return Array.from(this.workflows.values());
  }

  get(id) {
    return this.workflows.get(id);
  }

  getTemplates() {
    return Array.from(this.templates.values());
  }

  getTemplate(id) {
    return this.templates.get(id);
  }

  async createFromTemplate(templateId, variables = {}) {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    return this.create({
      name: template.name,
      description: template.description,
      steps: template.steps,
      variables,
      tags: template.tags
    });
  }

  getExecution(id) {
    return this.executions.get(id);
  }

  listExecutions(workflowId) {
    return Array.from(this.executions.values())
      .filter(e => !workflowId || e.workflowId === workflowId)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  async saveWorkflow(workflow) {
    const filePath = path.join(this.workflowsDir, `${workflow.id}.json`);
    await fs.writeJson(filePath, workflow, { spaces: 2 });
  }
}

module.exports = WorkflowEngine;
