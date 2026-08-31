const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

class AutoUpdater {
  constructor(configPath, cachePath) {
    this.configPath = configPath;
    this.cachePath = cachePath;
    this.config = this.loadConfig();
    this.updateFile = path.join(cachePath, '.last-update-check');
    this.notifiedFile = path.join(cachePath, '.update-notified');
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch (e) {}
    return {};
  }

  async checkForUpdates(currentVersion) {
    if (!this.config.autoUpdate) return null;
    const lastCheck = this.getLastCheckTime();
    const now = Date.now();
    if (lastCheck && (now - lastCheck) < 3600000) return null;

    try {
      const npmVersion = await this.getNpmVersion('pix-ai');
      this.setLastCheckTime(now);
      if (npmVersion && this.isNewer(npmVersion, currentVersion)) {
        return { current: currentVersion, latest: npmVersion, urgent: this.isMajorUpdate(currentVersion, npmVersion) };
      }
    } catch (e) {}
    return null;
  }

  getNpmVersion(packageName) {
    return new Promise((resolve, reject) => {
      const req = https.get(`https://registry.npmjs.org/${packageName}/latest`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data).version); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  isNewer(latest, current) {
    const l = latest.split('.').map(Number);
    const c = current.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((l[i] || 0) > (c[i] || 0)) return true;
      if ((l[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
  }

  isMajorUpdate(current, latest) {
    return latest.split('.')[0] > current.split('.')[0];
  }

  getLastCheckTime() {
    try {
      if (fs.existsSync(this.updateFile)) return parseInt(fs.readFileSync(this.updateFile, 'utf8'));
    } catch (e) {}
    return null;
  }

  setLastCheckTime(time) {
    try { fs.writeFileSync(this.updateFile, String(time)); } catch (e) {}
  }

  wasNotified(version) {
    try {
      if (fs.existsSync(this.notifiedFile)) {
        return fs.readFileSync(this.notifiedFile, 'utf8').trim() === version;
      }
    } catch (e) {}
    return false;
  }

  markNotified(version) {
    try { fs.writeFileSync(this.notifiedFile, version); } catch (e) {}
  }

  async performUpdate(version) {
    try {
      execSync(`npm install -g pix-ai@${version}`, { stdio: 'inherit' });
      return true;
    } catch (e) {
      return false;
    }
  }

  async selfUpdate(version) {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.version = version;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
      return true;
    } catch (e) {
      return false;
    }
  }

  getChangelog(current, latest) {
    const changes = [];
    const c = current.split('.').map(Number);
    const l = latest.split('.').map(Number);
    if (l[0] > c[0]) changes.push('Major version update - new features and breaking changes');
    if (l[1] > c[1]) changes.push('New features added');
    if (l[2] > c[2]) changes.push('Bug fixes and improvements');
    return changes;
  }
}

module.exports = AutoUpdater;
