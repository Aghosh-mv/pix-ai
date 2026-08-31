const { v4: uuidv4 } = require('uuid');

class CodeReviewerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.reviews = new Map();
    this.issues = new Map();
    this.suggestions = new Map();

    this.reviewCategories = [
      { id: 'correctness', name: 'Correctness', icon: '✅', description: 'Code logic and correctness', weight: 0.3 },
      { id: 'performance', name: 'Performance', icon: '⚡', description: 'Performance optimization', weight: 0.15 },
      { id: 'security', name: 'Security', icon: '🛡️', description: 'Security vulnerabilities', weight: 0.2 },
      { id: 'maintainability', name: 'Maintainability', icon: '🔧', description: 'Code maintainability', weight: 0.15 },
      { id: 'readability', name: 'Readability', icon: '👁️', description: 'Code readability', weight: 0.1 },
      { id: 'testing', name: 'Testing', icon: '🧪', description: 'Test coverage and quality', weight: 0.1 }
    ];

    this.severities = [
      { id: 'critical', name: 'Critical', icon: '🔴', color: '#F44336', description: 'Must fix' },
      { id: 'high', name: 'High', icon: '🟠', color: '#FF9800', description: 'Should fix' },
      { id: 'medium', name: 'Medium', icon: '🟡', color: '#FFEB3B', description: 'Consider fixing' },
      { id: 'low', name: 'Low', icon: '🟢', color: '#4CAF50', description: 'Nice to fix' },
      { id: 'info', name: 'Info', icon: '🔵', color: '#2196F3', description: 'Informational' }
    ];

    this.reviewModes = [
      { id: 'full', name: 'Full Review', icon: '🔍', description: 'Complete code review' },
      { id: 'quick', name: 'Quick Review', icon: '⚡', description: 'Fast critical issues only' },
      { id: 'security', name: 'Security Focus', icon: '🛡️', description: 'Security-focused review' },
      { id: 'performance', name: 'Performance Focus', icon: '🚀', description: 'Performance-focused review' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Code Reviewer AI Engine...');
    this.loadSettings();
    this.logger.info('Code Reviewer AI Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, mode: 'full', autoReview: true, showScore: true, minSeverity: 'medium' };
  }

  createReview(params) {
    const { filePath = '', code = '', language = 'javascript', mode = this.settings.mode } = params;
    const id = uuidv4();
    const review = { id, filePath, code, language, mode, issues: [], score: 100, grade: 'A', summary: '', timestamp: new Date().toISOString() };
    this.reviews.set(id, review);
    return review;
  }

  addIssue(params) {
    const { reviewId, category, severity = 'medium', line = 0, message = '', suggestion = '', fix = '' } = params;
    const id = uuidv4();
    const issue = { id, reviewId, category, severity, line, message, suggestion, fix, status: 'open', createdAt: new Date().toISOString() };
    this.issues.set(id, issue);
    const review = this.reviews.get(reviewId);
    if (review) { review.issues.push(id); this.reviews.set(reviewId, review); }
    return issue;
  }

  getReview(id) { return this.reviews.get(id); }
  listReviews(limit = 50) { return Array.from(this.reviews.values()).slice(-limit); }
  getIssue(id) { return this.issues.get(id); }
  listIssues(reviewId = null) { let i = Array.from(this.issues.values()); if (reviewId) i = i.filter(x => x.reviewId === reviewId); return i; }
  getReviewCategories() { return this.reviewCategories; }
  getSeverities() { return this.severities; }
  getReviewModes() { return this.reviewModes; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { reviews: this.reviews.size, issues: this.issues.size, openIssues: Array.from(this.issues.values()).filter(i => i.status === 'open').length };
  }
}

module.exports = CodeReviewerEngine;
