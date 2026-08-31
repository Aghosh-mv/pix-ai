const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SessionMemory {
  constructor(pixHome) {
    this.sessionsDir = path.join(pixHome, 'sessions');
    this.contextFile = path.join(pixHome, 'context.json');
    this.memoryFile = path.join(pixHome, 'memory.json');
    if (!fs.existsSync(this.sessionsDir)) fs.mkdirSync(this.sessionsDir, { recursive: true });
  }

  createSession(project) {
    const id = crypto.randomBytes(8).toString('hex');
    const session = {
      id,
      project: project || 'unknown',
      created: new Date().toISOString(),
      messages: [],
      context: { files: [], variables: {}, decisions: [] },
      tags: []
    };
    this.saveSession(session);
    return session;
  }

  saveSession(session) {
    const file = path.join(this.sessionsDir, `${session.id}.json`);
    fs.writeFileSync(file, JSON.stringify(session, null, 2));
  }

  getSession(id) {
    const file = path.join(this.sessionsDir, `${id}.json`);
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {}
    return null;
  }

  addMessage(sessionId, role, content) {
    const session = this.getSession(sessionId);
    if (!session) return false;
    session.messages.push({ role, content, timestamp: new Date().toISOString() });
    this.saveSession(session);
    return true;
  }

  getContext(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.context : null;
  }

  updateContext(sessionId, key, value) {
    const session = this.getSession(sessionId);
    if (!session) return false;
    session.context[key] = value;
    this.saveSession(session);
    return true;
  }

  addDecision(sessionId, decision, reason) {
    const session = this.getSession(sessionId);
    if (!session) return false;
    session.context.decisions.push({ decision, reason, time: new Date().toISOString() });
    this.saveSession(session);
    return true;
  }

  addTag(sessionId, tag) {
    const session = this.getSession(sessionId);
    if (!session) return false;
    if (!session.tags.includes(tag)) session.tags.push(tag);
    this.saveSession(session);
    return true;
  }

  listSessions(project) {
    const files = fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(this.sessionsDir, f), 'utf8'));
        if (project && s.project !== project) return null;
        return { id: s.id, project: s.project, created: s.created, messages: s.messages.length, tags: s.tags };
      } catch (e) { return null; }
    }).filter(Boolean);
  }

  searchMessages(query) {
    const files = fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'));
    const results = [];
    files.forEach(f => {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(this.sessionsDir, f), 'utf8'));
        s.messages.forEach(m => {
          if (m.content.toLowerCase().includes(query.toLowerCase())) {
            results.push({ sessionId: s.id, role: m.role, content: m.content.substring(0, 200), time: m.timestamp });
          }
        });
      } catch (e) {}
    });
    return results;
  }

  getSummary(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return null;
    return {
      id: session.id,
      project: session.project,
      created: session.created,
      messageCount: session.messages.length,
      decisions: session.context.decisions || [],
      tags: session.tags,
      files: session.context.files || []
    };
  }

  deleteSession(id) {
    const file = path.join(this.sessionsDir, `${id}.json`);
    try { fs.unlinkSync(file); return true; } catch (e) { return false; }
  }

  saveLongTermMemory(key, value) {
    let memory = {};
    try {
      if (fs.existsSync(this.memoryFile)) memory = JSON.parse(fs.readFileSync(this.memoryFile, 'utf8'));
    } catch (e) {}
    memory[key] = { value, saved: new Date().toISOString() };
    fs.writeFileSync(this.memoryFile, JSON.stringify(memory, null, 2));
  }

  getLongTermMemory(key) {
    try {
      if (fs.existsSync(this.memoryFile)) {
        const memory = JSON.parse(fs.readFileSync(this.memoryFile, 'utf8'));
        return memory[key] || null;
      }
    } catch (e) {}
    return null;
  }
}

module.exports = SessionMemory;
