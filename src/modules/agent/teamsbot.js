const { v4: uuidv4 } = require('uuid');

class TeamsDiscordBotEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.bots = new Map();
    this.channels = new Map();
    this.commands = new Map();
    this.responses = new Map();
    this.permissions = new Map();

    this.platforms = [
      { id: 'discord', name: 'Discord', icon: '🎮', features: ['text', 'voice', 'slash-commands', 'embeds', 'reactions', 'threads', 'stage', 'events'], maxMessageLength: 2000, supportsEmbeds: true },
      { id: 'slack', name: 'Slack', icon: '💼', features: ['text', 'slash-commands', 'blocks', 'reactions', 'threads', 'modals'], maxMessageLength: 40000, supportsBlocks: true },
      { id: 'teams', name: 'Microsoft Teams', icon: '🏢', features: ['text', 'adaptive-cards', 'tabs', 'dialogs', 'webhooks'], maxMessageLength: 28000, supportsAdaptiveCards: true },
      { id: 'telegram', name: 'Telegram', icon: '📱', features: ['text', 'inline-keyboards', 'reply-keyboards', 'media', 'voice'], maxMessageLength: 4096, supportsInlineKeyboards: true },
      { id: 'matrix', name: 'Matrix/Element', icon: '🔗', features: ['text', 'reactions', 'threads', 'spaces'], maxMessageLength: 65536, supportsRichContent: true },
      { id: 'irc', name: 'IRC', icon: '📡', features: ['text', 'channels', 'private-messages'], maxMessageLength: 512, supportsRichContent: false },
      { id: 'whatsapp', name: 'WhatsApp', icon: '📞', features: ['text', 'media', 'location'], maxMessageLength: 65536, supportsRichContent: false },
      { id: 'signal', name: 'Signal', icon: '🔐', features: ['text', 'media', 'reactions'], maxMessageLength: 65536, supportsRichContent: false }
    ];

    this.botModes = [
      { id: 'standalone', name: 'Standalone', icon: '🤖', description: 'Pix runs as independent bot', useCase: 'Personal assistant bot' },
      { id: 'team-assistant', name: 'Team Assistant', icon: '👥', description: 'Pix assists team members', useCase: 'Work team productivity' },
      { id: 'moderator', name: 'Moderator', icon: '🛡️', description: 'Pix moderates channels', useCase: 'Community management' },
      { id: 'coder-bot', name: 'Coder Bot', icon: '💻', description: 'Pix helps with coding in chat', useCase: 'Dev team collaboration' },
      { id: 'support-bot', name: 'Support Bot', icon: '🎫', description: 'Pix handles support tickets', useCase: 'Customer support' },
      { id: 'alert-bot', name: 'Alert Bot', icon: '🔔', description: 'Pix sends alerts and notifications', useCase: 'Monitoring and alerts' },
      { id: 'meeting-bot', name: 'Meeting Bot', icon: '📅', description: 'Pix manages meetings and notes', useCase: 'Meeting management' },
      { id: 'research-bot', name: 'Research Bot', icon: '🔬', description: 'Pix researches and summarizes', useCase: 'Knowledge management' }
    ];

    this.commandTypes = [
      { id: 'slash', name: 'Slash Command', icon: '/', description: 'Triggered by /command', syntax: '/{command}' },
      { id: 'mention', name: 'Mention', icon: '@', description: 'Triggered by @Pix', syntax: '@Pix {message}' },
      { id: 'keyword', name: 'Keyword', icon: '🔑', description: 'Triggered by keyword', syntax: '{keyword} {message}' },
      { id: 'reaction', name: 'Reaction', icon: '👍', description: 'Triggered by reaction', syntax: 'React with {emoji}' },
      { id: 'button', name: 'Button', icon: '🔘', description: 'Triggered by button click', syntax: 'Click {button}' },
      { id: 'schedule', name: 'Scheduled', icon: '⏰', description: 'Runs on schedule', syntax: 'Every {interval}' },
      { id: 'webhook', name: 'Webhook', icon: '🔗', description: 'Triggered by webhook', syntax: 'POST /webhook/{id}' },
      { id: 'event', name: 'Event', icon: '📅', description: 'Triggered by calendar event', syntax: 'On {event}' }
    ];

    this.responseTypes = [
      { id: 'text', name: 'Text', icon: '📝', description: 'Plain text response' },
      { id: 'embed', name: 'Embed', icon: '📋', description: 'Rich embed/card response' },
      { id: 'code', name: 'Code Block', icon: '💻', description: 'Formatted code response' },
      { id: 'file', name: 'File', icon: '📎', description: 'File attachment' },
      { id: 'image', name: 'Image', icon: '🖼️', description: 'Image response' },
      { id: 'poll', name: 'Poll', icon: '📊', description: 'Poll/survey response' },
      { id: 'thread', name: 'Thread', icon: '🧵', description: 'Start a thread' },
      { id: 'modal', name: 'Modal', icon: '🪟', description: 'Modal/form response' }
    ];

    this.triggers = [
      { id: 'help', name: 'Help', patterns: ['help', 'commands', 'what can you do'], response: 'list-commands' },
      { id: 'code-review', name: 'Code Review', patterns: ['review', 'check code', 'code review'], response: 'code-review' },
      { id: 'explain', name: 'Explain', patterns: ['explain', 'what does', 'how does'], response: 'explain-code' },
      { id: 'debug', name: 'Debug', patterns: ['debug', 'fix', 'error', 'bug'], response: 'debug-help' },
      { id: 'translate', name: 'Translate', patterns: ['translate', 'convert to'], response: 'translate-code' },
      { id: 'summarize', name: 'Summarize', patterns: ['summarize', 'summary', 'tldr'], response: 'summarize' },
      { id: 'research', name: 'Research', patterns: ['research', 'look up', 'find info'], response: 'research' },
      { id: 'todo', name: 'Todo', patterns: ['todo', 'task', 'reminder'], response: 'manage-todo' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Teams/Discord Bot Mode Engine...');
    this.loadSettings();
    this.logger.info('Teams/Discord Bot Mode Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: false, defaultPlatform: 'discord', botToken: '', webhookUrl: '', prefix: '!', mentionName: 'Pix', responsesEnabled: true, moderationEnabled: false, loggingEnabled: true, maxConcurrentResponses: 5 };
  }

  createBot(params) {
    const { name, platform = 'discord', mode = 'standalone', token = '', channels = [] } = params;
    const id = uuidv4();
    const bot = { id, name, platform, mode, token, channels, status: 'offline', commands: [], messageCount: 0, uptime: 0, createdAt: new Date().toISOString() };
    this.bots.set(id, bot);
    return bot;
  }

  async startBot(botId) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error('Bot not found');
    bot.status = 'online';
    bot.startedAt = new Date().toISOString();
    this.bots.set(botId, bot);
    return bot;
  }

  async stopBot(botId) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error('Bot not found');
    bot.status = 'offline';
    bot.stoppedAt = new Date().toISOString();
    this.bots.set(botId, bot);
    return bot;
  }

  async processMessage(botId, message) {
    const bot = this.bots.get(botId);
    if (!bot) throw new Error('Bot not found');
    bot.messageCount++;
    this.bots.set(botId, bot);

    const matchedTrigger = this.triggers.find(t => t.patterns.some(p => message.content.toLowerCase().includes(p)));
    if (matchedTrigger) {
      return { trigger: matchedTrigger.id, response: `Triggered: ${matchedTrigger.name}`, messageType: 'text' };
    }

    return { trigger: null, response: `Received: "${message.content.slice(0, 50)}..."`, messageType: 'text' };
  }

  createCommand(params) {
    const { name, description, platform, response = '', permissions = [], cooldown = 0 } = params;
    const id = uuidv4();
    const command = { id, name, description, platform, response, permissions, cooldown, usageCount: 0, enabled: true, createdAt: new Date().toISOString() };
    this.commands.set(id, command);
    return command;
  }

  getBot(id) { return this.bots.get(id); }
  listBots() { return Array.from(this.bots.values()); }
  getPlatforms() { return this.platforms; }
  getBotModes() { return this.botModes; }
  getCommandTypes() { return this.commandTypes; }
  getResponseTypes() { return this.responseTypes; }
  getTriggers() { return this.triggers; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    const bots = Array.from(this.bots.values());
    return { bots: bots.length, online: bots.filter(b => b.status === 'online').length, totalMessages: bots.reduce((sum, b) => sum + b.messageCount, 0), platforms: this.platforms.length, commands: this.commands.size };
  }
}

module.exports = TeamsDiscordBotEngine;
