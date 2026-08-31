const { v4: uuidv4 } = require('uuid');

class SmartAutoCompleteEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.suggestions = new Map();
    this.contexts = new Map();
    this.snippets = new Map();

    this.suggestionTypes = [
      { id: 'code', name: 'Code', icon: '💻', description: 'Code completion' },
      { id: 'variable', name: 'Variable', icon: '📝', description: 'Variable names' },
      { id: 'function', name: 'Function', icon: '⚡', description: 'Function names' },
      { id: 'class', name: 'Class', icon: '🏗️', description: 'Class names' },
      { id: 'import', name: 'Import', icon: '📦', description: 'Import statements' },
      { id: 'comment', name: 'Comment', icon: '💬', description: 'Code comments' },
      { id: 'test', name: 'Test', icon: '🧪', description: 'Test snippets' },
      { id: 'docstring', name: 'Docstring', icon: '📚', description: 'Documentation' },
      { id: 'snippet', name: 'Snippet', icon: '✂️', description: 'Code snippets' },
      { id: 'template', name: 'Template', icon: '📄', description: 'File templates' }
    ];

    this.languages = ['javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'html', 'css', 'sql', 'bash', 'json', 'yaml', 'markdown'];

    this.contextTypes = [
      { id: 'file', name: 'File Context', icon: '📄', description: 'Based on current file' },
      { id: 'project', name: 'Project Context', icon: '📁', description: 'Based on project structure' },
      { id: 'recent', name: 'Recent Context', icon: '🕐', description: 'Based on recent edits' },
      { id: 'pattern', name: 'Pattern Context', icon: '🔍', description: 'Based on learned patterns' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Smart Auto-Complete Engine...');
    this.loadSettings();
    this.logger.info('Smart Auto-Complete Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, maxSuggestions: 10, debounceMs: 150, triggerChars: 2, enableAI: true, enableSnippets: true };
  }

  getSuggestions(params) {
    const { prefix = '', language = 'javascript', contextType = 'file', lineNumber = 0, column = 0 } = params;
    const results = [];
    Array.from(this.snippets.values()).filter(s => s.language === language || s.language === 'all').forEach(s => {
      results.push({ id: s.id, text: s.snippet, type: 'snippet', label: s.name, description: s.description, priority: 0.8 });
    });
    return results.slice(0, this.settings.maxSuggestions);
  }

  addSnippet(params) {
    const { name, language = 'all', snippet = '', description = '', tags = [], trigger = '' } = params;
    const id = uuidv4();
    const s = { id, name, language, snippet, description, tags, trigger, usageCount: 0, createdAt: new Date().toISOString() };
    this.snippets.set(id, s);
    return s;
  }

  learnContext(params) {
    const { type, data, language = '', filePath = '' } = params;
    const id = uuidv4();
    const ctx = { id, type, data, language, filePath, timestamp: new Date().toISOString() };
    this.contexts.set(id, ctx);
    return ctx;
  }

  getSnippet(id) { return this.snippets.get(id); }
  listSnippets(language = null) { let s = Array.from(this.snippets.values()); if (language) s = s.filter(x => x.language === language || x.language === 'all'); return s; }
  getSuggestionTypes() { return this.suggestionTypes; }
  getLanguages() { return this.languages; }
  getContextTypes() { return this.contextTypes; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { suggestions: this.suggestions.size, contexts: this.contexts.size, snippets: this.snippets.size };
  }
}

module.exports = SmartAutoCompleteEngine;
