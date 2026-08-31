const { v4: uuidv4 } = require('uuid');

class LearningPathEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.paths = new Map();
    this.milestones = new Map();
    this.progress = new Map();

    this.topicCategories = [
      { id: 'programming', name: 'Programming', icon: '💻', description: 'Programming languages and concepts' },
      { id: 'web-dev', name: 'Web Development', icon: '🌐', description: 'Web development skills' },
      { id: 'data-science', name: 'Data Science', icon: '📊', description: 'Data science and ML' },
      { id: 'devops', name: 'DevOps', icon: '🚀', description: 'DevOps and infrastructure' },
      { id: 'design', name: 'Design', icon: '🎨', description: 'UI/UX design' },
      { id: 'security', name: 'Security', icon: '🛡️', description: 'Cybersecurity' },
      { id: 'mobile', name: 'Mobile Dev', icon: '📱', description: 'Mobile development' },
      { id: 'ai', name: 'AI/ML', icon: '🤖', description: 'Artificial Intelligence' }
    ];

    this.difficultyLevels = [
      { id: 'beginner', name: 'Beginner', icon: '🌱', description: 'Just starting out' },
      { id: 'intermediate', name: 'Intermediate', icon: '🌿', description: 'Some experience' },
      { id: 'advanced', name: 'Advanced', icon: '🌳', description: 'Experienced' },
      { id: 'expert', name: 'Expert', icon: '🏔️', description: 'Deep expertise' }
    ];

    this.resourceTypes = [
      { id: 'article', name: 'Article', icon: '📄', description: 'Written content' },
      { id: 'video', name: 'Video', icon: '🎬', description: 'Video tutorial' },
      { id: 'exercise', name: 'Exercise', icon: '🏋️', description: 'Hands-on practice' },
      { id: 'project', name: 'Project', icon: '📁', description: 'Build something' },
      { id: 'quiz', name: 'Quiz', icon: '❓', description: 'Test knowledge' },
      { id: 'code-review', name: 'Code Review', icon: '👁️', description: 'Review examples' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Learning Path Engine...');
    this.loadSettings();
    this.logger.info('Learning Path Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, maxPaths: 50, autoRecommend: true, trackProgress: true };
  }

  createPath(params) {
    const { name, topic = 'programming', difficulty = 'beginner', description = '', milestones = [] } = params;
    const id = uuidv4();
    const path = { id, name, topic, difficulty, description, milestones, progress: 0, status: 'active', createdAt: new Date().toISOString() };
    this.paths.set(id, path);
    return path;
  }

  addMilestone(params) {
    const { pathId, name = '', description = '', resources = [], order = 0 } = params;
    const id = uuidv4();
    const milestone = { id, pathId, name, description, resources, order, status: 'pending', completedAt: null };
    this.milestones.set(id, milestone);
    const path = this.paths.get(pathId);
    if (path) { path.milestones.push(id); this.paths.set(pathId, path); }
    return milestone;
  }

  getPath(id) { return this.paths.get(id); }
  listPaths(topic = null) { let p = Array.from(this.paths.values()); if (topic) p = p.filter(x => x.topic === topic); return p; }
  getMilestone(id) { return this.milestones.get(id); }
  getTopicCategories() { return this.topicCategories; }
  getDifficultyLevels() { return this.difficultyLevels; }
  getResourceTypes() { return this.resourceTypes; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { paths: this.paths.size, milestones: this.milestones.size, completed: Array.from(this.milestones.values()).filter(m => m.status === 'completed').length };
  }
}

module.exports = LearningPathEngine;
