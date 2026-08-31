const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class PrivateModesEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.modes = new Map();
    this.sessions = new Map();
    this.workspaces = new Map();
    this.auditLogs = new Map();
    this.modesDir = path.join(os.homedir(), '.pix/modes');

    this.modeDefinitions = [
      {
        id: 'plan',
        name: 'Plan Mode',
        icon: '📋',
        description: 'Research, analyze, and plan without making changes',
        color: '#4A90D9',
        permissions: {
          read: true,
          write: false,
          execute: false,
          internet: true,
          filesystem: 'read-only',
          terminal: 'read-only'
        },
        features: ['analysis', 'research', 'planning', 'brainstorming', 'evaluation'],
        restrictions: ['no-file-changes', 'no-command-execution', 'no-deployments'],
        aiBehavior: 'conservative',
        outputFormat: 'structured-plan'
      },
      {
        id: 'build',
        name: 'Build Mode',
        icon: '🔨',
        description: 'Create, modify, and build with full capabilities',
        color: '#4CAF50',
        permissions: {
          read: true,
          write: true,
          execute: true,
          internet: true,
          filesystem: 'full',
          terminal: 'full'
        },
        features: ['coding', 'building', 'testing', 'deploying', 'debugging'],
        restrictions: ['require-confirmation-for-destructive'],
        aiBehavior: 'productive',
        outputFormat: 'code-and-explanation'
      },
      {
        id: 'private',
        name: 'Private Mode',
        icon: '🔒',
        description: 'Isolated environment with enhanced privacy',
        color: '#9C27B0',
        permissions: {
          read: true,
          write: true,
          execute: true,
          internet: false,
          filesystem: 'sandboxed',
          terminal: 'sandboxed'
        },
        features: ['local-development', 'sensitive-data', 'offline-work', 'secure-coding'],
        restrictions: ['no-internet', 'no-external-apis', 'sandboxed-storage'],
        aiBehavior: 'privacy-focused',
        outputFormat: 'detailed-with-warnings'
      },
      {
        id: 'research',
        name: 'Research Mode',
        icon: '🔬',
        description: 'Deep research with extensive web access',
        color: '#FF9800',
        permissions: {
          read: true,
          write: false,
          execute: false,
          internet: true,
          filesystem: 'read-only',
          terminal: 'restricted'
        },
        features: ['web-search', 'documentation', 'analysis', 'synthesis', 'citations'],
        restrictions: ['no-file-changes', 'no-code-execution'],
        aiBehavior: 'thorough',
        outputFormat: 'research-report'
      },
      {
        id: 'review',
        name: 'Review Mode',
        icon: '🔍',
        description: 'Code review and quality analysis',
        color: '#2196F3',
        permissions: {
          read: true,
          write: false,
          execute: false,
          internet: false,
          filesystem: 'read-only',
          terminal: 'read-only'
        },
        features: ['code-review', 'quality-analysis', 'security-audit', 'performance-review'],
        restrictions: ['no-modifications', 'no-execution'],
        aiBehavior: 'critical',
        outputFormat: 'review-report'
      },
      {
        id: 'debug',
        name: 'Debug Mode',
        icon: '🐛',
        description: 'Debugging with step-through and inspection',
        color: '#F44336',
        permissions: {
          read: true,
          write: true,
          execute: true,
          internet: false,
          filesystem: 'full',
          terminal: 'full'
        },
        features: ['step-through', 'breakpoints', 'variable-inspection', 'stack-traces'],
        restrictions: ['monitor-all-actions'],
        aiBehavior: 'methodical',
        outputFormat: 'debug-report'
      },
      {
        id: 'teach',
        name: 'Teach Mode',
        icon: '📚',
        description: 'Educational mode with detailed explanations',
        color: '#00BCD4',
        permissions: {
          read: true,
          write: true,
          execute: true,
          internet: true,
          filesystem: 'full',
          terminal: 'full'
        },
        features: ['step-by-step', 'explanations', 'examples', 'best-practices', 'quizzes'],
        restrictions: [],
        aiBehavior: 'pedagogical',
        outputFormat: 'tutorial'
      },
      {
        id: 'creative',
        name: 'Creative Mode',
        icon: '🎨',
        description: 'Creative brainstorming and ideation',
        color: '#E91E63',
        permissions: {
          read: true,
          write: true,
          execute: true,
          internet: true,
          filesystem: 'full',
          terminal: 'full'
        },
        features: ['brainstorming', 'ideation', 'prototyping', 'design', 'exploration'],
        restrictions: [],
        aiBehavior: 'creative',
        outputFormat: 'creative-ideas'
      },
      {
        id: 'write-fast',
        name: 'Write Fast',
        icon: '⚡',
        description: 'Speed mode - write code fast, minimal analysis, ship it',
        color: '#FF5722',
        permissions: {
          read: true,
          write: true,
          execute: true,
          internet: true,
          filesystem: 'full',
          terminal: 'full'
        },
        features: ['rapid-coding', 'minimal-planning', 'quick-iterations', 'fast-execution', 'ship-now'],
        restrictions: ['skip-deep-analysis', 'no-perfectionism', 'minimal-review'],
        aiBehavior: 'speed-priority',
        outputFormat: 'code-first',
        speedMultiplier: 3,
        qualityTradeoff: 'good-enough',
        thinkingDepth: 'shallow',
        responseStyle: 'terse'
      },
      {
        id: 'debug-deep',
        name: 'Debug Deep',
        icon: '🔬',
        description: 'Deep debugging - thorough analysis, root cause, step-by-step',
        color: '#7B1FA2',
        permissions: {
          read: true,
          write: true,
          execute: true,
          internet: true,
          filesystem: 'full',
          terminal: 'full'
        },
        features: ['root-cause-analysis', 'step-through', 'variable-inspection', 'stack-traces', 'hypothesis-testing', 'memory-analysis', 'race-condition-detection', 'edge-case-hunting'],
        restrictions: ['no-shortcuts', 'must-explain-reasoning'],
        aiBehavior: 'forensic',
        outputFormat: 'debug-report',
        thinkingDepth: 'maximum',
        analysisLevel: 'exhaustive',
        responseStyle: 'detailed'
      },
      {
        id: 'self-rewrite',
        name: 'Self-Rewrite',
        icon: '🪞',
        description: 'Pix tweaks itself - UI, behavior, pacing, thinking patterns, tool presentation',
        color: '#00BCD4',
        permissions: {
          read: true,
          write: true,
          execute: true,
          internet: true,
          filesystem: 'full',
          terminal: 'full'
        },
        features: [
          'ui-twisting',
          'behavior-morphing',
          'pace-adjustment',
          'thinking-pattern-shift',
          'tool-presentation-change',
          'response-style-mutation',
          'personality-drift',
          'verbosity-control',
          'humor-level',
          'formality-adjustment',
          'emoji-usage-shift',
          'explanation-depth',
          'code-comment-style',
          'greeting-customization',
          'farewell-customization',
          'error-message-tone',
          'success-celebration-style',
          'question-asking-style',
          'proactiveness-level',
          'interruption-tolerance'
        ],
        restrictions: [
          'no-core-logic-rewrite',
          'no-security-bypass',
          'no-permission-escalation',
          'no-external-api-creation',
          'no-data-exfiltration',
          'no-self-deletion',
          'no-sandbox-escape',
          'must-preserve-audit-trail',
          'changes-reversible',
          'max-changes-per-session:20'
        ],
        aiBehavior: 'metamorphic',
        outputFormat: 'self-modified',
        rewriteScope: {
          ui: {
            allowed: ['theme', 'layout-preferences', 'animation-speed', 'icon-style', 'color-scheme', 'font-preference', 'spacing', 'border-radius', 'glow-effects'],
            blocked: ['remove-security-indicators', 'hide-permission-prompts', 'disable-audit-logs']
          },
          behavior: {
            allowed: ['response-length', 'thinking-verbosity', 'proactiveness', 'confirmation-requirements', 'auto-save-frequency', 'suggestion-aggressiveness', 'context-window-size'],
            blocked: ['disable-safety-checks', 'bypass-approvals', 'auto-execute-dangerous', 'remove-guardrails']
          },
          pacing: {
            allowed: ['typing-speed', 'thinking-delay', 'stagger-responses', 'pause-between-actions', 'animation-duration', 'progress-update-frequency'],
            blocked: ['remove-timeouts', 'disable-rate-limits']
          },
          thinking: {
            allowed: ['analysis-depth', 'hypothesis-count', 'consideration breadth', 'metacognition-frequency', 'self-questioning', 'alternative-exploration'],
            blocked: ['disable-self-reflection', 'remove-reasoning-transparency']
          },
          tools: {
            allowed: ['tool-order-preference', 'detail-level', 'show-internal-reasoning', 'grouping-style', 'progress-bar-style', 'result-formatting'],
            blocked: ['hide-tool-usage', 'fake-tool-results', 'suppress-errors']
          }
        },
        personas: [
          { id: 'professional', name: 'Professional', formality: 0.9, humor: 0.1, verbosity: 0.5, emoji: 0.0 },
          { id: 'friendly', name: 'Friendly', formality: 0.3, humor: 0.5, verbosity: 0.6, emoji: 0.6 },
          { id: 'minimalist', name: 'Minimalist', formality: 0.5, humor: 0.0, verbosity: 0.2, emoji: 0.0 },
          { id: 'enthusiastic', name: 'Enthusiastic', formality: 0.2, humor: 0.7, verbosity: 0.8, emoji: 0.9 },
          { id: 'zen', name: 'Zen', formality: 0.6, humor: 0.2, verbosity: 0.3, emoji: 0.1 },
          { id: 'hacker', name: 'Hacker', formality: 0.1, humor: 0.4, verbosity: 0.4, emoji: 0.2 },
          { id: 'teacher', name: 'Teacher', formality: 0.5, humor: 0.3, verbosity: 0.9, emoji: 0.3 },
          { id: 'custom', name: 'Custom', formality: 0.5, humor: 0.5, verbosity: 0.5, emoji: 0.5 }
        ]
      }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Private Modes Engine...');
    await fs.ensureDir(this.modesDir);
    await this.loadSessions();
    await this.loadWorkspaces();
    this.logger.info('Private Modes Engine initialized');
  }

  async loadSessions() {
    try {
      const files = await fs.readdir(this.modesDir);
      for (const file of files) {
        if (file.startsWith('session-') && file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.modesDir, file));
          this.sessions.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  async loadWorkspaces() {
    try {
      const files = await fs.readdir(this.modesDir);
      for (const file of files) {
        if (file.startsWith('workspace-') && file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.modesDir, file));
          this.workspaces.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  async createSession(params) {
    const {
      modeId = 'plan',
      name,
      description = '',
      context = {},
      parentSessionId = null,
      encrypted = false,
      autoSave = true,
      timeout = 3600000
    } = params;

    const mode = this.modeDefinitions.find(m => m.id === modeId);
    if (!mode) throw new Error(`Mode not found: ${modeId}`);

    const id = uuidv4();
    const session = {
      id,
      modeId,
      mode: { ...mode },
      name: name || `${mode.name} Session`,
      description,
      context,
      parentSessionId,
      encrypted,
      autoSave,
      timeout,
      status: 'active',
      history: [],
      outputs: [],
      snapshots: [],
      metrics: {
        commandsExecuted: 0,
        filesModified: 0,
        timeSpent: 0,
        actionsBlocked: 0
      },
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      type: 'session'
    };

    this.sessions.set(id, session);
    await this.saveSession(session);

    await this.logAudit(id, 'session-created', { modeId, name: session.name });

    return session;
  }

  async switchMode(sessionId, newModeId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const newMode = this.modeDefinitions.find(m => m.id === newModeId);
    if (!newMode) throw new Error(`Mode not found: ${newModeId}`);

    const oldModeId = session.modeId;

    session.modeId = newModeId;
    session.mode = { ...newMode };
    session.lastActivity = new Date().toISOString();

    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    await this.logAudit(sessionId, 'mode-switched', { from: oldModeId, to: newModeId });

    return session;
  }

  async checkPermission(sessionId, action, resource) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const mode = session.mode;
    let allowed = false;
    let reason = '';

    switch (action) {
      case 'read':
        allowed = mode.permissions.read;
        reason = allowed ? 'Read access granted' : 'Read access denied in this mode';
        break;

      case 'write':
        allowed = mode.permissions.write;
        reason = allowed ? 'Write access granted' : 'Write access denied in this mode';
        break;

      case 'execute':
        allowed = mode.permissions.execute;
        reason = allowed ? 'Execute access granted' : 'Execute access denied in this mode';
        break;

      case 'internet':
        allowed = mode.permissions.internet;
        reason = allowed ? 'Internet access granted' : 'Internet access denied in this mode';
        break;

      case 'filesystem':
        const fsPermission = mode.permissions.filesystem;
        if (fsPermission === 'full') {
          allowed = true;
          reason = 'Full filesystem access';
        } else if (fsPermission === 'read-only') {
          allowed = action === 'read';
          reason = allowed ? 'Read-only filesystem access' : 'Filesystem write denied in read-only mode';
        } else if (fsPermission === 'sandboxed') {
          allowed = resource && resource.startsWith(path.join(os.homedir(), '.pix/sandbox'));
          reason = allowed ? 'Sandboxed filesystem access' : 'Access denied outside sandbox';
        }
        break;

      case 'terminal':
        const termPermission = mode.permissions.terminal;
        if (termPermission === 'full') {
          allowed = true;
          reason = 'Full terminal access';
        } else if (termPermission === 'read-only') {
          allowed = ['ls', 'cat', 'pwd', 'echo', 'env'].some(cmd => resource && resource.startsWith(cmd));
          reason = allowed ? 'Limited terminal access' : 'Terminal command denied';
        } else if (termPermission === 'sandboxed') {
          allowed = true;
          reason = 'Sandboxed terminal access';
        } else if (termPermission === 'restricted') {
          allowed = false;
          reason = 'Terminal access restricted in this mode';
        }
        break;

      default:
        allowed = false;
        reason = 'Unknown action';
    }

    if (!allowed) {
      session.metrics.actionsBlocked++;
      this.sessions.set(sessionId, session);
    }

    await this.logAudit(sessionId, 'permission-check', { action, resource, allowed, reason });

    return { allowed, reason, mode: session.modeId };
  }

  async createAction(sessionId, params) {
    const {
      type,
      description,
      target = null,
      content = null,
      requiresConfirmation = false
    } = params;

    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const permission = await this.checkPermission(sessionId, type, target);
    if (!permission.allowed) {
      throw new Error(`Action denied: ${permission.reason}`);
    }

    if (session.mode.restrictions.includes('require-confirmation-for-destructive') &&
        ['delete', 'remove', 'overwrite', 'deploy'].includes(type)) {
      requiresConfirmation = true;
    }

    const action = {
      id: uuidv4(),
      sessionId,
      type,
      description,
      target,
      content,
      requiresConfirmation,
      confirmed: !requiresConfirmation,
      status: requiresConfirmation ? 'pending' : 'approved',
      createdAt: new Date().toISOString()
    };

    session.history.push(action);
    session.metrics.commandsExecuted++;
    session.lastActivity = new Date().toISOString();

    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    return action;
  }

  async confirmAction(sessionId, actionId, confirmed = true) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const action = session.history.find(a => a.id === actionId);
    if (!action) throw new Error(`Action not found: ${actionId}`);

    action.confirmed = confirmed;
    action.status = confirmed ? 'approved' : 'rejected';
    action.confirmedAt = new Date().toISOString();

    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    await this.logAudit(sessionId, 'action-confirmed', { actionId, confirmed });

    return action;
  }

  async createSnapshot(sessionId, name = null) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const snapshot = {
      id: uuidv4(),
      sessionId,
      name: name || `Snapshot ${session.snapshots.length + 1}`,
      state: {
        context: { ...session.context },
        historyLength: session.history.length,
        metrics: { ...session.metrics }
      },
      createdAt: new Date().toISOString()
    };

    session.snapshots.push(snapshot);
    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    return snapshot;
  }

  async restoreSnapshot(sessionId, snapshotId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const snapshot = session.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`);

    session.context = { ...snapshot.state.context };
    session.lastActivity = new Date().toISOString();

    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    await this.logAudit(sessionId, 'snapshot-restored', { snapshotId });

    return session;
  }

  async createWorkspace(params) {
    const {
      name,
      description = '',
      modes = ['plan', 'build'],
      defaultMode = 'plan',
      settings = {}
    } = params;

    const id = uuidv4();
    const workspace = {
      id,
      name,
      description,
      modes,
      defaultMode,
      settings: {
        autoSwitchMode: true,
        persistHistory: true,
        encryptSensitive: false,
        ...settings
      },
      sessions: [],
      status: 'active',
      type: 'workspace',
      createdAt: new Date().toISOString()
    };

    this.workspaces.set(id, workspace);
    await this.saveWorkspace(workspace);

    return workspace;
  }

  async addToWorkspace(workspaceId, sessionId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    if (!workspace.sessions.includes(sessionId)) {
      workspace.sessions.push(sessionId);
      this.workspaces.set(workspaceId, workspace);
      await this.saveWorkspace(workspace);
    }

    return workspace;
  }

  async endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.status = 'ended';
    session.endedAt = new Date().toISOString();
    session.metrics.timeSpent = new Date(session.endedAt) - new Date(session.startedAt);

    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    await this.logAudit(sessionId, 'session-ended', {
      duration: session.metrics.timeSpent,
      commandsExecuted: session.metrics.commandsExecuted,
      actionsBlocked: session.metrics.actionsBlocked
    });

    return session;
  }

  async getSession(id) {
    return this.sessions.get(id);
  }

  listSessions(options = {}) {
    const { modeId, status, workspaceId } = options;
    let sessions = Array.from(this.sessions.values());

    if (modeId) sessions = sessions.filter(s => s.modeId === modeId);
    if (status) sessions = sessions.filter(s => s.status === status);

    if (workspaceId) {
      const workspace = this.workspaces.get(workspaceId);
      if (workspace) {
        sessions = sessions.filter(s => workspace.sessions.includes(s.id));
      }
    }

    return sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
  }

  getModeDefinitions() {
    return this.modeDefinitions;
  }

  async getWorkspace(id) {
    return this.workspaces.get(id);
  }

  listWorkspaces() {
    return Array.from(this.workspaces.values());
  }

  async logAudit(sessionId, action, details) {
    const logId = uuidv4();
    const log = {
      id: logId,
      sessionId,
      action,
      details,
      timestamp: new Date().toISOString()
    };

    this.auditLogs.set(logId, log);
    return log;
  }

  async getAuditLogs(sessionId = null, limit = 100) {
    let logs = Array.from(this.auditLogs.values());

    if (sessionId) {
      logs = logs.filter(l => l.sessionId === sessionId);
    }

    return logs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async getStats() {
    const sessions = Array.from(this.sessions.values());
    const workspaces = Array.from(this.workspaces.values());

    const byMode = {};
    for (const mode of this.modeDefinitions) {
      byMode[mode.id] = sessions.filter(s => s.modeId === mode.id).length;
    }

    return {
      sessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      workspaces: workspaces.length,
      byMode,
      totalActionsBlocked: sessions.reduce((sum, s) => sum + s.metrics.actionsBlocked, 0),
      totalCommandsExecuted: sessions.reduce((sum, s) => sum + s.metrics.commandsExecuted, 0)
    };
  }

  async saveSession(session) {
    const filePath = path.join(this.modesDir, `session-${session.id}.json`);
    await fs.writeJson(filePath, session, { spaces: 2 });
  }

  async saveWorkspace(workspace) {
    const filePath = path.join(this.modesDir, `workspace-${workspace.id}.json`);
    await fs.writeJson(filePath, workspace, { spaces: 2 });
  }
}

module.exports = PrivateModesEngine;
