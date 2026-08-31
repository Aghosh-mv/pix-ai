const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class SmartAPIKeyManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.keys = new Map();
    this.keyGroups = new Map();
    this.usageLogs = new Map();
    this.apiDir = path.join(os.homedir(), '.pix/apikeys');

    this.algorithm = 'aes-256-gcm';
    this.encryptionKey = this.getOrCreateEncryptionKey();

    this.providers = [
      { id: 'gemini', name: 'Google Gemini', icon: '🌟', envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], models: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
      { id: 'groq', name: 'Groq', icon: '⚡', envVars: ['GROQ_API_KEY'], models: ['mixtral-8x7b', 'llama2-70b', 'gemma-7b'] },
      { id: 'openrouter', name: 'OpenRouter', icon: '🔀', envVars: ['OPENROUTER_API_KEY'], models: ['claude-3-opus', 'gpt-4', 'llama-3-70b'] },
      { id: 'zai', name: 'Z AI', icon: '🤖', envVars: ['ZAI_API_KEY'], models: ['zai-7b', 'zai-13b'] },
      { id: 'serp', name: 'SERP API', icon: '🔍', envVars: ['SERP_API_KEY'], models: ['serp-search'] },
      { id: 'openai', name: 'OpenAI', icon: '🧠', envVars: ['OPENAI_API_KEY'], models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
      { id: 'anthropic', name: 'Anthropic', icon: '🤖', envVars: ['ANTHROPIC_API_KEY'], models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
      { id: 'huggingface', name: 'Hugging Face', icon: '🤗', envVars: ['HUGGINGFACE_API_KEY'], models: ['llama-2-70b', 'mistral-7b', 'phi-2'] },
      { id: 'cohere', name: 'Cohere', icon: '🔮', envVars: ['COHERE_API_KEY'], models: ['command-r-plus', 'command-r'] },
      { id: 'replicate', name: 'Replicate', icon: '🔁', envVars: ['REPLICATE_API_TOKEN'], models: ['llama-2-70b', 'stable-diffusion'] },
      { id: 'aws', name: 'AWS Bedrock', icon: '☁️', envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'], models: ['claude-3-opus', 'titan-text'] },
      { id: 'azure', name: 'Azure OpenAI', icon: '🔷', envVars: ['AZURE_OPENAI_API_KEY'], models: ['gpt-4', 'gpt-35-turbo'] }
    ];

    this.keyUsagePurposes = [
      { id: 'personal', name: 'Personal Use', icon: '👤', description: 'Your own API keys for personal projects' },
      { id: 'project', name: 'Project Use', icon: '📂', description: 'Keys assigned to specific projects' },
      { id: 'shared', name: 'Shared', icon: '👥', description: 'Keys shared with team members' },
      { id: 'testing', name: 'Testing', icon: '🧪', description: 'Keys for testing and development' },
      { id: 'production', name: 'Production', icon: '🚀', description: 'Keys for production deployments' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Smart API Key Manager...');
    await fs.ensureDir(this.apiDir);
    await this.loadData();
    this.loadFromEnvironment();
    this.logger.info('Smart API Key Manager initialized');
  }

  getOrCreateEncryptionKey() {
    const keyPath = path.join(os.homedir(), '.pix', '. encryption_key');
    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath);
      }
    } catch (e) {}

    const newKey = crypto.randomBytes(32);
    try {
      fs.mkdirSync(path.dirname(keyPath), { recursive: true });
      fs.writeFileSync(keyPath, newKey);
    } catch (e) {}

    return newKey;
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText) {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.apiDir);
      for (const file of files) {
        if (file.endsWith('.json') && !file.startsWith('.')) {
          const data = await fs.readJson(path.join(this.apiDir, file));
          if (data.type === 'key') {
            try {
              data.value = this.decrypt(data.encryptedValue);
            } catch (e) {
              data.value = null;
            }
            this.keys.set(data.id, data);
          }
          else if (data.type === 'group') this.keyGroups.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadFromEnvironment() {
    for (const provider of this.providers) {
      for (const envVar of provider.envVars) {
        const value = process.env[envVar];
        if (value) {
          const existing = Array.from(this.keys.values()).find(
            k => k.provider === provider.id && k.envVar === envVar
          );
          if (!existing) {
            this.addKey({
              name: `${provider.name} (${envVar})`,
              provider: provider.id,
              value,
              envVar,
              purpose: 'personal',
              source: 'environment',
              autoDetected: true
            });
          }
        }
      }
    }
  }

  async addKey(params) {
    const {
      name,
      provider,
      value,
      envVar = null,
      purpose = 'personal',
      projectId = null,
      source = 'manual',
      autoDetected = false,
      models = [],
      rateLimit = null,
      expiresAt = null,
      tags = []
    } = params;

    const id = uuidv4();
    const encryptedValue = this.encrypt(value);

    const key = {
      id,
      name,
      provider,
      envVar,
      encryptedValue,
      value: null,
      purpose,
      projectId,
      source,
      autoDetected,
      models,
      rateLimit,
      expiresAt,
      tags,
      status: 'active',
      lastUsed: null,
      usageCount: 0,
      totalTokens: 0,
      estimatedCost: 0,
      type: 'key',
      createdAt: new Date().toISOString()
    };

    this.keys.set(id, key);
    await this.saveKey(key);

    return { ...key, value: this.maskKey(value) };
  }

  maskKey(value) {
    if (!value || value.length < 8) return '****';
    return value.substring(0, 4) + '****' + value.substring(value.length - 4);
  }

  async getKey(id) {
    const key = this.keys.get(id);
    if (!key) throw new Error(`Key not found: ${id}`);
    return { ...key, value: key.value || this.decrypt(key.encryptedValue) };
  }

  async getKeyForUse(id) {
    const key = await this.getKey(id);
    key.lastUsed = new Date().toISOString();
    key.usageCount++;
    this.keys.set(id, key);
    await this.saveKey(key);
    return key.value;
  }

  async updateKey(id, updates) {
    const key = this.keys.get(id);
    if (!key) throw new Error(`Key not found: ${id}`);

    if (updates.value) {
      updates.encryptedValue = this.encrypt(updates.value);
      updates.value = null;
    }

    const updated = { ...key, ...updates, id };
    this.keys.set(id, updated);
    await this.saveKey(updated);

    return { ...updated, value: updated.value || this.maskKey(this.decrypt(updated.encryptedValue)) };
  }

  async deleteKey(id) {
    this.keys.delete(id);
    await fs.remove(path.join(this.apiDir, `key-${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getKeyForTask(params) {
    const { provider, task, projectId = null, purpose = 'personal' } = params;

    let candidates = Array.from(this.keys.values()).filter(k =>
      k.status === 'active' &&
      (!provider || k.provider === provider) &&
      (!projectId || !k.projectId || k.projectId === projectId)
    );

    if (purpose === 'project' && projectId) {
      const projectKeys = candidates.filter(k => k.projectId === projectId);
      if (projectKeys.length > 0) candidates = projectKeys;
    }

    if (purpose === 'personal') {
      const personalKeys = candidates.filter(k => k.purpose === 'personal');
      if (personalKeys.length > 0) candidates = personalKeys;
    }

    candidates = candidates.filter(k => {
      if (k.expiresAt && new Date(k.expiresAt) < new Date()) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      if (a.usageCount < b.usageCount) return -1;
      if (a.usageCount > b.usageCount) return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    const selected = candidates[0];
    return this.getKey(selected.id);
  }

  async listKeys(options = {}) {
    const { provider, purpose, projectId, status } = options;
    let keys = Array.from(this.keys.values());

    if (provider) keys = keys.filter(k => k.provider === provider);
    if (purpose) keys = keys.filter(k => k.purpose === purpose);
    if (projectId) keys = keys.filter(k => k.projectId === projectId);
    if (status) keys = keys.filter(k => k.status === status);

    return keys.map(k => ({
      ...k,
      value: this.maskKey(k.value || this.decrypt(k.encryptedValue))
    }));
  }

  async createGroup(params) {
    const { name, description = '', keyIds = [], purpose = 'shared' } = params;

    const id = uuidv4();
    const group = {
      id,
      name,
      description,
      keyIds,
      purpose,
      status: 'active',
      type: 'group',
      createdAt: new Date().toISOString()
    };

    this.keyGroups.set(id, group);
    await this.saveGroup(group);

    return group;
  }

  async addToGroup(groupId, keyId) {
    const group = this.keyGroups.get(groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);

    if (!group.keyIds.includes(keyId)) {
      group.keyIds.push(keyId);
      this.keyGroups.set(groupId, group);
      await this.saveGroup(group);
    }

    return group;
  }

  async removeFromGroup(groupId, keyId) {
    const group = this.keyGroups.get(groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);

    group.keyIds = group.keyIds.filter(id => id !== keyId);
    this.keyGroups.set(groupId, group);
    await this.saveGroup(group);

    return group;
  }

  async logUsage(params) {
    const { keyId, tokens = 0, cost = 0, model, success = true } = params;

    const logId = uuidv4();
    const log = {
      id: logId,
      keyId,
      tokens,
      cost,
      model,
      success,
      timestamp: new Date().toISOString()
    };

    this.usageLogs.set(logId, log);

    const key = this.keys.get(keyId);
    if (key) {
      key.totalTokens += tokens;
      key.estimatedCost += cost;
      this.keys.set(keyId, key);
      await this.saveKey(key);
    }

    return log;
  }

  async getUsageStats(keyId = null) {
    let logs = Array.from(this.usageLogs.values());

    if (keyId) {
      logs = logs.filter(l => l.keyId === keyId);
    }

    const totalTokens = logs.reduce((sum, l) => sum + l.tokens, 0);
    const totalCost = logs.reduce((sum, l) => sum + l.cost, 0);
    const successfulRequests = logs.filter(l => l.success).length;
    const failedRequests = logs.filter(l => !l.success).length;

    const byProvider = {};
    for (const log of logs) {
      const key = this.keys.get(log.keyId);
      if (key) {
        if (!byProvider[key.provider]) byProvider[key.provider] = { tokens: 0, cost: 0, requests: 0 };
        byProvider[key.provider].tokens += log.tokens;
        byProvider[key.provider].cost += log.cost;
        byProvider[key.provider].requests++;
      }
    }

    return {
      totalTokens,
      totalCost,
      totalRequests: logs.length,
      successfulRequests,
      failedRequests,
      successRate: logs.length > 0 ? Math.round((successfulRequests / logs.length) * 100) : 0,
      byProvider
    };
  }

  async getProviders() {
    return this.providers;
  }

  async getPurposes() {
    return this.keyUsagePurposes;
  }

  async getStats() {
    const keys = Array.from(this.keys.values());
    const groups = Array.from(this.keyGroups.values());

    return {
      keys: keys.length,
      activeKeys: keys.filter(k => k.status === 'active').length,
      groups: groups.length,
      providers: this.providers.length,
      totalTokens: keys.reduce((sum, k) => sum + k.totalTokens, 0),
      totalCost: keys.reduce((sum, k) => sum + k.estimatedCost, 0)
    };
  }

  async saveKey(key) {
    const saveData = { ...key };
    saveData.encryptedValue = this.encrypt(key.value || this.decrypt(key.encryptedValue));
    saveData.value = null;

    const filePath = path.join(this.apiDir, `key-${key.id}.json`);
    await fs.writeJson(filePath, saveData, { spaces: 2 });
  }

  async saveGroup(group) {
    const filePath = path.join(this.apiDir, `group-${group.id}.json`);
    await fs.writeJson(filePath, group, { spaces: 2 });
  }

  async exportKeys(format = 'json') {
    const keys = Array.from(this.keys.values()).map(k => ({
      ...k,
      value: this.maskKey(k.value || this.decrypt(k.encryptedValue))
    }));

    const data = {
      keys,
      groups: Array.from(this.keyGroups.values()),
      providers: this.providers,
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = SmartAPIKeyManager;
