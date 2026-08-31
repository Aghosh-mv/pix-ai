const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class LearningEngine {
  constructor(config, logger, automationEngine) {
    this.config = config;
    this.logger = logger;
    this.automation = automationEngine;
    this.observations = new Map();
    this.patterns = new Map();
    this.knowledge = new Map();
    this.skills = new Map();
    this.learningDir = path.join(os.homedir(), '.pix/learning');
    this.observationsFile = path.join(this.learningDir, 'observations.json');
    this.patternsFile = path.join(this.learningDir, 'patterns.json');
    this.knowledgeFile = path.join(this.learningDir, 'knowledge.json');
    this.skillsFile = path.join(this.learningDir, 'skills.json');
    this.eventEmitter = new EventEmitter();
  }

  async initialize() {
    this.logger.info('Initializing Learning Engine...');
    await fs.ensureDir(this.learningDir);
    await this.loadAll();
    this.logger.info('Learning Engine initialized');
  }

  async loadAll() {
    try {
      if (await fs.pathExists(this.observationsFile)) {
        const data = await fs.readJson(this.observationsFile);
        this.observations = new Map(Object.entries(data));
      }
    } catch (e) {}

    try {
      if (await fs.pathExists(this.patternsFile)) {
        const data = await fs.readJson(this.patternsFile);
        this.patterns = new Map(Object.entries(data));
      }
    } catch (e) {}

    try {
      if (await fs.pathExists(this.knowledgeFile)) {
        const data = await fs.readJson(this.knowledgeFile);
        this.knowledge = new Map(Object.entries(data));
      }
    } catch (e) {}

    try {
      if (await fs.pathExists(this.skillsFile)) {
        const data = await fs.readJson(this.skillsFile);
        this.skills = new Map(Object.entries(data));
      }
    } catch (e) {}
  }

  async saveAll() {
    await fs.writeJson(this.observationsFile, Object.fromEntries(this.observations), { spaces: 2 });
    await fs.writeJson(this.patternsFile, Object.fromEntries(this.patterns), { spaces: 2 });
    await fs.writeJson(this.knowledgeFile, Object.fromEntries(this.knowledge), { spaces: 2 });
    await fs.writeJson(this.skillsFile, Object.fromEntries(this.skills), { spaces: 2 });
  }

  async observe(params) {
    const {
      type = 'screen',
      source = null,
      data = null,
      description = '',
      tags = [],
      autoAnalyze = true
    } = params;

    const id = uuidv4();
    const timestamp = new Date().toISOString();

    this.logger.info(`Recording observation: ${type} - ${description}`);

    let observation = {
      id,
      type,
      source,
      data,
      description,
      tags,
      timestamp,
      analyzed: false,
      patterns: [],
      insights: []
    };

    if (type === 'screen') {
      const screenshot = await this.automation.screenshot();
      observation.screenshot = screenshot.filepath;

      const imageData = await fs.readFile(screenshot.filepath, 'base64');
      observation.imageData = imageData;
    }

    if (autoAnalyze) {
      const analysis = await this.analyzeObservation(observation);
      observation.analyzed = true;
      observation.patterns = analysis.patterns;
      observation.insights = analysis.insights;
    }

    this.observations.set(id, observation);
    await this.saveAll();

    this.eventEmitter.emit('observation', observation);

    return observation;
  }

  async analyzeObservation(observation) {
    const patterns = [];
    const insights = [];

    const existingObs = Array.from(this.observations.values())
      .filter(o => o.type === observation.type)
      .slice(-100);

    for (const obs of existingObs) {
      if (obs.description === observation.description) {
        const pattern = {
          type: 'repetition',
          description: `Repeated action: ${observation.description}`,
          frequency: 1,
          firstSeen: obs.timestamp,
          lastSeen: observation.timestamp
        };

        const existing = patterns.find(p => p.type === 'repetition' && p.description === pattern.description);
        if (existing) {
          existing.frequency++;
        } else {
          patterns.push(pattern);
        }
      }
    }

    if (observation.type === 'screen') {
      insights.push({
        type: 'visual',
        description: 'Screen captured for analysis',
        confidence: 0.9
      });
    }

    if (observation.type === 'action') {
      insights.push({
        type: 'behavioral',
        description: `User action observed: ${observation.description}`,
        confidence: 0.8
      });
    }

    return { patterns, insights };
  }

  async analyze(params) {
    const { observationId, depth = 'basic' } = params;
    const observation = this.observations.get(observationId);

    if (!observation) throw new Error(`Observation not found: ${observationId}`);

    const analysis = {
      id: observationId,
      type: observation.type,
      timestamp: observation.timestamp,
      patterns: [],
      recommendations: [],
      connections: []
    };

    const allObs = Array.from(this.observations.values());

    const typeMatches = allObs.filter(o => o.type === observation.type);
    analysis.patterns.push({
      type: 'frequency',
      count: typeMatches.length,
      percentage: (typeMatches.length / allObs.length) * 100
    });

    for (const [patternId, pattern] of this.patterns) {
      if (this.observationMatchesPattern(observation, pattern)) {
        analysis.connections.push(patternId);
      }
    }

    if (observation.type === 'screen') {
      analysis.recommendations.push({
        type: 'vision',
        description: 'Use AI vision model to analyze screenshot content',
        priority: 'high'
      });
    }

    return analysis;
  }

  observationMatchesPattern(observation, pattern) {
    if (pattern.type === 'screen-layout' && observation.type === 'screen') {
      return true;
    }
    if (pattern.type === 'user-flow' && observation.type === 'action') {
      return true;
    }
    return false;
  }

  async teach(params) {
    const {
      name,
      description,
      type = 'skill',
      steps = [],
      examples = [],
      tags = [],
      metadata = {}
    } = params;

    const id = uuidv4();
    const timestamp = new Date().toISOString();

    this.logger.info(`Teaching new ${type}: ${name}`);

    const skill = {
      id,
      name,
      description,
      type,
      steps,
      examples,
      tags,
      metadata,
      proficiency: 0,
      timesUsed: 0,
      lastUsed: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.skills.set(id, skill);

    if (steps.length > 0) {
      const pattern = {
        id: uuidv4(),
        type: 'skill',
        skillId: id,
        name: name,
        steps: steps,
        conditions: metadata.conditions || [],
        successRate: 1.0,
        timesApplied: 0,
        createdAt: timestamp
      };
      this.patterns.set(pattern.id, pattern);
    }

    await this.saveAll();
    return skill;
  }

  async recall(params) {
    const { query, type = null, limit = 10 } = params;

    const results = [];
    const queryLower = query.toLowerCase();

    for (const [id, skill] of this.skills) {
      if (type && skill.type !== type) continue;

      let score = 0;
      if (skill.name.toLowerCase().includes(queryLower)) score += 10;
      if (skill.description.toLowerCase().includes(queryLower)) score += 8;
      if (skill.tags.some(t => t.toLowerCase().includes(queryLower))) score += 6;

      if (score > 0) {
        results.push({ ...skill, score });
      }
    }

    for (const [id, knowledge] of this.knowledge) {
      if (type && knowledge.type !== type) continue;

      let score = 0;
      if (knowledge.title.toLowerCase().includes(queryLower)) score += 10;
      if (knowledge.content.toLowerCase().includes(queryLower)) score += 8;
      if (knowledge.tags.some(t => t.toLowerCase().includes(queryLower))) score += 6;

      if (score > 0) {
        results.push({ ...knowledge, score, source: 'knowledge' });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async getPatterns() {
    return Array.from(this.patterns.values());
  }

  async addKnowledge(params) {
    const {
      title,
      content,
      type = 'note',
      source = null,
      tags = [],
      category = 'general',
      related = []
    } = params;

    const id = uuidv4();
    const knowledge = {
      id,
      title,
      content,
      type,
      source,
      tags,
      category,
      related,
      confidence: 1.0,
      timesUsed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.knowledge.set(id, knowledge);
    await this.saveAll();

    return knowledge;
  }

  async updateProficiency(skillId, success) {
    const skill = this.skills.get(skillId);
    if (!skill) return;

    skill.timesUsed++;
    skill.lastUsed = new Date().toISOString();

    if (success) {
      skill.proficiency = Math.min(1, skill.proficiency + 0.1);
    } else {
      skill.proficiency = Math.max(0, skill.proficiency - 0.05);
    }

    skill.updatedAt = new Date().toISOString();
    this.skills.set(skillId, skill);
    await this.saveAll();
  }

  async learnFromApp(params) {
    const { appName, steps = [], duration = 60000 } = params;

    this.logger.info(`Learning from app: ${appName}`);

    const observation = await this.observe({
      type: 'app-learning',
      description: `Learning from ${appName}`,
      tags: ['app-learning', appName]
    });

    const screenshots = [];
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      const screenshot = await this.automation.screenshot();
      screenshots.push(screenshot);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const skill = await this.teach({
      name: `Learned from ${appName}`,
      description: `Automatically learned interactions from ${appName}`,
      type: 'app-pattern',
      steps: steps.map((step, index) => ({
        order: index + 1,
        action: step.action,
        target: step.target,
        value: step.value,
        screenshot: screenshots[index]?.filepath
      })),
      tags: ['auto-learned', appName],
      metadata: {
        source: 'app-learning',
        screenshotCount: screenshots.length,
        duration: Date.now() - startTime
      }
    });

    return {
      observation,
      skill,
      screenshots: screenshots.length
    };
  }

  async getStats() {
    return {
      observations: this.observations.size,
      patterns: this.patterns.size,
      knowledge: this.knowledge.size,
      skills: this.skills.size,
      avgProficiency: this.getAverageProficiency()
    };
  }

  getAverageProficiency() {
    const skills = Array.from(this.skills.values());
    if (skills.length === 0) return 0;
    return skills.reduce((sum, s) => sum + s.proficiency, 0) / skills.length;
  }
}

module.exports = LearningEngine;
