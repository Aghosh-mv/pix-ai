const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class SessionHistoryEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.conversations = new Map();
    this.tags = new Map();
    this.historyDir = path.join(os.homedir(), '.pix/history');

    this.namingPatterns = [
      { id: 'topic', name: 'Topic-Based', pattern: '{topic} - {summary}', icon: '📌' },
      { id: 'action', name: 'Action-Based', pattern: '{action} {subject}', icon: '⚡' },
      { id: 'date', name: 'Date-Based', pattern: '{date} - {topic}', icon: '📅' },
      { id: 'sequential', name: 'Sequential', pattern: 'Session {number}: {topic}', icon: '🔢' },
      { id: 'ai', name: 'AI Generated', pattern: 'auto', icon: '🤖' }
    ];

    this.sessionTypes = [
      { id: 'chat', name: 'Chat', icon: '💬', color: '#4A90D9' },
      { id: 'coding', name: 'Coding', icon: '💻', color: '#4CAF50' },
      { id: 'research', name: 'Research', icon: '🔬', color: '#FF9800' },
      { id: 'planning', name: 'Planning', icon: '📋', color: '#9C27B0' },
      { id: 'debug', name: 'Debugging', icon: '🐛', color: '#F44336' },
      { id: 'learning', name: 'Learning', icon: '📚', color: '#00BCD4' },
      { id: 'creative', name: 'Creative', icon: '🎨', color: '#E91E63' },
      { id: 'deployment', name: 'Deployment', icon: '🚀', color: '#607D8B' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Session History Engine...');
    await fs.ensureDir(this.historyDir);
    await this.loadData();
    this.loadAutoNameRules();
    this.logger.info('Session History Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.historyDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.historyDir, file));
          if (data.type === 'session') this.sessions.set(data.id, data);
          else if (data.type === 'conversation') this.conversations.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadAutoNameRules() {
    this.autoNameRules = [
      { trigger: 'build', namePattern: 'Building {subject}', priority: 10 },
      { trigger: 'fix', namePattern: 'Fixing {subject}', priority: 10 },
      { trigger: 'create', namePattern: 'Creating {subject}', priority: 9 },
      { trigger: 'implement', namePattern: 'Implementing {subject}', priority: 9 },
      { trigger: 'debug', namePattern: 'Debugging {subject}', priority: 8 },
      { trigger: 'test', namePattern: 'Testing {subject}', priority: 7 },
      { trigger: 'deploy', namePattern: 'Deploying {subject}', priority: 8 },
      { trigger: 'research', namePattern: 'Research: {subject}', priority: 6 },
      { trigger: 'learn', namePattern: 'Learning: {subject}', priority: 5 },
      { trigger: 'plan', namePattern: 'Planning: {subject}', priority: 7 },
      { trigger: 'refactor', namePattern: 'Refactoring {subject}', priority: 6 },
      { trigger: 'optimize', namePattern: 'Optimizing {subject}', priority: 6 },
      { trigger: 'review', namePattern: 'Reviewing {subject}', priority: 5 },
      { trigger: 'document', namePattern: 'Documenting {subject}', priority: 4 }
    ];
  }

  async createSession(params) {
    const {
      title = null,
      type = 'chat',
      context = {},
      parentSessionId = null,
      autoName = true,
      tags = [],
      projectId = null
    } = params;

    const id = uuidv4();
    const sessionType = this.sessionTypes.find(t => t.id === type) || this.sessionTypes[0];

    let titleGenerated = title;
    if (!titleGenerated && autoName) {
      titleGenerated = await this.generateAutoName(context);
    }
    titleGenerated = titleGenerated || `Session ${id.slice(0, 8)}`;

    const session = {
      id,
      title: titleGenerated,
      type,
      typeInfo: sessionType,
      context,
      parentSessionId,
      tags,
      projectId,
      messages: [],
      summary: null,
      keyTopics: [],
      outcomes: [],
      status: 'active',
      starred: false,
      archived: false,
      metrics: {
        messageCount: 0,
        userMessages: 0,
        aiMessages: 0,
        codeSnippets: 0,
        filesModified: 0,
        duration: 0
      },
      type: 'session',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    this.sessions.set(id, session);
    await this.saveSession(session);

    return session;
  }

  async generateAutoName(context) {
    const { input, topic, action, subject } = context;

    if (action && subject) {
      const rule = this.autoNameRules.find(r => r.trigger === action.toLowerCase());
      if (rule) {
        return rule.namePattern.replace('{subject}', subject);
      }
      return `${action.charAt(0).toUpperCase() + action.slice(1)} ${subject}`;
    }

    if (input) {
      const words = input.split(' ').slice(0, 6);
      return words.join(' ') + (input.split(' ').length > 6 ? '...' : '');
    }

    if (topic) {
      return topic;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `Chat ${dateStr} ${timeStr}`;
  }

  async addMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const msg = {
      id: uuidv4(),
      sessionId,
      role: message.role || 'user',
      content: message.content,
      timestamp: new Date().toISOString(),
      metadata: message.metadata || {},
      codeBlocks: this.extractCodeBlocks(message.content),
      attachments: message.attachments || []
    };

    session.messages.push(msg);
    session.metrics.messageCount++;

    if (msg.role === 'user') session.metrics.userMessages++;
    else session.metrics.aiMessages++;

    if (msg.codeBlocks.length > 0) {
      session.metrics.codeSnippets += msg.codeBlocks.length;
    }

    if (!session.title || session.title.startsWith('Session ')) {
      const firstUserMsg = session.messages.find(m => m.role === 'user');
      if (firstUserMsg) {
        session.title = await this.generateAutoName({ input: firstUserMsg.content });
      }
    }

    session.lastActivity = new Date().toISOString();
    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    return msg;
  }

  extractCodeBlocks(content) {
    const blocks = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2],
        index: match.index
      });
    }

    return blocks;
  }

  async generateSummary(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const messages = session.messages;
    const userMessages = messages.filter(m => m.role === 'user');
    const aiMessages = messages.filter(m => m.role === 'assistant');

    const topics = this.extractTopics(messages);
    const keyPoints = this.extractKeyPoints(messages);
    const outcomes = this.extractOutcomes(messages);

    const summary = {
      id: uuidv4(),
      sessionId,
      title: session.title,
      topics,
      keyPoints,
      outcomes,
      messageCount: messages.length,
      duration: messages.length > 0
        ? new Date(messages[messages.length - 1].timestamp) - new Date(messages[0].timestamp)
        : 0,
      codeSnippets: session.metrics.codeSnippets,
      generatedAt: new Date().toISOString()
    };

    session.summary = summary;
    session.keyTopics = topics;
    session.outcomes = outcomes;

    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    return summary;
  }

  extractTopics(messages) {
    const topics = new Set();
    const keywords = [
      'code', 'function', 'class', 'component', 'api', 'database', 'test',
      'bug', 'feature', 'deploy', 'build', 'install', 'config', 'security',
      'performance', 'ui', 'ux', 'design', 'architecture', 'algorithm'
    ];

    for (const msg of messages) {
      const content = msg.content.toLowerCase();
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          topics.add(keyword);
        }
      }
    }

    return Array.from(topics).slice(0, 10);
  }

  extractKeyPoints(messages) {
    const keyPoints = [];

    for (const msg of messages) {
      if (msg.content.includes('**') || msg.content.includes('important') || msg.content.includes('note:')) {
        const sentences = msg.content.split(/[.!?]+/).filter(s => s.trim());
        for (const sentence of sentences) {
          if (sentence.includes('**') || sentence.toLowerCase().includes('important')) {
            keyPoints.push(sentence.trim().substring(0, 200));
          }
        }
      }
    }

    return keyPoints.slice(0, 10);
  }

  extractOutcomes(messages) {
    const outcomes = [];
    const lastMessages = messages.slice(-5);

    for (const msg of lastMessages) {
      if (msg.role === 'assistant') {
        if (msg.content.includes('completed') || msg.content.includes('done') || msg.content.includes('finished')) {
          outcomes.push('Task completed successfully');
        }
        if (msg.content.includes('here is') || msg.content.includes('created')) {
          outcomes.push('Delivered results');
        }
      }
    }

    return outcomes.length > 0 ? outcomes : ['Discussion in progress'];
  }

  async renameSession(sessionId, newTitle) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.title = newTitle;
    session.lastActivity = new Date().toISOString();
    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    return session;
  }

  async addTag(sessionId, tag) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    if (!session.tags.includes(tag)) {
      session.tags.push(tag);
      this.sessions.set(sessionId, session);
      await this.saveSession(session);
    }

    return session;
  }

  async removeTag(sessionId, tag) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.tags = session.tags.filter(t => t !== tag);
    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    return session;
  }

  async starSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.starred = !session.starred;
    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    return session;
  }

  async archiveSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.archived = true;
    session.status = 'archived';
    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    return session;
  }

  async deleteSession(sessionId) {
    this.sessions.delete(sessionId);
    await fs.remove(path.join(this.historyDir, `session-${sessionId}.json`)).catch(() => {});
    return { success: true };
  }

  async getSession(id) {
    return this.sessions.get(id);
  }

  listSessions(options = {}) {
    const { type, status, search, tags, starred, projectId, sort = 'lastActivity', limit = 50 } = options;
    let sessions = Array.from(this.sessions.values());

    if (type) sessions = sessions.filter(s => s.type === type);
    if (status) sessions = sessions.filter(s => s.status === status);
    if (starred !== undefined) sessions = sessions.filter(s => s.starred === starred);
    if (projectId) sessions = sessions.filter(s => s.projectId === projectId);
    if (tags && tags.length > 0) {
      sessions = sessions.filter(s => tags.some(t => s.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      sessions = sessions.filter(s =>
        s.title.toLowerCase().includes(searchLower) ||
        s.messages.some(m => m.content.toLowerCase().includes(searchLower))
      );
    }

    return sessions
      .sort((a, b) => new Date(b[sort]) - new Date(a[sort]))
      .slice(0, limit);
  }

  async searchSessions(query) {
    const queryLower = query.toLowerCase();
    const results = [];

    for (const [, session] of this.sessions) {
      let score = 0;

      if (session.title.toLowerCase().includes(queryLower)) score += 10;

      const matchingMessages = session.messages.filter(m =>
        m.content.toLowerCase().includes(queryLower)
      ).length;
      score += matchingMessages * 2;

      if (session.tags.some(t => t.toLowerCase().includes(queryLower))) score += 5;

      if (score > 0) {
        results.push({ ...session, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getRecentActivity(limit = 20) {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'active')
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
      .slice(0, limit)
      .map(s => ({
        id: s.id,
        title: s.title,
        type: s.type,
        lastActivity: s.lastActivity,
        messageCount: s.metrics.messageCount
      }));
  }

  async getStats() {
    const sessions = Array.from(this.sessions.values());
    const totalMessages = sessions.reduce((sum, s) => sum + s.metrics.messageCount, 0);
    const totalCodeSnippets = sessions.reduce((sum, s) => sum + s.metrics.codeSnippets, 0);

    const byType = {};
    for (const type of this.sessionTypes) {
      byType[type.id] = sessions.filter(s => s.type === type.id).length;
    }

    const allTags = new Set();
    sessions.forEach(s => s.tags.forEach(t => allTags.add(t)));

    return {
      sessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      archivedSessions: sessions.filter(s => s.archived).length,
      starredSessions: sessions.filter(s => s.starred).length,
      totalMessages,
      totalCodeSnippets,
      byType,
      uniqueTags: allTags.size,
      averageMessagesPerSession: sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0
    };
  }

  getSessionTypes() {
    return this.sessionTypes;
  }

  getNamingPatterns() {
    return this.namingPatterns;
  }

  async saveSession(session) {
    const filePath = path.join(this.historyDir, `session-${session.id}.json`);
    await fs.writeJson(filePath, session, { spaces: 2 });
  }

  async exportHistory(format = 'json') {
    const data = {
      sessions: Array.from(this.sessions.values()),
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = SessionHistoryEngine;
