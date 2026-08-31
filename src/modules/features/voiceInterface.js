const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class VoiceInterface {
  constructor(pixHome) {
    this.pixHome = pixHome;
    this.commandsFile = path.join(pixHome, 'voice-commands.json');
    this.historyFile = path.join(pixHome, 'voice-history.json');
    this.loadCommands();
  }

  loadCommands() {
    try {
      if (fs.existsSync(this.commandsFile)) this.commands = JSON.parse(fs.readFileSync(this.commandsFile, 'utf8'));
    } catch (e) {}
    this.commands = this.commands || {
      'run tests': 'npm test',
      'build project': 'npm run build',
      'start server': 'npm start',
      'install deps': 'npm install',
      'git status': 'git status',
      'git push': 'git push',
      'git pull': 'git pull',
      'open editor': 'code .',
      'list files': 'ls -la',
      'clear terminal': 'clear',
      'check disk': 'df -h',
      'check memory': 'free -h'
    };
  }

  isAvailable() {
    try {
      const platform = process.platform;
      if (platform === 'darwin') {
        execSync('which say', { stdio: 'ignore' });
        return { available: true, engine: 'say (macOS)' };
      }
      if (platform === 'linux') {
        execSync('which espeak', { stdio: 'ignore' });
        return { available: true, engine: 'espeak' };
      }
      return { available: false, reason: 'No TTS engine found' };
    } catch (e) {
      return { available: false, reason: 'No TTS engine found' };
    }
  }

  speak(text) {
    const tts = this.isAvailable();
    if (!tts.available) return { error: tts.reason };

    try {
      const platform = process.platform;
      if (platform === 'darwin') {
        execSync(`say "${text.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
      } else if (platform === 'linux') {
        execSync(`espeak "${text.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
      }
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  isListeningAvailable() {
    try {
      const platform = process.platform;
      if (platform === 'darwin') {
        execSync('which automator', { stdio: 'ignore' });
        return { available: true };
      }
      return { available: false, reason: 'Voice listening not supported on this platform' };
    } catch (e) {
      return { available: false, reason: 'Voice listening not supported' };
    }
  }

  matchCommand(transcript) {
    const lower = transcript.toLowerCase().trim();
    for (const [pattern, cmd] of Object.entries(this.commands)) {
      if (lower.includes(pattern)) return { matched: true, command: pattern, action: cmd };
    }
    return { matched: false, transcript };
  }

  addCommand(phrase, action) {
    this.commands[phrase.toLowerCase()] = action;
    fs.writeFileSync(this.commandsFile, JSON.stringify(this.commands, null, 2));
    return { success: true };
  }

  removeCommand(phrase) {
    delete this.commands[phrase.toLowerCase()];
    fs.writeFileSync(this.commandsFile, JSON.stringify(this.commands, null, 2));
    return { success: true };
  }

  listCommands() {
    return Object.entries(this.commands).map(([phrase, action]) => ({ phrase, action }));
  }

  logHistory(transcript, action) {
    let history = [];
    try {
      if (fs.existsSync(this.historyFile)) history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
    } catch (e) {}
    history.push({ transcript, action, timestamp: new Date().toISOString() });
    if (history.length > 100) history = history.slice(-100);
    fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
  }

  getHistory() {
    try {
      if (fs.existsSync(this.historyFile)) return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
    } catch (e) {}
    return [];
  }
}

module.exports = VoiceInterface;
