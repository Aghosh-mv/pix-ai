const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class PasswordEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.passwords = new Map();
    this.folders = new Map();
    this.passwordDir = path.join(os.homedir(), '.pix/passwords');
  }

  async initialize() {
    this.logger.info('Initializing Password Engine...');
    await fs.ensureDir(this.passwordDir);
    await this.loadPasswords();
    this.loadCategories();
    this.logger.info('Password Engine initialized');
  }

  async loadPasswords() {
    try {
      const files = await fs.readdir(this.passwordDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.passwordDir, file));
          if (data.type === 'password') this.passwords.set(data.id, data);
          else if (data.type === 'folder') this.folders.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadCategories() {
    this.categories = [
      { id: 'social', name: 'Social Media', icon: '📱', color: '#E91E63' },
      { id: 'email', name: 'Email', icon: '📧', color: '#2196F3' },
      { id: 'banking', name: 'Banking', icon: '🏦', color: '#4CAF50' },
      { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#FF9800' },
      { id: 'work', name: 'Work', icon: '💼', color: '#9C27B0' },
      { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#F44336' },
      { id: 'other', name: 'Other', icon: '🔑', color: '#607D8B' }
    ];
  }

  async createPassword(params) {
    const {
      title,
      username = '',
      password,
      url = '',
      category = 'other',
      notes = '',
      tags = [],
      strength = 'medium'
    } = params;

    const id = uuidv4();
    const entry = {
      id,
      title,
      username,
      password: this.encrypt(password),
      url,
      category,
      notes,
      tags,
      strength,
      lastUsed: null,
      lastChanged: new Date().toISOString(),
      favorites: false,
      type: 'password',
      createdAt: new Date().toISOString()
    };

    this.passwords.set(id, entry);
    return { ...entry, password: '••••••••' };
  }

  async updatePassword(id, updates) {
    const entry = this.passwords.get(id);
    if (!entry) throw new Error(`Password not found: ${id}`);

    const updated = { ...entry, ...updates };
    if (updates.password) {
      updated.password = this.encrypt(updates.password);
      updated.lastChanged = new Date().toISOString();
    }

    this.passwords.set(id, updated);
    return { ...updated, password: '••••••••' };
  }

  async deletePassword(id) {
    this.passwords.delete(id);
    return { success: true };
  }

  async getPassword(id) {
    const entry = this.passwords.get(id);
    if (!entry) throw new Error(`Password not found: ${id}`);

    entry.lastUsed = new Date().toISOString();
    this.passwords.set(id, entry);

    return { ...entry, password: this.decrypt(entry.password) };
  }

  listPasswords(options = {}) {
    const { category, folderId, favorites, search } = options;
    let passwords = Array.from(this.passwords.values());

    if (category) passwords = passwords.filter(p => p.category === category);
    if (folderId) passwords = passwords.filter(p => p.folderId === folderId);
    if (favorites !== undefined) passwords = passwords.filter(p => p.favorites === favorites);
    if (search) {
      const searchLower = search.toLowerCase();
      passwords = passwords.filter(p =>
        p.title.toLowerCase().includes(searchLower) ||
        p.username.toLowerCase().includes(searchLower) ||
        p.url.toLowerCase().includes(searchLower)
      );
    }

    return passwords.map(p => ({ ...p, password: '••••••••' }));
  }

  async toggleFavorite(id) {
    const entry = this.passwords.get(id);
    if (!entry) throw new Error(`Password not found: ${id}`);

    entry.favorites = !entry.favorites;
    this.passwords.set(id, entry);
    return { ...entry, password: '••••••••' };
  }

  async createFolder(params) {
    const { name, icon = '📁', color = '#2196F3' } = params;
    const id = uuidv4();

    const folder = {
      id,
      name,
      icon,
      color,
      type: 'folder',
      createdAt: new Date().toISOString()
    };

    this.folders.set(id, folder);
    return folder;
  }

  async updateFolder(id, updates) {
    const folder = this.folders.get(id);
    if (!folder) throw new Error(`Folder not found: ${id}`);

    const updated = { ...folder, ...updates };
    this.folders.set(id, updated);
    return updated;
  }

  async deleteFolder(id) {
    this.folders.delete(id);
    return { success: true };
  }

  listFolders() {
    return Array.from(this.folders.values());
  }

  generatePassword(options = {}) {
    const {
      length = 16,
      uppercase = true,
      lowercase = true,
      numbers = true,
      symbols = true
    } = options;

    let chars = '';
    if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (numbers) chars += '0123456789';
    if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';

    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return password;
  }

  checkPasswordStrength(password) {
    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    if (score <= 5) return 'strong';
    return 'very-strong';
  }

  encrypt(text) {
    return Buffer.from(text).toString('base64');
  }

  decrypt(text) {
    return Buffer.from(text, 'base64').toString('utf8');
  }

  async searchPasswords(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, entry] of this.passwords) {
      let score = 0;

      if (entry.title.toLowerCase().includes(queryLower)) score += 10;
      if (entry.username.toLowerCase().includes(queryLower)) score += 5;
      if (entry.url.toLowerCase().includes(queryLower)) score += 3;
      if (entry.tags.some(t => t.toLowerCase().includes(queryLower))) score += 2;

      if (score > 0) {
        results.push({ ...entry, password: '••••••••', score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getPasswordStats() {
    const passwords = Array.from(this.passwords.values());

    return {
      total: passwords.length,
      favorites: passwords.filter(p => p.favorites).length,
      weak: passwords.filter(p => p.strength === 'weak').length,
      medium: passwords.filter(p => p.strength === 'medium').length,
      strong: passwords.filter(p => p.strength === 'strong').length,
      veryStrong: passwords.filter(p => p.strength === 'very-strong').length,
      folders: this.folders.size
    };
  }

  async exportPasswords(format = 'json') {
    const data = {
      passwords: Array.from(this.passwords.values()),
      folders: Array.from(this.folders.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = PasswordEngine;
