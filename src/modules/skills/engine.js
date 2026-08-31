const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class SkillEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.skills = new Map();
    this.courses = new Map();
    this.goals = new Map();
    this.skillDir = path.join(os.homedir(), '.pix/skills');
  }

  async initialize() {
    this.logger.info('Initializing Skill Engine...');
    await fs.ensureDir(this.skillDir);
    await this.loadSkills();
    this.loadSkillCategories();
    this.logger.info('Skill Engine initialized');
  }

  async loadSkills() {
    try {
      const files = await fs.readdir(this.skillDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const skill = await fs.readJson(path.join(this.skillDir, file));
          this.skills.set(skill.id, skill);
        }
      }
    } catch (e) {}
  }

  loadSkillCategories() {
    this.categories = [
      { id: 'programming', name: 'Programming', icon: '💻' },
      { id: 'design', name: 'Design', icon: '🎨' },
      { id: 'business', name: 'Business', icon: '💼' },
      { id: 'language', name: 'Language', icon: '🗣️' },
      { id: 'music', name: 'Music', icon: '🎵' },
      { id: 'cooking', name: 'Cooking', icon: '👨‍🍳' },
      { id: 'fitness', name: 'Fitness', icon: '💪' },
      { id: 'creative', name: 'Creative', icon: '✨' },
      { id: 'academic', name: 'Academic', icon: '📚' },
      { id: 'life', name: 'Life Skills', icon: '🌟' }
    ];
  }

  async createSkill(params) {
    const {
      name,
      category,
      level = 'beginner',
      description = '',
      goals = [],
      notes = '',
      practiceHours = 0,
      lastPracticed = null
    } = params;

    const id = uuidv4();
    const skill = {
      id,
      name,
      category,
      level,
      description,
      goals,
      notes,
      practiceHours,
      lastPracticed: lastPracticed ? new Date(lastPracticed).toISOString() : null,
      milestones: [],
      resources: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.skills.set(id, skill);
    await this.saveSkill(skill);

    this.logger.info(`Skill added: ${name}`);
    return skill;
  }

  async updateSkill(id, updates) {
    const skill = this.skills.get(id);
    if (!skill) throw new Error(`Skill not found: ${id}`);

    const updated = {
      ...skill,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.skills.set(id, updated);
    await this.saveSkill(updated);

    return updated;
  }

  async deleteSkill(id) {
    this.skills.delete(id);
    await fs.remove(path.join(this.skillDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getSkill(id) {
    return this.skills.get(id);
  }

  listSkills(options = {}) {
    const { category, level, search } = options;

    let skills = Array.from(this.skills.values());

    if (category) skills = skills.filter(s => s.category === category);
    if (level) skills = skills.filter(s => s.level === level);
    if (search) {
      const searchLower = search.toLowerCase();
      skills = skills.filter(s => s.name.toLowerCase().includes(searchLower));
    }

    return skills;
  }

  async addMilestone(params) {
    const { skillId, title, description = '', achievedDate = new Date().toISOString() } = params;
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);

    skill.milestones.push({
      id: uuidv4(),
      title,
      description,
      achievedDate: new Date(achievedDate).toISOString()
    });

    skill.updatedAt = new Date().toISOString();
    this.skills.set(skillId, skill);
    await this.saveSkill(skill);

    return skill;
  }

  async addResource(params) {
    const { skillId, title, url, type = 'link', notes = '' } = params;
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);

    skill.resources.push({
      id: uuidv4(),
      title,
      url,
      type,
      notes
    });

    skill.updatedAt = new Date().toISOString();
    this.skills.set(skillId, skill);
    await this.saveSkill(skill);

    return skill;
  }

  async logPractice(skillId, hours, notes = '') {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);

    skill.practiceHours += hours;
    skill.lastPracticed = new Date().toISOString();
    skill.updatedAt = new Date().toISOString();

    if (!skill.practiceLog) skill.practiceLog = [];
    skill.practiceLog.push({
      date: new Date().toISOString(),
      hours,
      notes
    });

    this.skills.set(skillId, skill);
    await this.saveSkill(skill);

    return skill;
  }

  async levelUp(skillId) {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);

    const levels = ['beginner', 'intermediate', 'advanced', 'expert', 'master'];
    const currentIndex = levels.indexOf(skill.level);

    if (currentIndex < levels.length - 1) {
      skill.level = levels[currentIndex + 1];
      skill.updatedAt = new Date().toISOString();
      this.skills.set(skillId, skill);
      await this.saveSkill(skill);
    }

    return skill;
  }

  async createCourse(params) {
    const {
      name,
      skillId,
      platform = '',
      url = '',
      instructor = '',
      duration = '',
      progress = 0,
      notes = ''
    } = params;

    const id = uuidv4();
    const course = {
      id,
      name,
      skillId,
      platform,
      url,
      instructor,
      duration,
      progress,
      notes,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.courses.set(id, course);
    return course;
  }

  async updateCourse(id, updates) {
    const course = this.courses.get(id);
    if (!course) throw new Error(`Course not found: ${id}`);

    const updated = { ...course, ...updates };
    this.courses.set(id, updated);
    return updated;
  }

  async completeCourse(id) {
    const course = this.courses.get(id);
    if (!course) throw new Error(`Course not found: ${id}`);

    course.completed = true;
    course.progress = 100;
    course.completedAt = new Date().toISOString();
    this.courses.set(id, course);

    return course;
  }

  listCourses(skillId = null) {
    const courses = Array.from(this.courses.values());
    if (skillId) {
      return courses.filter(c => c.skillId === skillId);
    }
    return courses;
  }

  async createGoal(params) {
    const { skillId, title, targetDate = null, targetHours = 0 } = params;
    const id = uuidv4();

    const goal = {
      id,
      skillId,
      title,
      targetDate: targetDate ? new Date(targetDate).toISOString() : null,
      targetHours,
      currentHours: 0,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.goals.set(id, goal);
    return goal;
  }

  async updateGoal(id, updates) {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal not found: ${id}`);

    const updated = { ...goal, ...updates };
    this.goals.set(id, updated);
    return updated;
  }

  async completeGoal(id) {
    const goal = this.goals.get(id);
    if (!goal) throw new Error(`Goal not found: ${id}`);

    goal.completed = true;
    goal.completedAt = new Date().toISOString();
    this.goals.set(id, goal);

    return goal;
  }

  listGoals(skillId = null) {
    const goals = Array.from(this.goals.values());
    if (skillId) {
      return goals.filter(g => g.skillId === skillId);
    }
    return goals;
  }

  getCategories() {
    return this.categories;
  }

  async getStats() {
    const skills = Array.from(this.skills.values());
    const totalHours = skills.reduce((sum, s) => sum + s.practiceHours, 0);
    const byLevel = {};
    const byCategory = {};

    for (const skill of skills) {
      byLevel[skill.level] = (byLevel[skill.level] || 0) + 1;
      byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
    }

    return {
      totalSkills: skills.length,
      totalHours,
      byLevel,
      byCategory,
      courses: this.courses.size,
      goals: this.goals.size
    };
  }

  async saveSkill(skill) {
    const filePath = path.join(this.skillDir, `${skill.id}.json`);
    await fs.writeJson(filePath, skill, { spaces: 2 });
  }

  async exportSkills(format = 'json') {
    const skills = Array.from(this.skills.values());

    if (format === 'json') {
      return JSON.stringify(skills, null, 2);
    }

    return skills;
  }
}

module.exports = SkillEngine;
