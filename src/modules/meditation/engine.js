const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MeditationEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.sounds = new Map();
    this.goals = new Map();
    this.meditationDir = path.join(os.homedir(), '.pix/meditation');
  }

  async initialize() {
    this.logger.info('Initializing Meditation Engine...');
    await fs.ensureDir(this.meditationDir);
    await this.loadSessions();
    this.loadDefaultSounds();
    this.loadDefaultGuidedSessions();
    this.logger.info('Meditation Engine initialized');
  }

  async loadSessions() {
    try {
      const files = await fs.readdir(this.meditationDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const session = await fs.readJson(path.join(this.meditationDir, file));
          this.sessions.set(session.id, session);
        }
      }
    } catch (e) {}
  }

  loadDefaultSounds() {
    const defaultSounds = [
      { id: 'rain', name: 'Rain', category: 'nature', duration: 60, file: 'rain.mp3' },
      { id: 'ocean', name: 'Ocean Waves', category: 'nature', duration: 60, file: 'ocean.mp3' },
      { id: 'forest', name: 'Forest', category: 'nature', duration: 60, file: 'forest.mp3' },
      { id: 'white-noise', name: 'White Noise', category: 'ambient', duration: 60, file: 'white-noise.mp3' },
      { id: 'brown-noise', name: 'Brown Noise', category: 'ambient', duration: 60, file: 'brown-noise.mp3' },
      { id: 'singing-bowls', name: 'Singing Bowls', category: 'meditation', duration: 60, file: 'bowls.mp3' },
      { id: 'tibetan-bells', name: 'Tibetan Bells', category: 'meditation', duration: 60, file: 'bells.mp3' }
    ];

    defaultSounds.forEach(sound => {
      if (!this.sounds.has(sound.id)) {
        this.sounds.set(sound.id, { ...sound, createdAt: new Date().toISOString() });
      }
    });
  }

  loadDefaultGuidedSessions() {
    this.guidedSessions = [
      {
        id: 'beginner-mindfulness',
        title: 'Beginner Mindfulness',
        duration: 5,
        category: 'mindfulness',
        description: 'A gentle introduction to mindfulness meditation',
        steps: [
          { duration: 60, instruction: 'Find a comfortable seated position' },
          { duration: 60, instruction: 'Close your eyes and take three deep breaths' },
          { duration: 120, instruction: 'Focus on the sensation of breathing' },
          { duration: 60, instruction: 'Notice thoughts without judgment' },
          { duration: 60, instruction: 'Slowly open your eyes' }
        ]
      },
      {
        id: 'stress-relief',
        title: 'Quick Stress Relief',
        duration: 3,
        category: 'stress',
        description: 'A quick session to relieve stress',
        steps: [
          { duration: 30, instruction: 'Take a deep breath in' },
          { duration: 30, instruction: 'Exhale slowly and completely' },
          { duration: 60, instruction: 'Tense and release your shoulders' },
          { duration: 60, instruction: 'Focus on releasing tension' }
        ]
      },
      {
        id: 'sleep-meditation',
        title: 'Sleep Meditation',
        duration: 10,
        category: 'sleep',
        description: 'Guided meditation to help you fall asleep',
        steps: [
          { duration: 60, instruction: 'Lie down comfortably' },
          { duration: 120, instruction: 'Scan your body from toes to head' },
          { duration: 120, instruction: 'Release any tension you find' },
          { duration: 180, instruction: 'Focus on your breathing' },
          { duration: 120, instruction: 'Allow yourself to drift off' }
        ]
      },
      {
        id: 'focus-enhancement',
        title: 'Focus Enhancement',
        duration: 7,
        category: 'focus',
        description: 'Improve your concentration',
        steps: [
          { duration: 60, instruction: 'Set an intention to focus' },
          { duration: 120, instruction: 'Choose a point of focus' },
          { duration: 120, instruction: 'When distracted, gently return' },
          { duration: 120, instruction: 'Expand awareness gradually' },
          { duration: 60, instruction: 'Carry this focus forward' }
        ]
      }
    ];
  }

  async createSession(params) {
    const {
      type = 'free',
      duration = 0,
      notes = '',
      sound = null,
      guidedSession = null,
      mood = null
    } = params;

    const id = uuidv4();
    const session = {
      id,
      type,
      duration,
      notes,
      sound,
      guidedSession,
      mood,
      startedAt: new Date().toISOString(),
      completedAt: null,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.sessions.set(id, session);
    await this.saveSession(session);

    return session;
  }

  async completeSession(id, notes = '') {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    session.completed = true;
    session.completedAt = new Date().toISOString();
    session.notes = notes || session.notes;

    this.sessions.set(id, session);
    await this.saveSession(session);

    return session;
  }

  async deleteSession(id) {
    this.sessions.delete(id);
    await fs.remove(path.join(this.meditationDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getSession(id) {
    return this.sessions.get(id);
  }

  listSessions(options = {}) {
    const { type, completed, limit = 50 } = options;

    let sessions = Array.from(this.sessions.values());

    if (type) sessions = sessions.filter(s => s.type === type);
    if (completed !== undefined) sessions = sessions.filter(s => s.completed === completed);

    return sessions
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .slice(0, limit);
  }

  async createGoal(params) {
    const { type = 'daily', targetMinutes = 10, targetDays = 30 } = params;
    const id = uuidv4();

    const goal = {
      id,
      type,
      targetMinutes,
      targetDays,
      currentStreak: 0,
      longestStreak: 0,
      totalMinutes: 0,
      completedDates: [],
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

  async logMeditation(goalId, minutes) {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal not found: ${goalId}`);

    goal.totalMinutes += minutes;
    goal.completedDates.push(new Date().toISOString().split('T')[0]);

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (goal.completedDates.includes(yesterday)) {
      goal.currentStreak++;
    } else {
      goal.currentStreak = 1;
    }

    if (goal.currentStreak > goal.longestStreak) {
      goal.longestStreak = goal.currentStreak;
    }

    this.goals.set(goalId, goal);
    return goal;
  }

  listGoals() {
    return Array.from(this.goals.values());
  }

  getGuidedSessions() {
    return this.guidedSessions;
  }

  getSounds() {
    return Array.from(this.sounds.values());
  }

  async getStats() {
    const sessions = Array.from(this.sessions.values());
    const completed = sessions.filter(s => s.completed);
    const totalMinutes = completed.reduce((sum, s) => sum + s.duration, 0);

    return {
      totalSessions: sessions.length,
      completedSessions: completed.length,
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      goals: this.goals.size,
      byType: this.getSessionsByType()
    };
  }

  getSessionsByType() {
    const sessions = Array.from(this.sessions.values());
    const byType = {};

    for (const session of sessions) {
      byType[session.type] = (byType[session.type] || 0) + 1;
    }

    return byType;
  }

  async saveSession(session) {
    const filePath = path.join(this.meditationDir, `${session.id}.json`);
    await fs.writeJson(filePath, session, { spaces: 2 });
  }

  async exportSessions(format = 'json') {
    const sessions = Array.from(this.sessions.values());

    if (format === 'json') {
      return JSON.stringify(sessions, null, 2);
    }

    return sessions;
  }
}

module.exports = MeditationEngine;
