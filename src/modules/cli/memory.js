/**
 * Persistent Memory — Pix AI
 * Remembers everything across ALL sessions forever
 * by Aghosh-mv · justcode
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class PersistentMemory {
  constructor(pixHome) {
    this.dir = path.join(pixHome || path.join(os.homedir(), '.pix'), 'memory');
    this.indexFile = path.join(this.dir, 'index.json');
    this.factsFile = path.join(this.dir, 'facts.json');
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
  }

  loadIndex() {
    try { return JSON.parse(fs.readFileSync(this.indexFile, 'utf8')); } catch (e) { return { entries: [], lastUpdated: null }; }
  }

  saveIndex(idx) { fs.writeFileSync(this.indexFile, JSON.stringify(idx, null, 2)); }

  loadFacts() {
    try { return JSON.parse(fs.readFileSync(this.factsFile, 'utf8')); } catch (e) { return { facts: [], userPrefs: {}, projectContext: {} }; }
  }

  saveFacts(f) { fs.writeFileSync(this.factsFile, JSON.stringify(f, null, 2)); }

  // ── Remember a fact ──
  remember(key, value, opts = {}) {
    const facts = this.loadFacts();
    const entry = {
      id: crypto.randomBytes(4).toString('hex'),
      key, value,
      category: opts.category || 'general',
      importance: opts.importance || 'normal', // low | normal | high | critical
      project: opts.project || process.cwd(),
      created: new Date().toISOString(),
      accessed: new Date().toISOString(),
      accessCount: 0,
    };
    facts.facts.push(entry);
    this.saveFacts(facts);

    // Also save to index
    const idx = this.loadIndex();
    idx.entries.push({ id: entry.id, key, category: entry.category, importance: entry.importance, created: entry.created });
    idx.lastUpdated = new Date().toISOString();
    this.saveIndex(idx);

    return entry.id;
  }

  // ── Recall facts ──
  recall(query, opts = {}) {
    const facts = this.loadFacts();
    const q = query.toLowerCase();
    let results = facts.facts.filter(f =>
      f.key.toLowerCase().includes(q) ||
      f.value.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q)
    );

    if (opts.category) results = results.filter(f => f.category === opts.category);
    if (opts.importance) results = results.filter(f => f.importance === opts.importance);
    if (opts.project) results = results.filter(f => f.project === opts.project);

    // Update access count
    results.forEach(r => {
      r.accessed = new Date().toISOString();
      r.accessCount++;
    });
    this.saveFacts(facts);

    return results.sort((a, b) => {
      const imp = { critical: 4, high: 3, normal: 2, low: 1 };
      return (imp[b.importance] || 0) - (imp[a.importance] || 0);
    });
  }

  // ── Remember user preference ──
  setPref(key, value) {
    const facts = this.loadFacts();
    facts.userPrefs[key] = value;
    this.saveFacts(facts);
  }

  getPref(key) {
    const facts = this.loadFacts();
    return facts.userPrefs[key] || null;
  }

  getAllPrefs() {
    return this.loadFacts().userPrefs;
  }

  // ── Remember project context ──
  setProjectContext(project, context) {
    const facts = this.loadFacts();
    facts.projectContext[project] = { ...facts.projectContext[project], ...context, updated: new Date().toISOString() };
    this.saveFacts(facts);
  }

  getProjectContext(project) {
    return this.loadFacts().projectContext[project] || null;
  }

  // ── Remember conversation summary ──
  rememberConversation(sessionId, summary, messages) {
    const idx = this.loadIndex();
    idx.entries.push({
      id: sessionId,
      key: `conversation: ${summary}`,
      category: 'conversation',
      importance: 'normal',
      created: new Date().toISOString(),
    });
    idx.lastUpdated = new Date().toISOString();
    this.saveIndex(idx);

    // Save full conversation
    const convFile = path.join(this.dir, `${sessionId}.json`);
    fs.writeFileSync(convFile, JSON.stringify({ sessionId, summary, messages, saved: new Date().toISOString() }, null, 2));
  }

  getConversation(sessionId) {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.dir, `${sessionId}.json`), 'utf8'));
    } catch (e) { return null; }
  }

  // ── Remember code pattern ──
  rememberPattern(name, pattern, language) {
    return this.remember(name, pattern, { category: 'code-pattern', importance: 'high' });
  }

  getPatterns(language) {
    const all = this.recall('', { category: 'code-pattern' });
    return language ? all.filter(f => f.value.includes(language)) : all;
  }

  // ── Remember error + solution ──
  rememberError(error, solution) {
    return this.remember(error, solution, { category: 'error-solution', importance: 'high' });
  }

  getSolution(error) {
    const results = this.recall(error, { category: 'error-solution' });
    return results.length > 0 ? results[0].value : null;
  }

  // ── Get full memory context for AI ──
  getFullContext(project) {
    const facts = this.loadFacts();
    const projectFacts = facts.facts.filter(f => !project || f.project === project);
    const prefs = facts.userPrefs;
    const projCtx = project ? facts.projectContext[project] : null;

    let ctx = 'PERSISTENT MEMORY:\n';
    if (Object.keys(prefs).length > 0) {
      ctx += '\nUser Preferences:\n';
      Object.entries(prefs).forEach(([k, v]) => ctx += `  ${k}: ${v}\n`);
    }
    if (projCtx) {
      ctx += `\nProject Context (${project}):\n`;
      Object.entries(projCtx).forEach(([k, v]) => ctx += `  ${k}: ${v}\n`);
    }
    if (projectFacts.length > 0) {
      ctx += `\nRemembered Facts (${projectFacts.length}):\n`;
      projectFacts.slice(-20).forEach(f => ctx += `  [${f.category}] ${f.key}: ${f.value.substring(0, 100)}\n`);
    }
    return ctx;
  }

  // ── Stats ──
  stats() {
    const facts = this.loadFacts();
    const idx = this.loadIndex();
    const cats = {};
    facts.facts.forEach(f => { cats[f.category] = (cats[f.category] || 0) + 1; });
    return {
      totalFacts: facts.facts.length,
      totalConversations: idx.entries.filter(e => e.category === 'conversation').length,
      totalPatterns: facts.facts.filter(f => f.category === 'code-pattern').length,
      totalErrors: facts.facts.filter(f => f.category === 'error-solution').length,
      categories: cats,
      userPrefs: Object.keys(facts.userPrefs).length,
      projects: Object.keys(facts.projectContext).length,
    };
  }

  // ── Clear ──
  clear(project) {
    if (project) {
      const facts = this.loadFacts();
      facts.facts = facts.facts.filter(f => f.project !== project);
      delete facts.projectContext[project];
      this.saveFacts(facts);
    } else {
      this.saveFacts({ facts: [], userPrefs: {}, projectContext: {} });
      this.saveIndex({ entries: [], lastUpdated: null });
    }
    return true;
  }
}

module.exports = PersistentMemory;
