const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class SnippetEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.snippets = new Map();
    this.folders = new Map();
    this.snippetDir = path.join(os.homedir(), '.pix/snippets');
  }

  async initialize() {
    this.logger.info('Initializing Snippet Engine...');
    await fs.ensureDir(this.snippetDir);
    await this.loadSnippets();
    this.loadLanguages();
    this.loadDefaultFolders();
    this.logger.info('Snippet Engine initialized');
  }

  async loadSnippets() {
    try {
      const files = await fs.readdir(this.snippetDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.snippetDir, file));
          if (data.type === 'snippet') this.snippets.set(data.id, data);
          else if (data.type === 'folder') this.folders.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadLanguages() {
    this.languages = [
      { id: 'javascript', name: 'JavaScript', icon: '📜' },
      { id: 'typescript', name: 'TypeScript', icon: '📘' },
      { id: 'python', name: 'Python', icon: '🐍' },
      { id: 'java', name: 'Java', icon: '☕' },
      { id: 'csharp', name: 'C#', icon: '🔷' },
      { id: 'cpp', name: 'C++', icon: '⚙️' },
      { id: 'go', name: 'Go', icon: '🐹' },
      { id: 'rust', name: 'Rust', icon: '🦀' },
      { id: 'ruby', name: 'Ruby', icon: '💎' },
      { id: 'php', name: 'PHP', icon: '🐘' },
      { id: 'sql', name: 'SQL', icon: '🗄️' },
      { id: 'html', name: 'HTML', icon: '🌐' },
      { id: 'css', name: 'CSS', icon: '🎨' },
      { id: 'bash', name: 'Bash', icon: '🖥️' },
      { id: 'powershell', name: 'PowerShell', icon: '💻' },
      { id: 'json', name: 'JSON', icon: '📋' },
      { id: 'yaml', name: 'YAML', icon: '📄' },
      { id: 'markdown', name: 'Markdown', icon: '📝' },
      { id: 'text', name: 'Plain Text', icon: '📃' }
    ];
  }

  loadDefaultFolders() {
    const defaults = [
      { id: 'functions', name: 'Functions', icon: '⚡' },
      { id: 'utilities', name: 'Utilities', icon: '🔧' },
      { id: 'components', name: 'Components', icon: '🧩' },
      { id: 'api', name: 'API', icon: '🌐' },
      { id: 'database', name: 'Database', icon: '🗄️' },
      { id: 'config', name: 'Config', icon: '⚙️' }
    ];

    defaults.forEach(folder => {
      if (!this.folders.has(folder.id)) {
        this.folders.set(folder.id, {
          ...folder,
          type: 'folder',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  async createSnippet(params) {
    const {
      title,
      description = '',
      language = 'javascript',
      code,
      tags = [],
      folderId = null,
      isFavorite = false,
      isPublic = false
    } = params;

    const id = uuidv4();
    const snippet = {
      id,
      title,
      description,
      language,
      code,
      tags,
      folderId,
      isFavorite,
      isPublic,
      copyCount: 0,
      lastCopied: null,
      type: 'snippet',
      createdAt: new Date().toISOString()
    };

    this.snippets.set(id, snippet);
    return snippet;
  }

  async updateSnippet(id, updates) {
    const snippet = this.snippets.get(id);
    if (!snippet) throw new Error(`Snippet not found: ${id}`);

    const updated = { ...snippet, ...updates };
    this.snippets.set(id, updated);
    return updated;
  }

  async deleteSnippet(id) {
    this.snippets.delete(id);
    return { success: true };
  }

  async getSnippet(id) {
    const snippet = this.snippets.get(id);
    if (!snippet) throw new Error(`Snippet not found: ${id}`);

    snippet.copyCount = (snippet.copyCount || 0) + 1;
    snippet.lastCopied = new Date().toISOString();
    this.snippets.set(id, snippet);

    return snippet;
  }

  async copySnippet(id) {
    return this.getSnippet(id);
  }

  listSnippets(options = {}) {
    const { language, folderId, favorite, tags, search, sort = 'date' } = options;
    let snippets = Array.from(this.snippets.values());

    if (language) snippets = snippets.filter(s => s.language === language);
    if (folderId) snippets = snippets.filter(s => s.folderId === folderId);
    if (favorite !== undefined) snippets = snippets.filter(s => s.isFavorite === favorite);
    if (tags && tags.length > 0) {
      snippets = snippets.filter(s => tags.some(t => s.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      snippets = snippets.filter(s =>
        s.title.toLowerCase().includes(searchLower) ||
        s.description.toLowerCase().includes(searchLower) ||
        s.code.toLowerCase().includes(searchLower)
      );
    }

    if (sort === 'date') snippets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (sort === 'title') snippets.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'copies') snippets.sort((a, b) => (b.copyCount || 0) - (a.copyCount || 0));

    return snippets;
  }

  async toggleFavorite(id) {
    const snippet = this.snippets.get(id);
    if (!snippet) throw new Error(`Snippet not found: ${id}`);

    snippet.isFavorite = !snippet.isFavorite;
    this.snippets.set(id, snippet);
    return snippet;
  }

  async createFolder(params) {
    const { name, icon = '📁', color = '#2196F3', parentId = null } = params;
    const id = uuidv4();

    const folder = {
      id,
      name,
      icon,
      color,
      parentId,
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

  async searchSnippets(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, snippet] of this.snippets) {
      let score = 0;

      if (snippet.title.toLowerCase().includes(queryLower)) score += 10;
      if (snippet.description.toLowerCase().includes(queryLower)) score += 5;
      if (snippet.code.toLowerCase().includes(queryLower)) score += 8;
      if (snippet.tags.some(t => t.toLowerCase().includes(queryLower))) score += 3;

      if (score > 0) {
        results.push({ ...snippet, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getSnippetStats() {
    const snippets = Array.from(this.snippets.values());

    return {
      total: snippets.length,
      favorites: snippets.filter(s => s.isFavorite).length,
      byLanguage: this.getSnippetsByLanguage(),
      folders: this.folders.size,
      totalCopies: snippets.reduce((sum, s) => sum + (s.copyCount || 0), 0)
    };
  }

  getSnippetsByLanguage() {
    const snippets = Array.from(this.snippets.values());
    const byLanguage = {};

    for (const snippet of snippets) {
      byLanguage[snippet.language] = (byLanguage[snippet.language] || 0) + 1;
    }

    return byLanguage;
  }

  getLanguages() {
    return this.languages;
  }

  async exportSnippets(format = 'json') {
    const data = {
      snippets: Array.from(this.snippets.values()),
      folders: Array.from(this.folders.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'zip') {
      return data;
    }

    return data;
  }
}

module.exports = SnippetEngine;
