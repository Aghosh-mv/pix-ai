const { v4: uuidv4 } = require('uuid');

class PatternLearnerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.patterns = new Map();
    this.userBehaviors = new Map();
    this.codePatterns = new Map();
    this.preferences = new Map();

    this.patternTypes = [
      { id: 'coding-style', name: 'Coding Style', icon: '💻', description: 'User coding preferences' },
      { id: 'naming', name: 'Naming Convention', icon: '📛', description: 'Variable/function naming patterns' },
      { id: 'structure', name: 'Project Structure', icon: '📁', description: 'File organization patterns' },
      { id: 'error-handling', name: 'Error Handling', icon: '⚠️', description: 'How user handles errors' },
      { id: 'testing', name: 'Testing Style', icon: '🧪', description: 'Testing patterns' },
      { id: 'commenting', name: 'Comment Style', icon: '📝', description: 'Code comment patterns' },
      { id: 'imports', name: 'Import Style', icon: '📦', description: 'Import organization' },
      { id: 'workflow', name: 'Workflow Pattern', icon: '🔄', description: 'Task execution patterns' },
      { id: 'preference', name: 'Preference', icon: '⭐', description: 'User preferences' },
      { id: 'habit', name: 'Habit', icon: '🔁', description: 'Repeated behaviors' }
    ];

    this.learningModes = [
      { id: 'observe', name: 'Observe', icon: '👁️', description: 'Silently observe user behavior' },
      { id: 'suggest', name: 'Suggest', icon: '💡', description: 'Suggest based on patterns' },
      { id: 'apply', name: 'Auto-Apply', icon: '⚡', description: 'Apply learned patterns automatically' },
      { id: 'confirm', name: 'Confirm First', icon: '✅', description: 'Ask before applying' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Pattern Learner Engine...');
    this.loadSettings();
    this.logger.info('Pattern Learner Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, mode: 'observe', maxPatterns: 500, confidenceThreshold: 0.7, autoApplyThreshold: 0.9 };
  }

  observePattern(params) {
    const { type, context, data, confidence = 0.5 } = params;
    const id = uuidv4();
    const pattern = { id, type, context, data, confidence, occurrences: 1, status: 'observed', createdAt: new Date().toISOString(), lastSeen: new Date().toISOString() };
    this.patterns.set(id, pattern);
    return pattern;
  }

  learnBehavior(params) {
    const { trigger, action, context = '', frequency = 1 } = params;
    const id = uuidv4();
    const behavior = { id, trigger, action, context, frequency, confidence: Math.min(1, frequency * 0.1), createdAt: new Date().toISOString() };
    this.userBehaviors.set(id, behavior);
    return behavior;
  }

  suggestFromPatterns(context = '') {
    const suggestions = [];
    Array.from(this.patterns.values()).filter(p => p.confidence >= this.settings.confidenceThreshold).forEach(p => {
      suggestions.push({ patternId: p.id, type: p.type, suggestion: `Apply learned ${p.type} pattern`, confidence: p.confidence });
    });
    return suggestions;
  }

  getPattern(id) { return this.patterns.get(id); }
  listPatterns(type = null) { let p = Array.from(this.patterns.values()); if (type) p = p.filter(x => x.type === type); return p; }
  getBehavior(id) { return this.userBehaviors.get(id); }
  listBehaviors() { return Array.from(this.userBehaviors.values()); }
  getPatternTypes() { return this.patternTypes; }
  getLearningModes() { return this.learningModes; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { patterns: this.patterns.size, behaviors: this.userBehaviors.size, highConfidence: Array.from(this.patterns.values()).filter(p => p.confidence >= 0.8).length };
  }
}

module.exports = PatternLearnerEngine;
