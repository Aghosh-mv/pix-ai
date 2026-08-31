const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class Dashboard {
  constructor(pixHome) {
    this.pixHome = pixHome;
    this.analyticsFile = path.join(pixHome, 'analytics.json');
    this.goalsFile = path.join(pixHome, 'goals.json');
  }

  getSystemInfo() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const uptime = os.uptime();

    return {
      platform: `${os.platform()} ${os.arch()}`,
      node: process.version,
      hostname: os.hostname(),
      cpus: cpus.length,
      cpuModel: cpus[0]?.model || 'unknown',
      loadAverage: { '1m': loadAvg[0].toFixed(2), '5m': loadAvg[1].toFixed(2), '15m': loadAvg[2].toFixed(2) },
      memory: {
        total: this.formatBytes(totalMem),
        free: this.formatBytes(freeMem),
        used: this.formatBytes(totalMem - freeMem),
        percent: ((1 - freeMem / totalMem) * 100).toFixed(1)
      },
      uptime: this.formatUptime(uptime),
      disk: this.getDiskInfo()
    };
  }

  getDiskInfo() {
    try {
      const output = execSync('df -h /', { encoding: 'utf8' });
      const lines = output.split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        return { size: parts[1], used: parts[2], available: parts[3], percent: parts[4] };
      }
    } catch (e) {}
    return null;
  }

  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${bytes.toFixed(1)} ${units[i]}`;
  }

  formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  logEvent(event, data) {
    let analytics = { events: [], stats: {} };
    try {
      if (fs.existsSync(this.analyticsFile)) analytics = JSON.parse(fs.readFileSync(this.analyticsFile, 'utf8'));
    } catch (e) {}

    analytics.events.push({ event, data, timestamp: new Date().toISOString() });
    if (analytics.events.length > 1000) analytics.events = analytics.events.slice(-1000);

    analytics.stats[event] = (analytics.stats[event] || 0) + 1;
    analytics.stats.lastEvent = new Date().toISOString();
    analytics.stats.totalEvents = (analytics.stats.totalEvents || 0) + 1;

    fs.writeFileSync(this.analyticsFile, JSON.stringify(analytics, null, 2));
  }

  getStats() {
    let analytics = { events: [], stats: {} };
    try {
      if (fs.existsSync(this.analyticsFile)) analytics = JSON.parse(fs.readFileSync(this.analyticsFile, 'utf8'));
    } catch (e) {}
    return analytics.stats;
  }

  getRecentEvents(limit = 20) {
    let analytics = { events: [] };
    try {
      if (fs.existsSync(this.analyticsFile)) analytics = JSON.parse(fs.readFileSync(this.analyticsFile, 'utf8'));
    } catch (e) {}
    return analytics.events.slice(-limit).reverse();
  }

  getEventsByHour() {
    let analytics = { events: [] };
    try {
      if (fs.existsSync(this.analyticsFile)) analytics = JSON.parse(fs.readFileSync(this.analyticsFile, 'utf8'));
    } catch (e) {}
    const hours = {};
    analytics.events.forEach(e => {
      const hour = new Date(e.timestamp).getHours();
      hours[hour] = (hours[hour] || 0) + 1;
    });
    return hours;
  }

  setGoal(goal) {
    let goals = [];
    try {
      if (fs.existsSync(this.goalsFile)) goals = JSON.parse(fs.readFileSync(this.goalsFile, 'utf8'));
    } catch (e) {}
    goals.push({ id: Date.now().toString(36), text: goal, created: new Date().toISOString(), completed: false });
    fs.writeFileSync(this.goalsFile, JSON.stringify(goals, null, 2));
    return goals;
  }

  completeGoal(goalId) {
    let goals = [];
    try {
      if (fs.existsSync(this.goalsFile)) goals = JSON.parse(fs.readFileSync(this.goalsFile, 'utf8'));
    } catch (e) {}
    goals = goals.map(g => g.id === goalId ? { ...g, completed: true, completedAt: new Date().toISOString() } : g);
    fs.writeFileSync(this.goalsFile, JSON.stringify(goals, null, 2));
    return goals;
  }

  getGoals() {
    try {
      if (fs.existsSync(this.goalsFile)) return JSON.parse(fs.readFileSync(this.goalsFile, 'utf8'));
    } catch (e) {}
    return [];
  }

  getProjectStats(projectRoot) {
    const stats = { files: 0, lines: 0, languages: {} };
    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.forEach(e => {
          const full = path.join(dir, e.name);
          if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist') walk(full);
          else if (e.isFile()) {
            const ext = path.extname(e.name);
            if (ext) {
              stats.files++;
              stats.languages[ext] = (stats.languages[ext] || 0) + 1;
              try {
                const content = fs.readFileSync(full, 'utf8');
                stats.lines += content.split('\n').length;
              } catch (e) {}
            }
          }
        });
      } catch (e) {}
    };
    walk(projectRoot);
    return stats;
  }
}

module.exports = Dashboard;
