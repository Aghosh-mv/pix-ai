const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class PreTaskResearchEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.researchSessions = new Map();
    this.knowledgeBase = new Map();
    this.topicProfiles = new Map();
    this.researchDir = path.join(os.homedir(), '.pix/research');

    this.researchModes = [
      { id: 'quick', name: 'Quick Scan', icon: '⚡', description: 'Fast overview of key concepts', depth: 1, sources: 3, timeLimit: 30000 },
      { id: 'standard', name: 'Standard Research', icon: '📚', description: 'Thorough topic understanding', depth: 2, sources: 8, timeLimit: 120000 },
      { id: 'deep', name: 'Deep Dive', icon: '🔬', description: 'Comprehensive topic mastery', depth: 3, sources: 15, timeLimit: 300000 },
      { id: 'exhaustive', name: 'Exhaustive Research', icon: '🎓', description: 'Complete topic coverage', depth: 4, sources: 30, timeLimit: 600000 }
    ];

    this.researchCategories = [
      { id: 'concept', name: 'Core Concepts', icon: '💡', description: 'Fundamental ideas and principles', priority: 10 },
      { id: 'implementation', name: 'Implementation', icon: '🔧', description: 'How to build it', priority: 9 },
      { id: 'algorithms', name: 'Algorithms', icon: '🧮', description: 'Mathematical and computational methods', priority: 8 },
      { id: 'best-practices', name: 'Best Practices', icon: '✅', description: 'Industry standards and patterns', priority: 7 },
      { id: 'libraries', name: 'Libraries & Tools', icon: '📦', description: 'Existing solutions and dependencies', priority: 6 },
      { id: 'architecture', name: 'Architecture', icon: '🏗️', description: 'System design and structure', priority: 8 },
      { id: 'performance', name: 'Performance', icon: '⚡', description: 'Optimization techniques', priority: 5 },
      { id: 'security', name: 'Security', icon: '🔒', description: 'Security considerations', priority: 6 },
      { id: 'examples', name: 'Examples', icon: '📝', description: 'Real-world implementations', priority: 7 },
      { id: 'pitfalls', name: 'Common Pitfalls', icon: '⚠️', description: 'What to avoid', priority: 8 },
      { id: 'testing', name: 'Testing', icon: '🧪', description: 'How to test', priority: 5 },
      { id: 'documentation', name: 'Documentation', icon: '📖', description: 'Reference materials', priority: 4 }
    ];

    this.topicKeywords = {
      'physics-engine': ['physics', 'collision', 'gravity', 'velocity', 'acceleration', 'rigid body', 'simulation', 'newton', 'friction', 'momentum', 'inertia', 'torque'],
      'machine-learning': ['neural network', 'training', 'model', 'dataset', 'gradient', 'loss function', 'optimization', 'regression', 'classification', 'deep learning'],
      'web-scraping': ['html parsing', 'dom traversal', 'xpath', 'css selectors', 'headless browser', 'anti-bot', 'rate limiting', 'proxy', 'user agent'],
      'database': ['sql', 'nosql', 'indexing', 'query optimization', 'normalization', 'transactions', 'acid', 'replication', 'sharding'],
      'api-design': ['rest', 'graphql', 'authentication', 'rate limiting', 'versioning', 'documentation', 'openapi', 'swagger'],
      'encryption': ['aes', 'rsa', 'hashing', 'ssl', 'tls', 'certificate', 'key management', 'cipher', 'blockchain'],
      'game-development': ['game loop', 'rendering', 'sprite', 'animation', 'physics', 'collision detection', 'input handling', 'audio'],
      'mobile-app': ['ios', 'android', 'react native', 'flutter', 'gesture', 'notification', 'push notification', 'offline'],
      'devops': ['docker', 'kubernetes', 'ci/cd', 'deployment', 'monitoring', 'logging', 'infrastructure', 'terraform'],
      'ui-design': ['accessibility', 'responsive', 'layout', 'color theory', 'typography', 'animation', 'usability', 'a11y']
    };
  }

  async initialize() {
    this.logger.info('Initializing Pre-Task Research Engine...');
    await fs.ensureDir(this.researchDir);
    await fs.ensureDir(path.join(this.researchDir, 'sessions'));
    await fs.ensureDir(path.join(this.researchDir, 'knowledge'));
    await this.loadData();
    this.logger.info('Pre-Task Research Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(path.join(this.researchDir, 'sessions'));
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.researchDir, 'sessions', file));
          this.researchSessions.set(data.id, data);
        }
      }

      const kbFiles = await fs.readdir(path.join(this.researchDir, 'knowledge'));
      for (const file of kbFiles) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.researchDir, 'knowledge', file));
          this.knowledgeBase.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  async startResearch(params) {
    const {
      topic,
      task = null,
      mode = 'standard',
      categories = null,
      maxSources = null,
      customQueries = [],
      context = {}
    } = params;

    const id = uuidv4();
    const researchMode = this.researchModes.find(m => m.id === mode) || this.researchModes[1];

    const researchPlan = this.createResearchPlan(topic, researchMode, categories, customQueries);

    const session = {
      id,
      topic,
      task,
      mode: researchMode,
      categories: categories || this.researchCategories.map(c => c.id),
      plan: researchPlan,
      findings: [],
      sources: [],
      keyConcepts: [],
      implementationGuide: null,
      generatedQueries: researchPlan.queries,
      status: 'researching',
      progress: 0,
      context,
      metrics: {
        queriesMade: 0,
        sourcesReviewed: 0,
        conceptsLearned: 0,
        timeSpent: 0
      },
      type: 'session',
      createdAt: new Date().toISOString()
    };

    this.researchSessions.set(id, session);
    await this.saveSession(session);

    return session;
  }

  createResearchPlan(topic, mode, categories, customQueries) {
    const topicLower = topic.toLowerCase();
    const plan = {
      phases: [],
      queries: [],
      categories: categories || []
    };

    const detectedKeywords = this.detectTopicKeywords(topicLower);
    plan.detectedKeywords = detectedKeywords;

    const coreQueries = [
      `what is ${topic} and how does it work`,
      `${topic} fundamentals and core concepts`,
      `${topic} implementation guide`,
      `${topic} best practices`,
      `${topic} common mistakes and pitfalls`,
      `${topic} examples and tutorials`,
      `${topic} libraries and tools`,
      `${topic} architecture patterns`,
      `${topic} performance optimization`,
      `${topic} testing strategies`
    ];

    plan.queries = [...coreQueries, ...customQueries];

    if (detectedKeywords.length > 0) {
      for (const keyword of detectedKeywords.slice(0, 5)) {
        plan.queries.push(`${keyword} explained`);
        plan.queries.push(`${keyword} implementation`);
      }
    }

    plan.phases = [
      {
        name: 'Overview',
        description: 'Get a high-level understanding of the topic',
        queries: plan.queries.slice(0, 3),
        estimatedTime: mode.timeLimit * 0.2
      },
      {
        name: 'Deep Dive',
        description: 'Explore detailed concepts and implementation',
        queries: plan.queries.slice(3, 7),
        estimatedTime: mode.timeLimit * 0.4
      },
      {
        name: 'Implementation',
        description: 'Study how to build it',
        queries: plan.queries.slice(7, 10),
        estimatedTime: mode.timeLimit * 0.3
      },
      {
        name: 'Review',
        description: 'Consolidate findings',
        queries: [],
        estimatedTime: mode.timeLimit * 0.1
      }
    ];

    return plan;
  }

  detectTopicKeywords(topic) {
    const detected = [];

    for (const [key, keywords] of Object.entries(this.topicKeywords)) {
      for (const keyword of keywords) {
        if (topic.includes(keyword) || keyword.includes(topic)) {
          detected.push(...keywords);
          break;
        }
      }
    }

    const words = topic.split(/\s+/).filter(w => w.length > 3);
    detected.push(...words);

    return [...new Set(detected)].slice(0, 15);
  }

  async processSearchResult(params) {
    const { sessionId, query, results } = params;

    const session = this.researchSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const findings = [];

    for (const result of results) {
      const finding = {
        id: uuidv4(),
        query,
        title: result.title || 'Untitled',
        url: result.url || '',
        snippet: result.snippet || result.description || '',
        content: result.content || result.snippet || '',
        relevanceScore: this.calculateRelevance(result, session.topic),
        category: this.categorizeFinding(result, session.topic),
        keyPoints: this.extractKeyPoints(result.content || result.snippet || ''),
        concepts: this.extractConcepts(result.content || result.snippet || '', session.topic),
        implementationNotes: this.extractImplementationNotes(result.content || result.snippet || ''),
        createdAt: new Date().toISOString()
      };

      findings.push(finding);
      session.findings.push(finding);
    }

    session.sources.push({
      query,
      resultCount: results.length,
      timestamp: new Date().toISOString()
    });

    session.metrics.queriesMade++;
    session.metrics.sourcesReviewed += results.length;
    session.progress = Math.min(95, session.progress + 10);

    this.researchSessions.set(sessionId, session);
    await this.saveSession(session);

    return findings;
  }

  calculateRelevance(result, topic) {
    const topicWords = topic.toLowerCase().split(/\s+/);
    const content = ((result.title || '') + ' ' + (result.snippet || '') + ' ' + (result.content || '')).toLowerCase();

    let score = 0;
    for (const word of topicWords) {
      if (content.includes(word)) score += 0.15;
    }

    if (result.title && result.title.toLowerCase().includes(topic.toLowerCase())) score += 0.2;

    return Math.min(1, score);
  }

  categorizeFinding(result, topic) {
    const content = ((result.title || '') + ' ' + (result.snippet || '') + ' ' + (result.content || '')).toLowerCase();

    for (const category of this.researchCategories) {
      const keywords = {
        'concept': ['what is', 'definition', 'meaning', 'understand', 'basics', 'fundamentals'],
        'implementation': ['how to', 'implement', 'build', 'create', 'setup', 'configure'],
        'algorithms': ['algorithm', 'formula', 'equation', 'calculate', 'compute', 'math'],
        'best-practices': ['best practice', 'recommended', 'should', 'tip', 'guideline', 'pattern'],
        'libraries': ['library', 'package', 'module', 'framework', 'tool', 'dependency'],
        'architecture': ['architecture', 'design', 'structure', 'pattern', 'system', 'component'],
        'performance': ['performance', 'optimization', 'speed', 'fast', 'efficient', 'benchmark'],
        'security': ['security', 'vulnerability', 'attack', 'encrypt', 'protect', 'safe'],
        'examples': ['example', 'tutorial', 'demo', 'sample', 'case study', 'walkthrough'],
        'pitfalls': ['mistake', 'error', 'pitfall', 'avoid', 'wrong', 'problem', 'issue'],
        'testing': ['test', 'testing', 'unit test', 'integration', 'coverage', 'assert'],
        'documentation': ['documentation', 'docs', 'reference', 'api', 'manual', 'guide']
      };

      for (const keyword of keywords[category.id] || []) {
        if (content.includes(keyword)) return category.id;
      }
    }

    return 'concept';
  }

  extractKeyPoints(content) {
    const points = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);

    for (const sentence of sentences.slice(0, 5)) {
      const trimmed = sentence.trim();
      if (trimmed.length > 20 && trimmed.length < 200) {
        points.push(trimmed);
      }
    }

    return points;
  }

  extractConcepts(content, topic) {
    const concepts = [];
    const topicWords = topic.toLowerCase().split(/\s+/);
    const words = content.toLowerCase().split(/\s+/);

    for (const word of words) {
      if (word.length > 5 && !topicWords.includes(word) && !concepts.includes(word)) {
        concepts.push(word);
      }
    }

    return concepts.slice(0, 10);
  }

  extractImplementationNotes(content) {
    const notes = [];
    const implementationKeywords = ['step', 'first', 'then', 'next', 'finally', 'create', 'define', 'implement'];

    const sentences = content.split(/[.!?]+/);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (implementationKeywords.some(kw => lower.includes(kw))) {
        notes.push(sentence.trim());
      }
    }

    return notes.slice(0, 5);
  }

  async generateKnowledgeBase(sessionId) {
    const session = this.researchSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const knowledge = {
      id: uuidv4(),
      sessionId,
      topic: session.topic,
      summary: this.generateSummary(session),
      keyConcepts: this.compileKeyConcepts(session),
      implementationGuide: this.compileImplementationGuide(session),
      bestPractices: this.compileBestPractices(session),
      commonPitfalls: this.compilePitfalls(session),
      recommendedLibraries: this.compileLibraries(session),
      architecturePatterns: this.compileArchitecture(session),
      testingApproaches: this.compileTesting(session),
      performanceTips: this.compilePerformance(session),
      securityConsiderations: this.compileSecurity(session),
      examples: this.compileExamples(session),
      confidence: this.calculateConfidence(session),
      completeness: this.calculateCompleteness(session),
      type: 'knowledge',
      createdAt: new Date().toISOString()
    };

    this.knowledgeBase.set(knowledge.id, knowledge);
    session.knowledgeBaseId = knowledge.id;
    session.status = 'completed';
    session.progress = 100;

    this.researchSessions.set(sessionId, session);
    await this.saveSession(session);
    await this.saveKnowledge(knowledge);

    return knowledge;
  }

  generateSummary(session) {
    const findingsCount = session.findings.length;
    const sourcesCount = session.sources.length;
    const concepts = [...new Set(session.findings.flatMap(f => f.concepts || []))].slice(0, 20);

    return `Research on "${session.topic}" analyzed ${findingsCount} findings from ${sourcesCount} sources. Key concepts identified: ${concepts.join(', ')}. This research provides a solid foundation for implementing ${session.topic}.`;
  }

  compileKeyConcepts(session) {
    const concepts = new Map();

    for (const finding of session.findings) {
      for (const concept of (finding.concepts || [])) {
        if (!concepts.has(concept)) {
          concepts.set(concept, {
            name: concept,
            occurrences: 0,
            contexts: []
          });
        }
        const data = concepts.get(concept);
        data.occurrences++;
        if (finding.snippet) data.contexts.push(finding.snippet.substring(0, 100));
      }
    }

    return Array.from(concepts.values())
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 20);
  }

  compileImplementationGuide(session) {
    const steps = [];
    const implementationFindings = session.findings.filter(f => f.category === 'implementation');

    for (const finding of implementationFindings) {
      steps.push(...(finding.implementationNotes || []));
    }

    return {
      overview: `Steps to implement ${session.topic}:`,
      steps: [...new Set(steps)].slice(0, 10),
      prerequisites: this.extractPrerequisites(session),
      estimatedComplexity: this.estimateComplexity(session)
    };
  }

  extractPrerequisites(session) {
    const prereqs = [];
    const prereqKeywords = ['knowledge', 'understand', 'familiar with', 'prerequisite', 'required', 'need'];

    for (const finding of session.findings) {
      const content = (finding.content || '').toLowerCase();
      for (const keyword of prereqKeywords) {
        if (content.includes(keyword)) {
          prereqs.push(finding.snippet || finding.title);
          break;
        }
      }
    }

    return [...new Set(prereqs)].slice(0, 5);
  }

  estimateComplexity(session) {
    const findingCount = session.findings.length;
    const conceptCount = [...new Set(session.findings.flatMap(f => f.concepts || []))].length;

    if (conceptCount > 20 || findingCount > 15) return 'high';
    if (conceptCount > 10 || findingCount > 8) return 'medium';
    return 'low';
  }

  compileBestPractices(session) {
    return session.findings
      .filter(f => f.category === 'best-practices')
      .map(f => ({ title: f.title, keyPoints: f.keyPoints }))
      .slice(0, 10);
  }

  compilePitfalls(session) {
    return session.findings
      .filter(f => f.category === 'pitfalls')
      .map(f => ({ title: f.title, warning: f.snippet }))
      .slice(0, 10);
  }

  compileLibraries(session) {
    return session.findings
      .filter(f => f.category === 'libraries')
      .map(f => ({ name: f.title, description: f.snippet, url: f.url }))
      .slice(0, 10);
  }

  compileArchitecture(session) {
    return session.findings
      .filter(f => f.category === 'architecture')
      .map(f => ({ pattern: f.title, description: f.snippet }))
      .slice(0, 5);
  }

  compileTesting(session) {
    return session.findings
      .filter(f => f.category === 'testing')
      .map(f => ({ approach: f.title, details: f.snippet }))
      .slice(0, 5);
  }

  compilePerformance(session) {
    return session.findings
      .filter(f => f.category === 'performance')
      .map(f => ({ tip: f.title, details: f.snippet }))
      .slice(0, 5);
  }

  compileSecurity(session) {
    return session.findings
      .filter(f => f.category === 'security')
      .map(f => ({ consideration: f.title, details: f.snippet }))
      .slice(0, 5);
  }

  compileExamples(session) {
    return session.findings
      .filter(f => f.category === 'examples')
      .map(f => ({ title: f.title, url: f.url, description: f.snippet }))
      .slice(0, 5);
  }

  calculateConfidence(session) {
    const sources = session.sources.length;
    const findings = session.findings.length;
    const categories = [...new Set(session.findings.map(f => f.category))].length;

    let confidence = 0.3;
    confidence += Math.min(sources * 0.05, 0.25);
    confidence += Math.min(findings * 0.02, 0.25);
    confidence += Math.min(categories * 0.03, 0.2);

    return Math.min(0.95, confidence);
  }

  calculateCompleteness(session) {
    const coveredCategories = [...new Set(session.findings.map(f => f.category))];
    const totalCategories = this.researchCategories.length;
    return coveredCategories.length / totalCategories;
  }

  async getSession(id) {
    return this.researchSessions.get(id);
  }

  async getKnowledge(id) {
    return this.knowledgeBase.get(id);
  }

  async getKnowledgeByTopic(topic) {
    for (const [, knowledge] of this.knowledgeBase) {
      if (knowledge.topic.toLowerCase() === topic.toLowerCase()) {
        return knowledge;
      }
    }
    return null;
  }

  listSessions(options = {}) {
    const { status, topic } = options;
    let sessions = Array.from(this.researchSessions.values());

    if (status) sessions = sessions.filter(s => s.status === status);
    if (topic) {
      const topicLower = topic.toLowerCase();
      sessions = sessions.filter(s => s.topic.toLowerCase().includes(topicLower));
    }

    return sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  listKnowledge() {
    return Array.from(this.knowledgeBase.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getResearchModes() {
    return this.researchModes;
  }

  getResearchCategories() {
    return this.researchCategories;
  }

  async shouldResearch(task) {
    const taskLower = task.toLowerCase();
    const complexityIndicators = ['build', 'create', 'implement', 'design', 'develop', 'engine', 'system', 'platform'];
    const simpleIndicators = ['hello', 'test', 'debug', 'fix typo', 'change color'];

    const isComplex = complexityIndicators.some(indicator => taskLower.includes(indicator));
    const isSimple = simpleIndicators.some(indicator => taskLower.includes(indicator));

    if (isSimple) return { shouldResearch: false, reason: 'Task appears simple' };
    if (isComplex) return { shouldResearch: true, reason: 'Task involves building something complex', suggestedMode: 'standard' };

    return { shouldResearch: true, reason: 'Pre-research recommended', suggestedMode: 'quick' };
  }

  async getStats() {
    const sessions = Array.from(this.researchSessions.values());
    const knowledge = Array.from(this.knowledgeBase.values());

    return {
      sessions: sessions.length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      knowledgeEntries: knowledge.length,
      totalFindings: sessions.reduce((sum, s) => sum + s.findings.length, 0),
      totalSources: sessions.reduce((sum, s) => sum + s.sources.length, 0),
      topicsResearched: [...new Set(sessions.map(s => s.topic))].length,
      averageConfidence: knowledge.length > 0
        ? knowledge.reduce((sum, k) => sum + k.confidence, 0) / knowledge.length
        : 0
    };
  }

  async saveSession(session) {
    const filePath = path.join(this.researchDir, 'sessions', `session-${session.id}.json`);
    await fs.writeJson(filePath, session, { spaces: 2 });
  }

  async saveKnowledge(knowledge) {
    const filePath = path.join(this.researchDir, 'knowledge', `kb-${knowledge.id}.json`);
    await fs.writeJson(filePath, knowledge, { spaces: 2 });
  }

  async exportResearch(format = 'json') {
    const data = {
      sessions: Array.from(this.researchSessions.values()),
      knowledge: Array.from(this.knowledgeBase.values()),
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = PreTaskResearchEngine;
