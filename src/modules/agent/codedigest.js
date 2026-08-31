const { v4: uuidv4 } = require('uuid');

class CodeDigestEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.digests = new Map();
    this.summaries = new Map();

    this.digestTypes = [
      { id: 'file', name: 'File Digest', icon: '📄', description: 'Summarize single file' },
      { id: 'project', name: 'Project Digest', icon: '📁', description: 'Summarize entire project' },
      { id: 'function', name: 'Function Digest', icon: '⚡', description: 'Summarize function' },
      { id: 'class', name: 'Class Digest', icon: '🏗️', description: 'Summarize class' },
      { id: 'module', name: 'Module Digest', icon: '📦', description: 'Summarize module' },
      { id: 'diff', name: 'Diff Digest', icon: '🔀', description: 'Summarize changes' },
      { id: 'repo', name: 'Repository Digest', icon: '🐙', description: 'Summarize repo' }
    ];

    this.summaryStyles = [
      { id: 'concise', name: 'Concise', icon: '📝', description: 'Brief summary' },
      { id: 'detailed', name: 'Detailed', icon: '📚', description: 'Comprehensive summary' },
      { id: 'technical', name: 'Technical', icon: '⚙️', description: 'Technical deep-dive' },
      { id: 'beginner', name: 'Beginner Friendly', icon: '🌱', description: 'Simple explanation' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Code Digest Engine...');
    this.loadSettings();
    this.logger.info('Code Digest Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, defaultStyle: 'concise', maxTokens: 4096, includeExamples: true };
  }

  createDigest(params) {
    const { type = 'file', path = '', language = 'javascript', style = 'concise', content = '' } = params;
    const id = uuidv4();
    const digest = { id, type, path, language, style, content, summary: '', keyPoints: [], functions: [], classes: [], imports: [], complexity: 'low', timestamp: new Date().toISOString() };
    this.digests.set(id, digest);
    return digest;
  }

  getDigest(id) { return this.digests.get(id); }
  listDigests(type = null) { let d = Array.from(this.digests.values()); if (type) d = d.filter(x => x.type === type); return d; }
  getDigestTypes() { return this.digestTypes; }
  getSummaryStyles() { return this.summaryStyles; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { digests: this.digests.size, summaries: this.summaries.size };
  }
}

module.exports = CodeDigestEngine;
