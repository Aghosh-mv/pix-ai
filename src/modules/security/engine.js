const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class SecurityEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.auditLog = [];
    this.permissions = new Map();
    this.apiKeys = new Map();
    this.secrets = new Map();
    this.encryptionKey = null;
    this.securityDir = path.join(os.homedir(), '.pix/security');
    this.auditFile = path.join(this.securityDir, 'audit.json');
    this.permissionsFile = path.join(this.securityDir, 'permissions.json');
  }

  async initialize() {
    this.logger.info('Initializing Security Engine...');
    await fs.ensureDir(this.securityDir);
    await this.loadAuditLog();
    await this.loadPermissions();
    await this.generateEncryptionKey();
    this.logger.info('Security Engine initialized');
  }

  async generateEncryptionKey() {
    this.encryptionKey = crypto.randomBytes(32).toString('hex');
  }

  async loadAuditLog() {
    try {
      if (await fs.pathExists(this.auditFile)) {
        this.auditLog = await fs.readJson(this.auditFile);
      }
    } catch (e) {
      this.auditLog = [];
    }
  }

  async saveAuditLog() {
    await fs.writeJson(this.auditFile, this.auditLog, { spaces: 2 });
  }

  async loadPermissions() {
    try {
      if (await fs.pathExists(this.permissionsFile)) {
        const data = await fs.readJson(this.permissionsFile);
        this.permissions = new Map(Object.entries(data));
      }
    } catch (e) {
      this.permissions = new Map();
    }
  }

  async savePermissions() {
    await fs.writeJson(this.permissionsFile, Object.fromEntries(this.permissions), { spaces: 2 });
  }

  async logAudit(action, details, user = 'system', status = 'success') {
    const entry = {
      id: uuidv4(),
      action,
      details,
      user,
      status,
      timestamp: new Date().toISOString(),
      ip: '127.0.0.1'
    };

    this.auditLog.push(entry);

    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }

    await this.saveAuditLog();
    return entry;
  }

  async checkPermission(userId, resource, action) {
    const key = `${userId}:${resource}`;
    const perms = this.permissions.get(key);

    if (!perms) {
      return { allowed: false, reason: 'No permissions defined' };
    }

    if (perms.actions.includes('*') || perms.actions.includes(action)) {
      return { allowed: true };
    }

    return { allowed: false, reason: `Permission denied for ${action} on ${resource}` };
  }

  async grantPermission(userId, resource, actions, expiresAt = null) {
    const key = `${userId}:${resource}`;
    const permission = {
      userId,
      resource,
      actions: Array.isArray(actions) ? actions : [actions],
      grantedAt: new Date().toISOString(),
      expiresAt,
      grantedBy: 'system'
    };

    this.permissions.set(key, permission);
    await this.savePermissions();
    await this.logAudit('permission:grant', { userId, resource, actions });

    return permission;
  }

  async revokePermission(userId, resource) {
    const key = `${userId}:${resource}`;
    this.permissions.delete(key);
    await this.savePermissions();
    await this.logAudit('permission:revoke', { userId, resource });

    return { success: true };
  }

  encrypt(text, key = null) {
    const encryptionKey = key || this.encryptionKey;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      iv: iv.toString('hex'),
      encrypted,
      tag: cipher.getAuthTag?.()?.toString('hex') || ''
    };
  }

  decrypt(encryptedData, key = null) {
    const encryptionKey = key || this.encryptionKey;
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  hash(text, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(text).digest('hex');
  }

  async storeSecret(name, value, description = '') {
    const encrypted = this.encrypt(value);
    this.secrets.set(name, {
      name,
      encrypted,
      description,
      createdAt: new Date().toISOString()
    });

    await this.logAudit('secret:store', { name });
    return { name, stored: true };
  }

  async retrieveSecret(name) {
    const secret = this.secrets.get(name);
    if (!secret) {
      throw new Error(`Secret not found: ${name}`);
    }

    await this.logAudit('secret:retrieve', { name });
    return this.decrypt(secret.encrypted);
  }

  async deleteSecret(name) {
    this.secrets.delete(name);
    await this.logAudit('secret:delete', { name });
    return { success: true };
  }

  async validateInput(input, schema) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = input[field];

      if (rules.required && (value === undefined || value === null)) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rules.type && typeof value !== rules.type) {
        errors.push(`${field} must be of type ${rules.type}`);
      }

      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }

      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} does not match required pattern`);
      }

      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async sanitizeInput(input) {
    if (typeof input === 'string') {
      return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  async scanForVulnerabilities(code) {
    const vulnerabilities = [];
    const patterns = [
      { pattern: /eval\s*\(/g, type: 'code-injection', severity: 'high' },
      { pattern: /exec\s*\(/g, type: 'command-injection', severity: 'high' },
      { pattern: /innerHTML\s*=/g, type: 'xss', severity: 'medium' },
      { pattern: /document\.write\s*\(/g, type: 'xss', severity: 'medium' },
      { pattern: /password\s*=\s*['"][^'"]+['"]/g, type: 'hardcoded-credential', severity: 'high' },
      { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/g, type: 'hardcoded-api-key', severity: 'high' },
      { pattern: /SELECT\s+\*\s+FROM/gi, type: 'sql-injection-risk', severity: 'medium' },
      { pattern: /http:\/\//g, type: 'insecure-http', severity: 'low' },
      { pattern: /console\.log\s*\(/g, type: 'debug-log', severity: 'info' },
      { pattern: /TODO|FIXME|HACK|XXX/g, type: 'code-smell', severity: 'info' }
    ];

    for (const { pattern, type, severity } of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        vulnerabilities.push({
          type,
          severity,
          count: matches.length,
          message: `Found ${matches.length} instance(s) of ${type}`
        });
      }
    }

    return {
      scanned: true,
      vulnerabilities,
      score: Math.max(0, 100 - vulnerabilities.reduce((sum, v) => {
        switch (v.severity) {
          case 'high': return sum + 25;
          case 'medium': return sum + 15;
          case 'low': return sum + 5;
          default: return sum;
        }
      }, 0))
    };
  }

  async getAuditLog(options = {}) {
    const { limit = 100, offset = 0, action = null, user = null } = options;

    let log = [...this.auditLog];

    if (action) {
      log = log.filter(e => e.action.includes(action));
    }

    if (user) {
      log = log.filter(e => e.user === user);
    }

    log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      entries: log.slice(offset, offset + limit),
      total: log.length
    };
  }

  getPermissions() {
    return Array.from(this.permissions.values());
  }

  getSecurityStats() {
    return {
      auditEntries: this.auditLog.length,
      permissions: this.permissions.size,
      secrets: this.secrets.size,
      lastAudit: this.auditLog[this.auditLog.length - 1]?.timestamp || null
    };
  }
}

module.exports = SecurityEngine;
