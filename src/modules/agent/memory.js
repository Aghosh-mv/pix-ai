const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MemoryContextEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.memories = new Map();
    this.contexts = new Map();
    this.conversations = new Map();
    this.knowledge = new Map();
    this.memoryDir = path.join(os.homedir(), '.pix/memory');
    this.maxMemories = 10000;
  }

  async initialize() {
    this.logger.info('Initializing Memory & Context Engine...');
    await fs.ensureDir(this.memoryDir);
    await this.loadMemories();
    this.loadCategories();
    this.loadImportanceLevels();
    this.logger.info('Memory & Context Engine initialized');
  }

  async loadMemories() {
    try {
      const files = await fs.readdir(this.memoryDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.memoryDir, file));
          if (data.type === 'memory') this.memories.set(data.id, data);
          else if (data.type === 'context') this.contexts.set(data.id, data);
          else if (data.type === 'conversation') this.conversations.set(data.id, data);
          else if (data.type === 'knowledge') this.knowledge.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadCategories() {
    this.categories = [
      { id: 'interaction', name: 'User Interaction', icon: '💬', description: 'User commands and responses' },
      { id: 'code', name: 'Code', icon: '💻', description: 'Code snippets and solutions' },
      { id: 'error', name: 'Error', icon: '❌', description: 'Errors and their solutions' },
      { id: 'preference', name: 'Preference', icon: '⚙️', description: 'User preferences and settings' },
      { id: 'project', name: 'Project', icon: '📂', description: 'Project-related information' },
      { id: 'learning', name: 'Learning', icon: '📚', description: 'Learned patterns and knowledge' },
      { id: 'context', name: 'Context', icon: '🔗', description: 'Contextual information' },
      { id: 'task', name: 'Task', icon: '✅', description: 'Task-related memories' },
      { id: 'tool', name: 'Tool', icon: '🔧', description: 'Tool usage and configuration' },
      { id: 'creative', name: 'Creative', icon: '🎨', description: 'Creative ideas and solutions' }
    ];
  }

  loadImportanceLevels() {
    this.importanceLevels = [
      { id: 'critical', name: 'Critical', icon: '🔴', weight: 10, retention: 'permanent' },
      { id: 'high', name: 'High', icon: '🟠', weight: 7, retention: 'long-term' },
      { id: 'medium', name: 'Medium', icon: '🟡', weight: 5, retention: 'medium-term' },
      { id: 'low', name: 'Low', icon: '🟢', weight: 3, retention: 'short-term' },
      { id: 'temporary', name: 'Temporary', icon: '⚪', weight: 1, retention: 'session' }
    ];
  }

  async createMemory(params) {
    const {
      content,
      category = 'interaction',
      importance = 'medium',
      tags = [],
      source = null,
      context = {},
      relatedMemories = [],
      ttl = null,
      metadata = {}
    } = params;

    const id = uuidv4();
    const memory = {
      id,
      content,
      category,
      importance,
      tags,
      source,
      context,
      relatedMemories,
      ttl,
      metadata,
      accessCount: 0,
      lastAccessed: null,
      decay: 0,
      consolidated: false,
      type: 'memory',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.memories.set(id, memory);

    if (this.memories.size > this.maxMemories) {
      await this.consolidateMemories();
    }

    await this.saveMemory(memory);
    return memory;
  }

  async getMemory(id) {
    const memory = this.memories.get(id);
    if (!memory) throw new Error(`Memory not found: ${id}`);

    memory.accessCount++;
    memory.lastAccessed = new Date().toISOString();
    this.memories.set(id, memory);

    return memory;
  }

  async updateMemory(id, updates) {
    const memory = this.memories.get(id);
    if (!memory) throw new Error(`Memory not found: ${id}`);

    const updated = {
      ...memory,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.memories.set(id, updated);
    await this.saveMemory(updated);
    return updated;
  }

  async deleteMemory(id) {
    this.memories.delete(id);
    await fs.remove(path.join(this.memoryDir, `memory-${id}.json`)).catch(() => {});
    return { success: true };
  }

  async searchMemories(query, options = {}) {
    const { category, importance, tags, limit = 50, minScore = 0 } = options;
    const queryLower = query.toLowerCase();
    const results = [];

    for (const [, memory] of this.memories) {
      if (category && memory.category !== category) continue;
      if (importance && memory.importance !== importance) continue;
      if (tags && !tags.some(t => memory.tags.includes(t))) continue;

      if (memory.ttl) {
        const createdAt = new Date(memory.createdAt);
        const now = new Date();
        if (now - createdAt > memory.ttl) continue;
      }

      let score = 0;
      const contentLower = memory.content.toLowerCase();

      if (contentLower.includes(queryLower)) {
        score += 10;
        const matches = contentLower.split(queryLower).length - 1;
        score += matches * 2;
      }

      if (memory.tags.some(t => t.toLowerCase().includes(queryLower))) {
        score += 5;
      }

      if (memory.category.includes(queryLower)) {
        score += 3;
      }

      const importanceWeight = this.importanceLevels.find(l => l.id === memory.importance)?.weight || 5;
      score *= importanceWeight / 5;

      if (memory.accessCount > 0) {
        score += Math.min(memory.accessCount, 5);
      }

      if (score > minScore) {
        results.push({ ...memory, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getContextMemories(contextId, limit = 20) {
    const results = [];

    for (const [, memory] of this.memories) {
      if (memory.context && memory.context.sessionId === contextId) {
        results.push(memory);
      }
    }

    return results
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async getRecentMemories(limit = 50) {
    return Array.from(this.memories.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async getFrequentMemories(limit = 50) {
    return Array.from(this.memories.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  async createConversation(params) {
    const { title, participants = ['user', 'pix'], metadata = {} } = params;

    const id = uuidv4();
    const conversation = {
      id,
      title,
      participants,
      messages: [],
      metadata,
      status: 'active',
      type: 'conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.conversations.set(id, conversation);
    await this.saveConversation(conversation);
    return conversation;
  }

  async addMessage(conversationId, message) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) throw new Error(`Conversation not found: ${conversationId}`);

    const msg = {
      id: uuidv4(),
      ...message,
      timestamp: new Date().toISOString()
    };

    conversation.messages.push(msg);
    conversation.updatedAt = new Date().toISOString();

    await this.conversations.set(conversationId, conversation);
    await this.saveConversation(conversation);

    return msg;
  }

  async getConversation(id) {
    return this.conversations.get(id);
  }

  async listConversations(options = {}) {
    const { status, search } = options;
    let conversations = Array.from(this.conversations.values());

    if (status) conversations = conversations.filter(c => c.status === status);
    if (search) {
      const searchLower = search.toLowerCase();
      conversations = conversations.filter(c =>
        c.title.toLowerCase().includes(searchLower) ||
        c.messages.some(m => m.content?.toLowerCase().includes(searchLower))
      );
    }

    return conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async createContext(params) {
    const { name, sessionId, scope = 'global', data = {} } = params;

    const id = uuidv4();
    const context = {
      id,
      name,
      sessionId,
      scope,
      data,
      memories: [],
      status: 'active',
      type: 'context',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.contexts.set(id, context);
    await this.saveContext(context);
    return context;
  }

  async updateContext(id, updates) {
    const context = this.contexts.get(id);
    if (!context) throw new Error(`Context not found: ${id}`);

    const updated = {
      ...context,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.contexts.set(id, updated);
    await this.saveContext(updated);
    return updated;
  }

  async getContext(id) {
    return this.contexts.get(id);
  }

  async addMemoryToContext(contextId, memoryId) {
    const context = this.contexts.get(contextId);
    if (!context) throw new Error(`Context not found: ${contextId}`);

    if (!context.memories.includes(memoryId)) {
      context.memories.push(memoryId);
      context.updatedAt = new Date().toISOString();
      this.contexts.set(contextId, context);
      await this.saveContext(context);
    }

    return context;
  }

  async createKnowledge(params) {
    const { topic, content, source = null, confidence = 0.5, related = [] } = params;

    const id = uuidv4();
    const knowledge = {
      id,
      topic,
      content,
      source,
      confidence,
      related,
      verified: false,
      accessCount: 0,
      type: 'knowledge',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.knowledge.set(id, knowledge);
    await this.saveKnowledge(knowledge);
    return knowledge;
  }

  async updateKnowledge(id, updates) {
    const knowledge = this.knowledge.get(id);
    if (!knowledge) throw new Error(`Knowledge not found: ${id}`);

    const updated = {
      ...knowledge,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.knowledge.set(id, updated);
    await this.saveKnowledge(updated);
    return updated;
  }

  async searchKnowledge(query) {
    const queryLower = query.toLowerCase();
    const results = [];

    for (const [, knowledge] of this.knowledge) {
      let score = 0;

      if (knowledge.topic.toLowerCase().includes(queryLower)) score += 10;
      if (knowledge.content.toLowerCase().includes(queryLower)) score += 5;

      if (knowledge.verified) score *= 1.5;

      if (score > 0) {
        knowledge.accessCount++;
        results.push({ ...knowledge, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async consolidateMemories() {
    const memories = Array.from(this.memories.values());
    const now = new Date();

    for (const memory of memories) {
      const createdAt = new Date(memory.createdAt);
      const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);

      if (memory.importance === 'temporary' && daysSinceCreation > 1) {
        this.memories.delete(memory.id);
      } else if (memory.importance === 'low' && daysSinceCreation > 7) {
        memory.decay += 0.1;
        if (memory.decay >= 1) {
          this.memories.delete(memory.id);
        }
      } else if (memory.accessCount === 0 && daysSinceCreation > 30) {
        memory.decay += 0.05;
      }
    }
  }

  async getRelatedMemories(memoryId, limit = 10) {
    const memory = this.memories.get(memoryId);
    if (!memory) throw new Error(`Memory not found: ${memoryId}`);

    const related = [];

    for (const [, other] of this.memories) {
      if (other.id === memoryId) continue;

      let score = 0;

      if (memory.category === other.category) score += 3;
      if (memory.tags.some(t => other.tags.includes(t))) score += 5;
      if (memory.context && other.context && memory.context.sessionId === other.context.sessionId) {
        score += 2;
      }

      const contentWords = memory.content.toLowerCase().split(/\s+/);
      const otherWords = other.content.toLowerCase().split(/\s+/);
      const commonWords = contentWords.filter(w => otherWords.includes(w) && w.length > 3);
      score += commonWords.length;

      if (score > 0) {
        related.push({ ...other, score });
      }
    }

    return related
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getMemoryStats() {
    const memories = Array.from(this.memories.values());
    const conversations = Array.from(this.conversations.values());
    const knowledge = Array.from(this.knowledge.values());

    const byCategory = {};
    for (const category of this.categories) {
      byCategory[category.id] = memories.filter(m => m.category === category.id).length;
    }

    const byImportance = {};
    for (const level of this.importanceLevels) {
      byImportance[level.id] = memories.filter(m => m.importance === level.id).length;
    }

    return {
      memories: memories.length,
      conversations: conversations.length,
      knowledge: knowledge.length,
      contexts: this.contexts.size,
      byCategory,
      byImportance,
      averageAccessCount: memories.length > 0
        ? Math.round(memories.reduce((sum, m) => sum + m.accessCount, 0) / memories.length)
        : 0
    };
  }

  getCategories() {
    return this.categories;
  }

  getImportanceLevels() {
    return this.importanceLevels;
  }

  async saveMemory(memory) {
    const filePath = path.join(this.memoryDir, `memory-${memory.id}.json`);
    await fs.writeJson(filePath, memory, { spaces: 2 });
  }

  async saveConversation(conversation) {
    const filePath = path.join(this.memoryDir, `conversation-${conversation.id}.json`);
    await fs.writeJson(filePath, conversation, { spaces: 2 });
  }

  async saveContext(context) {
    const filePath = path.join(this.memoryDir, `context-${context.id}.json`);
    await fs.writeJson(filePath, context, { spaces: 2 });
  }

  async saveKnowledge(knowledge) {
    const filePath = path.join(this.memoryDir, `knowledge-${knowledge.id}.json`);
    await fs.writeJson(filePath, knowledge, { spaces: 2 });
  }

  async exportMemory(format = 'json') {
    const data = {
      memories: Array.from(this.memories.values()),
      conversations: Array.from(this.conversations.values()),
      contexts: Array.from(this.contexts.values()),
      knowledge: Array.from(this.knowledge.values()),
      stats: await this.getMemoryStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = MemoryContextEngine;
