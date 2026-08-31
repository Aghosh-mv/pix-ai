const { v4: uuidv4 } = require('uuid');

class FocusModeEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.pomodoros = new Map();
    this.blockedApps = new Map();
    this.stats = new Map();

    this.focusModes = [
      { id: 'deep-work', name: 'Deep Work', icon: '🧠', description: 'Maximum focus, block everything', duration: 120, breakDuration: 15 },
      { id: 'pomodoro', name: 'Pomodoro', icon: '🍅', description: '25min work, 5min break', duration: 25, breakDuration: 5 },
      { id: 'flow', name: 'Flow State', icon: '🌊', description: 'Extended focus until natural break', duration: 90, breakDuration: 10 },
      { id: 'sprint', name: 'Sprint', icon: '⚡', description: 'Short intense burst', duration: 15, breakDuration: 3 },
      { id: 'marathon', name: 'Marathon', icon: '🏃', description: 'Long session with breaks', duration: 180, breakDuration: 20 },
      { id: 'custom', name: 'Custom', icon: '🔧', description: 'Custom focus duration', duration: 60, breakDuration: 10 }
    ];

    this.blockTypes = [
      { id: 'notifications', name: 'Notifications', icon: '🔔', description: 'Block all notifications' },
      { id: 'social-media', name: 'Social Media', icon: '📱', description: 'Block social media' },
      { id: 'news', name: 'News Sites', icon: '📰', description: 'Block news sites' },
      { id: 'entertainment', name: 'Entertainment', icon: '🎮', description: 'Block entertainment' },
      { id: 'email', name: 'Email', icon: '📧', description: 'Block email' },
      { id: 'chat', name: 'Chat Apps', icon: '💬', description: 'Block chat apps' },
      { id: 'custom-list', name: 'Custom List', icon: '📋', description: 'Block custom list' }
    ];

    this.distractionLevels = [
      { id: 'minimal', name: 'Minimal', icon: '🔇', description: 'Block only critical distractions' },
      { id: 'moderate', name: 'Moderate', icon: '🔉', description: 'Block most distractions' },
      { id: 'maximum', name: 'Maximum', icon: '🔊', description: 'Block everything possible' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Focus Mode Engine...');
    this.loadSettings();
    this.logger.info('Focus Mode Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: true, defaultMode: 'pomodoro', autoStart: false, soundEnabled: true, volume: 0.5 };
  }

  startFocus(params) {
    const { mode = 'pomodoro', blocks = ['notifications'], distractionLevel = 'moderate' } = params;
    const id = uuidv4();
    const session = { id, mode, blocks, distractionLevel, status: 'active', startedAt: new Date().toISOString(), breaks: 0, duration: 0 };
    this.sessions.set(id, session);
    return session;
  }

  endFocus(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error('Session not found');
    session.status = 'completed';
    session.endedAt = new Date().toISOString();
    session.duration = new Date(session.endedAt) - new Date(session.startedAt);
    this.sessions.set(id, session);
    return session;
  }

  startPomodoro(params) {
    const { workDuration = 25, breakDuration = 5, sessions = 4 } = params;
    const id = uuidv4();
    const pom = { id, workDuration, breakDuration, totalSessions: sessions, currentSession: 0, status: 'ready', createdAt: new Date().toISOString() };
    this.pomodoros.set(id, pom);
    return pom;
  }

  getSession(id) { return this.sessions.get(id); }
  listSessions() { return Array.from(this.sessions.values()); }
  getFocusModes() { return this.focusModes; }
  getBlockTypes() { return this.blockTypes; }
  getDistractionLevels() { return this.distractionLevels; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { sessions: this.sessions.size, active: Array.from(this.sessions.values()).filter(s => s.status === 'active').length, pomodoros: this.pomodoros.size };
  }
}

module.exports = FocusModeEngine;
