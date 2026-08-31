const { v4: uuidv4 } = require('uuid');

class PromptEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.templates = new Map();
    this.collections = new Map();
    this.favorites = new Set();

    this.categories = [
      { id: 'coding', name: 'Coding', icon: '💻', description: 'Code generation and editing' },
      { id: 'debugging', name: 'Debugging', icon: '🐛', description: 'Bug fixing prompts' },
      { id: 'explanation', name: 'Explanation', icon: '📖', description: 'Code explanation' },
      { id: 'refactoring', name: 'Refactoring', icon: '🔧', description: 'Code refactoring' },
      { id: 'testing', name: 'Testing', icon: '🧪', description: 'Test generation' },
      { id: 'documentation', name: 'Documentation', icon: '📝', description: 'Doc generation' },
      { id: 'architecture', name: 'Architecture', icon: '🏗️', description: 'System design' },
      { id: 'research', name: 'Research', icon: '🔍', description: 'Research prompts' },
      { id: 'creative', name: 'Creative', icon: '🎨', description: 'Creative writing' },
      { id: 'analysis', name: 'Analysis', icon: '📊', description: 'Data analysis' }
    ];

    this.variables = [
      { id: 'language', name: 'Language', description: 'Programming language', default: 'javascript' },
      { id: 'framework', name: 'Framework', description: 'Framework used', default: '' },
      { id: 'style', name: 'Style', description: 'Code style', default: 'clean' },
      { id: 'detail', name: 'Detail Level', description: 'How detailed', default: 'moderate' },
      { id: 'target', name: 'Target', description: 'Target audience', default: 'developer' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Prompt Engine...');
    this.loadSettings();
    this.logger.info('Prompt Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, maxTemplates: 200, enableVariables: true, enableCollections: true };
  }

  createTemplate(params) {
    const { name, category = 'coding', prompt = '', description = '', variables = [], tags = [], favorite = false } = params;
    const id = uuidv4();
    const template = { id, name, category, prompt, description, variables, tags, favorite, usageCount: 0, createdAt: new Date().toISOString() };
    this.templates.set(id, template);
    if (favorite) this.favorites.add(id);
    return template;
  }

  renderTemplate(id, values = {}) {
    const template = this.templates.get(id);
    if (!template) throw new Error('Template not found');
    let rendered = template.prompt;
    template.variables.forEach(v => { const val = values[v] || v.default || ''; rendered = rendered.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), val); });
    template.usageCount++;
    this.templates.set(id, template);
    return { template: template.name, rendered, variables: values };
  }

  createCollection(params) {
    const { name, description = '', templateIds = [] } = params;
    const id = uuidv4();
    const coll = { id, name, description, templateIds, createdAt: new Date().toISOString() };
    this.collections.set(id, coll);
    return coll;
  }

  getTemplate(id) { return this.templates.get(id); }
  listTemplates(category = null) { let t = Array.from(this.templates.values()); if (category) t = t.filter(x => x.category === category); return t; }
  getFavorites() { return Array.from(this.favorites).map(id => this.templates.get(id)).filter(Boolean); }
  getCategories() { return this.categories; }
  getVariables() { return this.variables; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { templates: this.templates.size, collections: this.collections.size, favorites: this.favorites.size };
  }
}

module.exports = PromptEngine;
