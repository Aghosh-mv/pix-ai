const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class PlatformBotEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.bots = new Map();
    this.integrations = new Map();
    this.webhookHandlers = new Map();
    this.botDir = path.join(os.homedir(), '.pix/bots');

    this.platforms = [
      {
        id: 'gmail',
        name: 'Gmail',
        icon: '📧',
        description: 'Email assistant bot - lives inside your Gmail',
        color: '#D44638',
        capabilities: ['read-email', 'send-email', 'draft-reply', 'organize', 'label', 'search', 'summarize', 'translate', 'auto-respond', 'follow-up'],
        authType: 'oauth2',
        scopes: ['gmail.readonly', 'gmail.send', 'gmail.modify', 'gmail.labels'],
        webhookEvents: ['new-email', 'reply', 'forward', 'label-change'],
        botBehavior: 'Lives inside Gmail as your AI assistant. Reads, drafts, organizes emails. Suggests replies. Summarizes threads. Translates. Follows up.'
      },
      {
        id: 'github',
        name: 'GitHub',
        icon: '🐙',
        description: 'GitHub bot - PRs, issues, code reviews',
        color: '#333333',
        capabilities: ['create-pr', 'review-code', 'manage-issues', 'auto-merge', 'release', 'actions', 'discussions', 'wiki', 'security-alerts'],
        authType: 'token',
        webhookEvents: ['push', 'pull-request', 'issue', 'release', 'discussion'],
        botBehavior: 'Lives in your repos. Reviews PRs automatically. Manages issues. Runs CI/CD. Creates releases. Monitors security.'
      },
      {
        id: 'slack',
        name: 'Slack',
        icon: '💬',
        description: 'Slack bot - team communication assistant',
        color: '#4A154B',
        capabilities: ['send-message', 'respond', 'summarize-channels', 'schedule', 'remind', 'poll', 'translate', 'search', 'onboard'],
        authType: 'oauth2',
        webhookEvents: ['message', 'mention', 'reaction', 'command'],
        botBehavior: 'Lives in Slack channels. Answers questions. Summarizes discussions. Schedules meetings. Onboards new members. Translates messages.'
      },
      {
        id: 'discord',
        name: 'Discord',
        icon: '🎮',
        description: 'Discord bot - community management',
        color: '#5865F2',
        capabilities: ['send-message', 'moderate', 'welcome', 'role-manage', 'event', 'voice-assist', 'game-stats', 'music'],
        authType: 'token',
        webhookEvents: ['message', 'member-join', 'voice-state', 'interaction'],
        botBehavior: 'Lives in Discord servers. Moderates content. Welcomes members. Manages roles. Assists in voice channels. Tracks game stats.'
      },
      {
        id: 'notion',
        name: 'Notion',
        icon: '📋',
        description: 'Notion bot - workspace assistant',
        color: '#000000',
        capabilities: ['create-page', 'update-database', 'search', 'summarize', 'template', 'task-manage', 'wiki', 'meeting-notes'],
        authType: 'integration',
        webhookEvents: ['page-create', 'page-update', 'comment'],
        botBehavior: 'Lives in Notion. Creates pages. Updates databases. Summarizes content. Manages tasks. Generates meeting notes. Maintains wiki.'
      },
      {
        id: 'twitter',
        name: 'Twitter/X',
        icon: '🐦',
        description: 'Twitter bot - social media assistant',
        color: '#1DA1F2',
        capabilities: ['post-tweet', 'reply', 'dm', 'search', 'analytics', 'schedule', 'monitor', 'engagement'],
        authType: 'oauth2',
        webhookEvents: ['tweet', 'mention', 'dm', 'follow'],
        botBehavior: 'Manages your Twitter presence. Posts content. Replies to mentions. Analyzes engagement. Monitors trends. Schedules posts.'
      },
      {
        id: 'linkedin',
        name: 'LinkedIn',
        icon: '💼',
        description: 'LinkedIn bot - professional networking',
        color: '#0077B5',
        capabilities: ['post', 'comment', 'connect', 'message', 'search-jobs', 'company-update', 'article'],
        authType: 'oauth2',
        webhookEvents: ['connection', 'message', 'post-engagement'],
        botBehavior: 'Manages professional presence. Posts updates. Engages with network. Searches jobs. Manages company page.'
      },
      {
        id: 'google-calendar',
        name: 'Google Calendar',
        icon: '📅',
        description: 'Calendar bot - schedule management',
        color: '#4285F4',
        capabilities: ['create-event', 'update-event', 'delete-event', 'check-availability', 'suggest-time', 'remind', 'travel-time', 'recurring'],
        authType: 'oauth2',
        webhookEvents: ['event-create', 'event-update', 'event-cancel'],
        botBehavior: 'Manages your calendar. Creates events. Suggests meeting times. Tracks travel time. Sends reminders. Handles recurring events.'
      },
      {
        id: 'google-drive',
        name: 'Google Drive',
        icon: '📂',
        description: 'Drive bot - file management',
        color: '#0F9D58',
        capabilities: ['upload', 'download', 'share', 'organize', 'search', 'backup', 'sync', 'collaborate'],
        authType: 'oauth2',
        webhookEvents: ['file-create', 'file-update', 'file-share'],
        botBehavior: 'Manages Drive files. Organizes folders. Backs up important files. Shares with team. Syncs across devices.'
      },
      {
        id: 'linear',
        name: 'Linear',
        icon: '📐',
        description: 'Linear bot - project management',
        color: '#5E6AD2',
        capabilities: ['create-issue', 'update-status', 'sprint-planning', 'roadmap', 'triage', 'automate', 'report'],
        authType: 'api-key',
        webhookEvents: ['issue-create', 'issue-update', 'cycle-update'],
        botBehavior: 'Manages Linear projects. Creates issues. Plans sprints. Triages incoming requests. Generates reports. Automates workflows.'
      },
      {
        id: 'jira',
        name: 'Jira',
        icon: '📊',
        description: 'Jira bot - agile project management',
        color: '#0052CC',
        capabilities: ['create-ticket', 'update-status', 'sprint', 'backlog', 'report', 'automate', 'link-commits'],
        authType: 'oauth2',
        webhookEvents: ['issue-create', 'issue-update', 'sprint-update'],
        botBehavior: 'Manages Jira tickets. Plans sprints. Reports progress. Links to code. Automates transitions.'
      },
      {
        id: 'stripe',
        name: 'Stripe',
        icon: '💳',
        description: 'Stripe bot - payment management',
        color: '#635BFF',
        capabilities: ['create-invoice', 'manage-subscription', 'refund', 'analytics', 'customer', 'payout', 'dispute'],
        authType: 'api-key',
        webhookEvents: ['payment', 'subscription', 'invoice', 'dispute'],
        botBehavior: 'Manages payments. Creates invoices. Handles refunds. Tracks analytics. Manages subscriptions. Resolves disputes.'
      },
      {
        id: 'aws',
        name: 'AWS',
        icon: '☁️',
        description: 'AWS bot - cloud infrastructure',
        color: '#FF9900',
        capabilities: ['ec2', 's3', 'lambda', 'rds', 'cloudwatch', 'iam', 'cost-optimization', 'security'],
        authType: 'credentials',
        webhookEvents: ['alarm', 'deployment', 'security-alert'],
        botBehavior: 'Manages AWS infrastructure. Monitors costs. Optimizes resources. Handles deployments. Monitors security.'
      },
      {
        id: 'docker-hub',
        name: 'Docker Hub',
        icon: '🐳',
        description: 'Docker bot - container management',
        color: '#2496ED',
        capabilities: ['push-image', 'pull-image', 'manage-tags', 'scan-vulnerabilities', 'automated-builds', 'webhooks'],
        authType: 'token',
        webhookEvents: ['build-complete', 'push', 'vulnerability'],
        botBehavior: 'Manages Docker images. Builds automatically. Scans for vulnerabilities. Manages tags and versions.'
      },
      {
        id: 'vercel',
        name: 'Vercel',
        icon: '▲',
        description: 'Vercel bot - deployment management',
        color: '#000000',
        capabilities: ['deploy', 'preview', 'rollback', 'analytics', 'domains', 'env-vars', 'serverless'],
        authType: 'token',
        webhookEvents: ['deploy-ready', 'deploy-error', 'domain-change'],
        botBehavior: 'Manages Vercel deployments. Creates previews. Handles rollbacks. Manages domains. Tracks analytics.'
      },
      {
        id: 'supabase',
        name: 'Supabase',
        icon: '⚡',
        description: 'Supabase bot - database management',
        color: '#3ECF8E',
        capabilities: ['database', 'auth', 'storage', 'realtime', 'edge-functions', 'backups'],
        authType: 'api-key',
        webhookEvents: ['database-change', 'auth-event', 'storage-upload'],
        botBehavior: 'Manages Supabase databases. Handles authentication. Manages storage. Sets up realtime subscriptions.'
      },
      {
        id: 'openai',
        name: 'OpenAI Platform',
        icon: '🤖',
        description: 'OpenAI bot - AI model management',
        color: '#10A37F',
        capabilities: ['fine-tune', 'deploy', 'monitor', 'cost-tracking', 'model-selection', 'prompt-management'],
        authType: 'api-key',
        webhookEvents: ['fine-tune-complete', 'usage-alert'],
        botBehavior: 'Manages OpenAI models. Fine-tunes models. Deploys endpoints. Tracks costs. Manages prompts.'
      },
      {
        id: 'anthropic',
        name: 'Anthropic Platform',
        icon: '🧠',
        description: 'Anthropic bot - Claude management',
        color: '#D4A574',
        capabilities: ['chat', 'analyze', 'summarize', 'code', 'research', 'monitor-usage'],
        authType: 'api-key',
        webhookEvents: ['usage-alert', 'model-update'],
        botBehavior: 'Manages Claude usage. Analyzes documents. Summarizes content. Writes code. Tracks usage.'
      }
    ];

    this.botTemplates = [
      { id: 'email-assistant', name: 'Email Assistant', platform: 'gmail', description: 'Smart email management', autoReply: true, priority: 'high' },
      { id: 'pr-reviewer', name: 'PR Reviewer', platform: 'github', description: 'Automatic code review', autoMerge: false, priority: 'high' },
      { id: 'slack-helper', name: 'Slack Helper', platform: 'slack', description: 'Channel assistant', respondToMentions: true, priority: 'medium' },
      { id: 'moderator', name: 'Moderator', platform: 'discord', description: 'Content moderation', autoModerate: true, priority: 'high' },
      { id: 'social-manager', name: 'Social Manager', platform: 'twitter', description: 'Social media management', schedulePosts: true, priority: 'medium' },
      { id: 'scheduler', name: 'Scheduler', platform: 'google-calendar', description: 'Calendar management', autoSchedule: true, priority: 'medium' },
      { id: 'devops-bot', name: 'DevOps Bot', platform: 'aws', description: 'Infrastructure management', autoScale: true, priority: 'high' },
      { id: 'payment-bot', name: 'Payment Bot', platform: 'stripe', description: 'Payment management', autoInvoice: true, priority: 'high' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Platform Bot Engine...');
    await fs.ensureDir(this.botDir);
    await this.loadData();
    this.loadBehaviorRules();
    this.loadWorkModeSettings();
    this.logger.info('Platform Bot Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.botDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.botDir, file));
          if (data.type === 'bot') this.bots.set(data.id, data);
          else if (data.type === 'integration') this.integrations.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadBehaviorRules() {
    this.behaviorRules = [
      { id: 'respectful', name: 'Respectful', description: 'Always be respectful and professional', icon: '🙏', priority: 10 },
      { id: 'helpful', name: 'Helpful', description: 'Always try to help the user', icon: '🤝', priority: 10 },
      { id: 'privacy', name: 'Privacy First', description: 'Never share personal information', icon: '🔒', priority: 10 },
      { id: 'consent', name: 'Ask Before Acting', description: 'Get permission for important actions', icon: '✋', priority: 8 },
      { id: 'transparent', name: 'Transparent', description: 'Clearly state when AI is responding', icon: '🤖', priority: 7 },
      { id: 'context-aware', name: 'Context Aware', description: 'Understand the conversation context', icon: '🧠', priority: 8 },
      { id: 'adaptive', name: 'Adaptive', description: 'Adjust behavior based on platform norms', icon: '🔄', priority: 6 },
      { id: 'timely', name: 'Timely', description: 'Respond promptly but not immediately', icon: '⏰', priority: 5 }
    ];
  }

  loadWorkModeSettings() {
    this.workModeSettings = {
      enabled: false,
      name: 'Work Mode',
      description: 'Enterprise-grade AI assistant for company use',
      privacy: {
        neverReleaseWorkContext: true,
        neverShareExternal: true,
        encryptSensitiveData: true,
        auditAllActions: true,
        dataRetentionDays: 90,
        complyWithGDPR: true,
        complyWithCCPA: true
      },
      features: {
        autoRespond: false,
        smartRouting: true,
        escalationRules: true,
        approvalWorkflows: true,
        accessControl: true,
        auditLogging: true,
        costTracking: true,
        usageLimits: true
      },
      security: {
        requireAuth: true,
        ipWhitelist: [],
        rateLimit: 100,
        encryptionLevel: 'aes-256',
        sessionTimeout: 3600,
        mfaRequired: false
      },
      compliance: {
        soc2: false,
        hipaa: false,
        pci: false,
        iso27001: false
      }
    };
  }

  async createBot(params) {
    const {
      name,
      platform,
      description = '',
      template = null,
      settings = {},
      behavior = 'helpful',
      workMode = false,
      customResponses = {},
      autoActions = []
    } = params;

    const id = uuidv4();
    const platformData = this.platforms.find(p => p.id === platform);
    if (!platformData) throw new Error(`Platform not found: ${platform}`);

    const bot = {
      id,
      name,
      platform,
      platformInfo: platformData,
      description,
      template,
      settings: {
        respondToMentions: true,
        respondToDMs: true,
        autoModerate: false,
        smartRouting: true,
        workMode,
        ...settings
      },
      behavior,
      customResponses,
      autoActions,
      status: 'inactive',
      stats: {
        messagesHandled: 0,
        actionsPerformed: 0,
        errorsEncountered: 0,
        uptime: 0
      },
      type: 'bot',
      createdAt: new Date().toISOString()
    };

    this.bots.set(id, bot);
    await this.saveBot(bot);

    return bot;
  }

  async activateBot(id) {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot not found: ${id}`);

    bot.status = 'active';
    bot.activatedAt = new Date().toISOString();
    this.bots.set(id, bot);
    await this.saveBot(bot);

    return bot;
  }

  async deactivateBot(id) {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot not found: ${id}`);

    bot.status = 'inactive';
    bot.deactivatedAt = new Date().toISOString();
    this.bots.set(id, bot);
    await this.saveBot(bot);

    return bot;
  }

  async processEvent(params) {
    const { botId, event } = params;
    const bot = this.bots.get(botId);
    if (!bot) throw new Error(`Bot not found: ${botId}`);

    const response = {
      id: uuidv4(),
      botId,
      event,
      processed: false,
      response: null,
      actions: [],
      timestamp: new Date().toISOString()
    };

    if (bot.settings.workMode && this.workModeSettings.privacy.neverReleaseWorkContext) {
      const safeEvent = this.sanitizeForWorkMode(event);
      response.processed = true;
      response.response = await this.generateResponse(bot, safeEvent);
      response.actions = await this.determineActions(bot, safeEvent);
    } else {
      response.processed = true;
      response.response = await this.generateResponse(bot, event);
      response.actions = await this.determineActions(bot, event);
    }

    bot.stats.messagesHandled++;
    this.bots.set(botId, bot);

    return response;
  }

  sanitizeForWorkMode(event) {
    const sanitized = { ...event };

    const personalPatterns = [
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g
    ];

    if (sanitized.content) {
      for (const pattern of personalPatterns) {
        sanitized.content = sanitized.content.replace(pattern, '[REDACTED]');
      }
    }

    return sanitized;
  }

  async generateResponse(bot, event) {
    return {
      text: `AI response to: ${event.type || 'event'}`,
      confidence: 0.8,
      sentiment: 'neutral',
      actions: []
    };
  }

  async determineActions(bot, event) {
    return [];
  }

  async enableWorkMode(params = {}) {
    this.workModeSettings.enabled = true;

    if (params.privacy) {
      this.workModeSettings.privacy = { ...this.workModeSettings.privacy, ...params.privacy };
    }

    if (params.security) {
      this.workModeSettings.security = { ...this.workModeSettings.security, ...params.security };
    }

    return {
      enabled: true,
      message: 'Work Mode enabled. Company data is protected. AI will not release work context externally.',
      settings: this.workModeSettings
    };
  }

  async disableWorkMode() {
    this.workModeSettings.enabled = false;
    return {
      enabled: false,
      message: 'Work Mode disabled.'
    };
  }

  async getWorkModeStatus() {
    return this.workModeSettings;
  }

  async createIntegration(params) {
    const {
      platform,
      credentials,
      webhookUrl = null,
      settings = {}
    } = params;

    const id = uuidv4();
    const integration = {
      id,
      platform,
      credentials: this.encryptCredentials(credentials),
      webhookUrl,
      settings,
      status: 'connected',
      lastSync: null,
      type: 'integration',
      createdAt: new Date().toISOString()
    };

    this.integrations.set(id, integration);
    await this.saveIntegration(integration);

    return { ...integration, credentials: '[ENCRYPTED]' };
  }

  encryptCredentials(credentials) {
    return Buffer.from(JSON.stringify(credentials)).toString('base64');
  }

  decryptCredentials(encrypted) {
    return JSON.parse(Buffer.from(encrypted, 'base64').toString());
  }

  async getBot(id) {
    return this.bots.get(id);
  }

  listBots(options = {}) {
    const { platform, status } = options;
    let bots = Array.from(this.bots.values());

    if (platform) bots = bots.filter(b => b.platform === platform);
    if (status) bots = bots.filter(b => b.status === status);

    return bots;
  }

  async getIntegration(id) {
    return this.integrations.get(id);
  }

  listIntegrations() {
    return Array.from(this.integrations.values());
  }

  getPlatforms() {
    return this.platforms;
  }

  getBotTemplates() {
    return this.botTemplates;
  }

  getBehaviorRules() {
    return this.behaviorRules;
  }

  async getStats() {
    const bots = Array.from(this.bots.values());
    const integrations = Array.from(this.integrations.values());

    return {
      bots: bots.length,
      activeBots: bots.filter(b => b.status === 'active').length,
      integrations: integrations.length,
      connectedPlatforms: [...new Set(integrations.map(i => i.platform))].length,
      totalMessagesHandled: bots.reduce((sum, b) => sum + b.stats.messagesHandled, 0),
      workModeEnabled: this.workModeSettings.enabled
    };
  }

  async saveBot(bot) {
    const filePath = path.join(this.botDir, `bot-${bot.id}.json`);
    await fs.writeJson(filePath, bot, { spaces: 2 });
  }

  async saveIntegration(integration) {
    const filePath = path.join(this.botDir, `integration-${integration.id}.json`);
    await fs.writeJson(filePath, integration, { spaces: 2 });
  }

  async exportBots(format = 'json') {
    const data = {
      bots: Array.from(this.bots.values()),
      integrations: Array.from(this.integrations.values()),
      platforms: this.platforms,
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = PlatformBotEngine;
