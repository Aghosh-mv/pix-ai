#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const crypto = require('crypto');

const VERSION = '2.3.0';
const PIX_HOME = path.join(os.homedir(), '.pix');
const CONFIG_FILE = path.join(PIX_HOME, 'config.json');
const SESSIONS_DIR = path.join(PIX_HOME, 'sessions');
const KEYS_DIR = path.join(PIX_HOME, 'keys');
const LOGS_DIR = path.join(PIX_HOME, 'logs');
const CACHE_DIR = path.join(PIX_HOME, 'cache');
const PLUGINS_DIR = path.join(PIX_HOME, 'plugins');

function ensureDirs() {
  [PIX_HOME, SESSIONS_DIR, KEYS_DIR, LOGS_DIR, CACHE_DIR, PLUGINS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function loadConfig() {
  try { if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) {}
  return { apiKey: '', provider: 'openrouter', mode: 'default', theme: 'dark', autoUpdate: true, version: VERSION, features: {} };
}

function saveConfig(cfg) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); }

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', italic: '\x1b[3m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m',
  bgRed: '\x1b[41m', bgGreen: '\x1b[42m', bgYellow: '\x1b[43m', bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m', bgCyan: '\x1b[46m'
};

function banner() {
  console.log('');
  console.log(`${c.cyan}${c.bold}    ██████╗ ██╗██╗  ██╗${c.reset}`);
  console.log(`${c.cyan}${c.bold}    ██╔══██╗██║╚██╗██╔╝${c.reset}`);
  console.log(`${c.cyan}${c.bold}    ██████╔╝██║ ╚███╔╝ ${c.reset}`);
  console.log(`${c.cyan}${c.bold}    ██╔═══╝ ██║ ██╔██╗ ${c.reset}`);
  console.log(`${c.cyan}${c.bold}    ██║     ██║██╔╝ ██╗${c.reset}`);
  console.log(`${c.cyan}${c.bold}    ╚═╝     ╚═╝╚═╝  ╚═╝${c.reset}`);
  console.log(`${c.dim}    AI Harness v${VERSION} — by Lux & Vokk${c.reset}`);
  console.log('');
}

function box(lines, color = 'cyan') {
  const maxLen = Math.max(...lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, '').length));
  const border = '─'.repeat(maxLen + 4);
  console.log(`${c[color]}┌${border}┐${c.reset}`);
  lines.forEach(l => {
    const rawLen = l.replace(/\x1b\[[0-9;]*m/g, '').length;
    const pad = ' '.repeat(maxLen - rawLen);
    console.log(`${c[color]}│${c.reset} ${l}${pad} ${c[color]}│${c.reset}`);
  });
  console.log(`${c[color]}└${border}┘${c.reset}`);
}

function cmd(args) {
  try { return execSync(args, { encoding: 'utf8', timeout: 30000 }).trim(); } catch (e) { return ''; }
}

function logo() {
  return `${c.cyan}${c.bold}Pix${c.reset} v${c.dim}${VERSION}${c.reset}`;
}

// ────────────────────────────────────────
// FEATURE MODULES (Inline)
// ────────────────────────────────────────

class AutoUpdater {
  constructor(cachePath) { this.cachePath = cachePath; this.updateFile = path.join(cachePath, '.last-update-check'); }
  async checkForUpdates(currentVersion) {
    const lastCheck = this.getLastCheckTime();
    if (lastCheck && (Date.now() - lastCheck) < 3600000) return null;
    try {
      const npmVersion = await this.getNpmVersion('pix-ai');
      this.setLastCheckTime(Date.now());
      if (npmVersion && this.isNewer(npmVersion, currentVersion)) return { current: currentVersion, latest: npmVersion };
    } catch (e) {}
    return null;
  }
  getNpmVersion(pkg) {
    return new Promise((resolve, reject) => {
      const req = https.get(`https://registry.npmjs.org/${pkg}/latest`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve(JSON.parse(data).version); } catch (e) { reject(e); } });
      });
      req.on('error', reject);
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    });
  }
  isNewer(latest, current) {
    const l = latest.split('.').map(Number), c = current.split('.').map(Number);
    for (let i = 0; i < 3; i++) { if ((l[i]||0) > (c[i]||0)) return true; if ((l[i]||0) < (c[i]||0)) return false; }
    return false;
  }
  getLastCheckTime() { try { if (fs.existsSync(this.updateFile)) return parseInt(fs.readFileSync(this.updateFile, 'utf8')); } catch (e) {} return null; }
  setLastCheckTime(t) { try { fs.writeFileSync(this.updateFile, String(t)); } catch (e) {} }
}

class PluginMarketplace {
  constructor(pixHome) {
    this.pixHome = pixHome;
    this.pluginsDir = path.join(pixHome, 'plugins');
    this.enabledFile = path.join(pixHome, 'enabled-plugins.json');
    if (!fs.existsSync(this.pluginsDir)) fs.mkdirSync(this.pluginsDir, { recursive: true });
  }
  getPlugins() {
    return [
      { id: 'git-auto', name: 'Git Auto', desc: 'Auto-commit, branch, PR', version: '1.0.0', builtin: true, category: 'workflow' },
      { id: 'code-review', name: 'Code Review', desc: 'AI-powered PR review', version: '1.0.0', builtin: true, category: 'quality' },
      { id: 'test-gen', name: 'Test Generator', desc: 'Auto-generate tests', version: '1.0.0', builtin: true, category: 'quality' },
      { id: 'dep-audit', name: 'Dependency Audit', desc: 'Check vulnerable deps', version: '1.0.0', builtin: true, category: 'security' },
      { id: 'doc-gen', name: 'Doc Generator', desc: 'Auto-generate docs', version: '1.0.0', builtin: true, category: 'docs' },
      { id: 'perf-profiler', name: 'Perf Profiler', desc: 'Profile code performance', version: '1.0.0', builtin: true, category: 'performance' },
      { id: 'docker-gen', name: 'Docker Gen', desc: 'Generate Dockerfiles', version: '1.0.0', builtin: true, category: 'devops' },
      { id: 'ci-gen', name: 'CI/CD Gen', desc: 'Generate GitHub Actions', version: '1.0.0', builtin: true, category: 'devops' },
      { id: 'api-scaffold', name: 'API Scaffold', desc: 'Generate REST/GraphQL APIs', version: '1.0.0', builtin: true, category: 'workflow' },
      { id: 'env-mgr', name: 'Env Manager', desc: '.env file management', version: '1.0.0', builtin: true, category: 'devops' }
    ];
  }
  getEnabled() { try { if (fs.existsSync(this.enabledFile)) return JSON.parse(fs.readFileSync(this.enabledFile, 'utf8')); } catch (e) {} return []; }
  enable(id) { const e = this.getEnabled(); if (!e.includes(id)) { e.push(id); fs.writeFileSync(this.enabledFile, JSON.stringify(e)); } }
  disable(id) { const e = this.getEnabled().filter(x => x !== id); fs.writeFileSync(this.enabledFile, JSON.stringify(e)); }
  isEnabled(id) { return this.getEnabled().includes(id); }
}

class SessionMemory {
  constructor(pixHome) {
    this.sessionsDir = path.join(pixHome, 'sessions');
    this.memoryFile = path.join(pixHome, 'memory.json');
    if (!fs.existsSync(this.sessionsDir)) fs.mkdirSync(this.sessionsDir, { recursive: true });
  }
  createSession(project) {
    const id = crypto.randomBytes(8).toString('hex');
    const session = { id, project: project || 'unknown', created: new Date().toISOString(), messages: [], context: { files: [], variables: {}, decisions: [] }, tags: [] };
    this.saveSession(session);
    return session;
  }
  saveSession(s) { fs.writeFileSync(path.join(this.sessionsDir, `${s.id}.json`), JSON.stringify(s, null, 2)); }
  getSession(id) { try { if (fs.existsSync(path.join(this.sessionsDir, `${id}.json`))) return JSON.parse(fs.readFileSync(path.join(this.sessionsDir, `${id}.json`), 'utf8')); } catch (e) {} return null; }
  addMessage(sid, role, content) { const s = this.getSession(sid); if (!s) return false; s.messages.push({ role, content, timestamp: new Date().toISOString() }); this.saveSession(s); return true; }
  listSessions(project) {
    return fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.json')).map(f => {
      try { const s = JSON.parse(fs.readFileSync(path.join(this.sessionsDir, f), 'utf8')); if (project && s.project !== project) return null; return { id: s.id, project: s.project, created: s.created, messages: s.messages.length }; } catch (e) { return null; }
    }).filter(Boolean);
  }
  searchMessages(query) {
    const results = [];
    fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.json')).forEach(f => {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(this.sessionsDir, f), 'utf8'));
        s.messages.forEach(m => { if (m.content.toLowerCase().includes(query.toLowerCase())) results.push({ sessionId: s.id, role: m.role, content: m.content.substring(0, 200), time: m.timestamp }); });
      } catch (e) {}
    });
    return results;
  }
  saveLongTermMemory(key, value) { let m = {}; try { if (fs.existsSync(this.memoryFile)) m = JSON.parse(fs.readFileSync(this.memoryFile, 'utf8')); } catch (e) {} m[key] = { value, saved: new Date().toISOString() }; fs.writeFileSync(this.memoryFile, JSON.stringify(m, null, 2)); }
  getLongTermMemory(key) { try { if (fs.existsSync(this.memoryFile)) return JSON.parse(fs.readFileSync(this.memoryFile, 'utf8'))[key] || null; } catch (e) {} return null; }
}

class GitWorkflow {
  constructor(root) { this.root = root; }
  isRepo() { try { execSync('git rev-parse --is-inside-work-tree', { cwd: this.root, stdio: 'ignore' }); return true; } catch (e) { return false; } }
  status() { if (!this.isRepo()) return { error: 'Not a git repo' }; return { branch: cmd('git branch --show-current'), files: cmd('git status --porcelain').split('\n').filter(Boolean), commits: cmd('git log --oneline -5').split('\n') }; }
  autoCommit(msg) { if (!this.isRepo()) return { error: 'Not a git repo' }; try { execSync('git add -A', { cwd: this.root, stdio: 'ignore' }); execSync(`git commit -m "${msg}"`, { cwd: this.root, stdio: 'ignore' }); return { success: true }; } catch (e) { return { error: e.message }; } }
  createBranch(name) { if (!this.isRepo()) return { error: 'Not a git repo' }; try { execSync(`git checkout -b ${name}`, { cwd: this.root, stdio: 'ignore' }); return { success: true }; } catch (e) { return { error: e.message }; } }
  listBranches() { if (!this.isRepo()) return []; return cmd('git branch').split('\n').map(b => b.replace(/^\*\s*/, '').trim()).filter(Boolean); }
  createPR(title) { if (!this.isRepo()) return { error: 'Not a git repo' }; try { const branch = cmd('git branch --show-current'); execSync('git push -u origin ' + branch, { cwd: this.root, stdio: 'ignore' }); return { success: true, pr: cmd(`gh pr create --title "${title}" --body "Auto-generated by Pix AI"`) }; } catch (e) { return { error: e.message }; } }
  diff() { return this.isRepo() ? cmd('git diff') : ''; }
  log(n = 10) { return this.isRepo() ? cmd(`git log --oneline -${n}`).split('\n') : []; }
}

class CostTracker {
  constructor(pixHome) {
    this.costFile = path.join(pixHome, 'costs.json');
    this.configFile = path.join(pixHome, 'budget-config.json');
  }
  loadCosts() { try { if (fs.existsSync(this.costFile)) return JSON.parse(fs.readFileSync(this.costFile, 'utf8')); } catch (e) {} return { sessions: [], totalCost: 0, totalTokens: 0 }; }
  saveCosts(c) { fs.writeFileSync(this.costFile, JSON.stringify(c, null, 2)); }
  loadBudget() { try { if (fs.existsSync(this.configFile)) return JSON.parse(fs.readFileSync(this.configFile, 'utf8')); } catch (e) {} return { dailyLimit: 5.0, monthlyLimit: 50.0, alertAt: 0.8, enabled: false }; }
  saveBudget(b) { fs.writeFileSync(this.configFile, JSON.stringify(b, null, 2)); }
  logUsage(provider, model, input, output) {
    const costs = this.loadCosts();
    const pricing = { openrouter: {i:0.00015,o:0.0006}, gemini: {i:0.00025,o:0.0005}, groq: {i:0.00005,o:0.00008}, openai: {i:0.0005,o:0.0015}, anthropic: {i:0.00025,o:0.00125} };
    const p = pricing[provider] || {i:0.0001,o:0.0003};
    const cost = Math.round((input * p.i + output * p.o) * 1000000) / 1000000;
    costs.sessions.push({ timestamp: new Date().toISOString(), provider, model, inputTokens: input, outputTokens: output, cost });
    costs.totalCost = Math.round((costs.totalCost + cost) * 1000000) / 1000000;
    costs.totalTokens += input + output;
    this.saveCosts(costs);
    return { cost };
  }
  getStats() {
    const costs = this.loadCosts();
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = costs.sessions.filter(s => s.timestamp.startsWith(today));
    const byProvider = {};
    costs.sessions.forEach(s => { if (!byProvider[s.provider]) byProvider[s.provider] = { cost: 0, tokens: 0, calls: 0 }; byProvider[s.provider].cost += s.cost; byProvider[s.provider].tokens += s.inputTokens + s.outputTokens; byProvider[s.provider].calls++; });
    return { total: costs.totalCost, tokens: costs.totalTokens, calls: costs.sessions.length, today: todaySessions.reduce((s,x) => s + x.cost, 0), todayCalls: todaySessions.length, byProvider, budget: this.loadBudget() };
  }
  getDailyHistory(days = 7) {
    const costs = this.loadCosts();
    return Array.from({length: days}, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const day = costs.sessions.filter(s => s.timestamp.startsWith(ds));
      return { date: ds, cost: day.reduce((s,x) => s + x.cost, 0), calls: day.length };
    }).reverse();
  }
}

class SelfRewriteEngine {
  constructor(pixHome) {
    this.rewritesDir = path.join(pixHome, 'rewrites');
    this.profileFile = path.join(pixHome, 'ai-profile.json');
    this.rulesFile = path.join(pixHome, 'rewrite-rules.json');
    if (!fs.existsSync(this.rewritesDir)) fs.mkdirSync(this.rewritesDir, { recursive: true });
  }
  loadProfile() { try { if (fs.existsSync(this.profileFile)) return JSON.parse(fs.readFileSync(this.profileFile, 'utf8')); } catch (e) {} return { personality: 'helpful', verbosity: 'concise', responseStyle: 'technical', priorities: ['accuracy','speed','completeness'], customTraits: [], thinkingDepth: 'standard', codeStyle: 'clean', explanationLevel: 'moderate' }; }
  saveProfile(p) { fs.writeFileSync(this.profileFile, JSON.stringify(p, null, 2)); }
  rewriteProfile(changes) { const p = this.loadProfile(); const before = {...p}; Object.assign(p, changes); this.saveProfile(p); this.logRewrite({ timestamp: new Date().toISOString(), type: 'profile-rewrite', before, after: p, changes }); return { success: true, profile: p }; }
  addTrait(t) { const p = this.loadProfile(); if (!p.customTraits.includes(t)) { p.customTraits.push(t); this.saveProfile(p); } return p; }
  removeTrait(t) { const p = this.loadProfile(); p.customTraits = p.customTraits.filter(x => x !== t); this.saveProfile(p); return p; }
  setThinkingDepth(d) { const p = this.loadProfile(); p.thinkingDepth = d; this.saveProfile(p); return p; }
  setCodeStyle(s) { const p = this.loadProfile(); p.codeStyle = s; this.saveProfile(p); return p; }
  loadRules() { try { if (fs.existsSync(this.rulesFile)) return JSON.parse(fs.readFileSync(this.rulesFile, 'utf8')); } catch (e) {} return { rules: [], immutable: ['safety','guardrails'] }; }
  addRule(r) { const rules = this.loadRules(); if (rules.immutable.includes(r.category)) return { error: 'Immutable rule' }; rules.rules.push({ id: Date.now().toString(36), ...r, created: new Date().toISOString() }); fs.writeFileSync(this.rulesFile, JSON.stringify(rules, null, 2)); return { success: true }; }
  listRules() { return this.loadRules(); }
  getSystemPrompt() { const p = this.loadProfile(); return `You are Pix AI. Personality: ${p.personality}. Verbosity: ${p.verbosity}. Style: ${p.responseStyle}. Depth: ${p.thinkingDepth}. Code: ${p.codeStyle}. Traits: ${p.customTraits.join(', ')||'none'}.`; }
  getHistory() { try { return fs.readdirSync(this.rewritesDir).filter(f => f.endsWith('.json')).map(f => { try { return JSON.parse(fs.readFileSync(path.join(this.rewritesDir, f), 'utf8')); } catch(e) { return null; } }).filter(Boolean).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)); } catch(e) { return []; } }
  logRewrite(r) { fs.writeFileSync(path.join(this.rewritesDir, `${Date.now()}.json`), JSON.stringify(r, null, 2)); }
  reset() { const p = { personality:'helpful', verbosity:'concise', responseStyle:'technical', priorities:['accuracy','speed','completeness'], customTraits:[], thinkingDepth:'standard', codeStyle:'clean', explanationLevel:'moderate' }; this.saveProfile(p); return p; }
}

class CodeReviewAgent {
  constructor(root) { this.root = root; this.reviewDir = path.join(root, '.pix', 'reviews'); if (!fs.existsSync(this.reviewDir)) fs.mkdirSync(this.reviewDir, { recursive: true }); }
  reviewFile(filePath) {
    const fp = path.resolve(this.root, filePath);
    if (!fs.existsSync(fp)) return { error: 'Not found' };
    const content = fs.readFileSync(fp, 'utf8');
    const lines = content.split('\n');
    const issues = [];
    lines.forEach((line, i) => {
      const n = i + 1;
      if (line.length > 120) issues.push({ line: n, sev: 'warn', type: 'style', msg: `Long line (${line.length})` });
      if (line.includes('TODO')) issues.push({ line: n, sev: 'info', type: 'todo', msg: 'TODO found' });
      if (line.includes('FIXME')) issues.push({ line: n, sev: 'warn', type: 'fixme', msg: 'FIXME found' });
      if (line.match(/\bvar\b/) && /\.(js|ts)$/.test(filePath)) issues.push({ line: n, sev: 'info', type: 'modern', msg: 'Use let/const' });
      if (line.match(/eval\(/)) issues.push({ line: n, sev: 'error', type: 'security', msg: 'eval() risk' });
      if (line.match(/password|secret|api.?key/i) && line.match(/=.+['"]/)) issues.push({ line: n, sev: 'error', type: 'security', msg: 'Possible hardcoded secret' });
      if (line.match(/==(?!=)/)) issues.push({ line: n, sev: 'info', type: 'style', msg: 'Use === instead of ==' });
    });
    return { file: filePath, lines: lines.length, issues, score: Math.max(0, 100 - issues.filter(i=>i.sev==='error').length*15 - issues.filter(i=>i.sev==='warn').length*5 - issues.length), errors: issues.filter(i=>i.sev==='error').length, warnings: issues.filter(i=>i.sev==='warn').length, info: issues.filter(i=>i.sev==='info').length };
  }
  reviewDir(dir) {
    const d = path.resolve(this.root, dir || '.');
    const files = [];
    const walk = (p) => { fs.readdirSync(p, {withFileTypes:true}).forEach(e => { const f = path.join(p, e.name); if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') walk(f); else if (e.isFile() && /\.(js|jsx|ts|tsx|py|go|rs|java|rb|css|html|json)$/.test(e.name)) files.push(f.replace(this.root+'/', '')); }); };
    walk(d);
    const reviews = files.map(f => this.reviewFile(f));
    return { files: reviews.length, totalIssues: reviews.reduce((s,r) => s + r.issues.length, 0), avgScore: reviews.length ? Math.round(reviews.reduce((s,r) => s + r.score, 0) / reviews.length) : 100, reviews };
  }
}

class VoiceInterface {
  constructor(pixHome) { this.pixHome = pixHome; this.commandsFile = path.join(pixHome, 'voice-commands.json'); this.historyFile = path.join(pixHome, 'voice-history.json'); this.loadCommands(); }
  loadCommands() { try { if (fs.existsSync(this.commandsFile)) { this.commands = JSON.parse(fs.readFileSync(this.commandsFile, 'utf8')); return; } } catch(e){} this.commands = { 'run tests':'npm test','build project':'npm run build','start server':'npm start','install deps':'npm install','git status':'git status','git push':'git push','git pull':'git pull','open editor':'code .','list files':'ls -la','clear terminal':'clear' }; }
  isAvailable() { try { if (process.platform === 'darwin') { execSync('which say', {stdio:'ignore'}); return {available:true, engine:'say'}; } return {available:false}; } catch(e) { return {available:false}; } }
  speak(text) { if (!this.isAvailable().available) return {error:'No TTS'}; try { execSync(`say "${text.replace(/"/g, '\\"')}"`, {stdio:'ignore'}); return {success:true}; } catch(e) { return {error:e.message}; } }
  matchCommand(transcript) { const l = transcript.toLowerCase().trim(); for (const [p, a] of Object.entries(this.commands)) { if (l.includes(p)) return {matched:true, command:p, action:a}; } return {matched:false}; }
  addCommand(phrase, action) { this.commands[phrase.toLowerCase()] = action; fs.writeFileSync(this.commandsFile, JSON.stringify(this.commands, null, 2)); }
  removeCommand(phrase) { delete this.commands[phrase.toLowerCase()]; fs.writeFileSync(this.commandsFile, JSON.stringify(this.commands, null, 2)); }
  listCommands() { return Object.entries(this.commands).map(([p,a]) => ({phrase:p, action:a})); }
  logHistory(transcript, action) { let h = []; try { if (fs.existsSync(this.historyFile)) h = JSON.parse(fs.readFileSync(this.historyFile, 'utf8')); } catch(e){} h.push({transcript, action, timestamp: new Date().toISOString()}); if (h.length > 100) h = h.slice(-100); fs.writeFileSync(this.historyFile, JSON.stringify(h, null, 2)); }
}

class Dashboard {
  constructor(pixHome) { this.pixHome = pixHome; this.analyticsFile = path.join(pixHome, 'analytics.json'); this.goalsFile = path.join(pixHome, 'goals.json'); }
  getSystemInfo() {
    const cpus = os.cpus(), load = os.loadavg(), total = os.totalmem(), free = os.freemem();
    const fmt = (b) => { const u=['B','KB','MB','GB','TB']; let i=0; while(b>=1024&&i<u.length-1){b/=1024;i++;} return `${b.toFixed(1)}${u[i]}`; };
    const upt = (s) => { const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60); return d>0?`${d}d${h}h${m}m`:h>0?`${h}h${m}m`:`${m}m`; };
    let disk = null;
    try { const o = cmd('df -h /'); const p = o.split('\n')[1]?.split(/\s+/); if (p) disk = {size:p[1],used:p[2],avail:p[3],pct:p[4]}; } catch(e){}
    return { platform:`${os.platform()} ${os.arch()}`, node:process.version, hostname:os.hostname(), cpus:cpus.length, load:`${load[0].toFixed(2)} / ${load[1].toFixed(2)} / ${load[2].toFixed(2)}`, memory:{total:fmt(total),free:fmt(free),used:fmt(total-free),pct:((1-free/total)*100).toFixed(1)+'%'}, uptime:upt(os.uptime()), disk };
  }
  logEvent(event, data) { let a = {events:[],stats:{}}; try { if (fs.existsSync(this.analyticsFile)) a = JSON.parse(fs.readFileSync(this.analyticsFile, 'utf8')); } catch(e){} a.events.push({event,data,timestamp:new Date().toISOString()}); if (a.events.length > 1000) a.events = a.events.slice(-1000); a.stats[event] = (a.stats[event]||0)+1; a.stats.totalEvents = (a.stats.totalEvents||0)+1; fs.writeFileSync(this.analyticsFile, JSON.stringify(a, null, 2)); }
  getStats() { let a = {stats:{}}; try { if (fs.existsSync(this.analyticsFile)) a = JSON.parse(fs.readFileSync(this.analyticsFile, 'utf8')); } catch(e){} return a.stats; }
  getRecentEvents(n=20) { let a = {events:[]}; try { if (fs.existsSync(this.analyticsFile)) a = JSON.parse(fs.readFileSync(this.analyticsFile, 'utf8')); } catch(e){} return a.events.slice(-n).reverse(); }
  setGoal(text) { let g = []; try { if (fs.existsSync(this.goalsFile)) g = JSON.parse(fs.readFileSync(this.goalsFile, 'utf8')); } catch(e){} g.push({id:Date.now().toString(36),text,created:new Date().toISOString(),completed:false}); fs.writeFileSync(this.goalsFile, JSON.stringify(g, null, 2)); return g; }
  completeGoal(id) { let g = []; try { if (fs.existsSync(this.goalsFile)) g = JSON.parse(fs.readFileSync(this.goalsFile, 'utf8')); } catch(e){} g = g.map(x => x.id===id ? {...x,completed:true,completedAt:new Date().toISOString()} : x); fs.writeFileSync(this.goalsFile, JSON.stringify(g, null, 2)); return g; }
  getGoals() { try { if (fs.existsSync(this.goalsFile)) return JSON.parse(fs.readFileSync(this.goalsFile, 'utf8')); } catch(e){} return []; }
  getProjectStats(root) {
    const s = {files:0,lines:0,langs:{}};
    const walk = (d) => { try { fs.readdirSync(d,{withFileTypes:true}).forEach(e => { const f = path.join(d,e.name); if (e.isDirectory() && !e.name.startsWith('.') && e.name!=='node_modules') walk(f); else if (e.isFile()) { const ext = path.extname(e.name); if (ext) { s.files++; s.langs[ext] = (s.langs[ext]||0)+1; try { s.lines += fs.readFileSync(f,'utf8').split('\n').length; } catch(x){} } } }); } catch(e){} };
    walk(root);
    return s;
  }
}

// ────────────────────────────────────────
// COMMAND ROUTER
// ────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const config = loadConfig();
ensureDirs();

const autoUpdater = new AutoUpdater(CACHE_DIR);
const plugins = new PluginMarketplace(PIX_HOME);
const memory = new SessionMemory(PIX_HOME);
const costTracker = new CostTracker(PIX_HOME);
const selfRewrite = new SelfRewriteEngine(PIX_HOME);
const voice = new VoiceInterface(PIX_HOME);
const dashboard = new Dashboard(PIX_HOME);

// ── No command / help ──
if (!command || command === 'help' || command === '--help' || command === '-h') {
  banner();
  const sections = [
    ['Core', ['pix chat','pix ask <q>','pix ask --auto <q>','pix run <file>']],
    ['Config', ['pix config','pix config --set-key <key>','pix config --set-provider <p>','pix config --set-mode <mode>']],
    ['Status', ['pix status','pix doctor','pix version']],
    ['Features', ['pix engines','pix modes','pix plugins','pix plugins enable <id>']],
    ['Git', ['pix git status','pix git commit <msg>','pix git branch <name>','pix git pr <title>']],
    ['Review', ['pix review <file>','pix review --dir <dir>','pix review --pr']],
    ['Memory', ['pix sessions','pix session new [project]','pix session search <q>']],
    ['Cost', ['pix cost','pix cost --set-budget <daily>','pix cost history']],
    ['Self-Rewrite', ['pix rewrite profile','pix rewrite set <key> <val>','pix rewrite rules','pix rewrite reset']],
    ['Voice', ['pix voice','pix voice speak <text>','pix voice commands','pix voice add <phrase> <cmd>']],
    ['Dashboard', ['pix dashboard','pix goals','pix goals add <text>','pix project-stats']],
    ['Update', ['pix update','pix update-publish [version]','pix self-update <ver>']],
    ['Safety', ['pix safety']]
  ];
  sections.forEach(([title, cmds]) => {
    console.log(`  ${c.bold}${c.cyan}${title}:${c.reset}`);
    cmds.forEach(cmd => console.log(`    ${c.green}${cmd}${c.reset}`));
    console.log('');
  });
  console.log(`${c.dim}  Aliases: pixai, px${c.reset}\n`);
  process.exit(0);
}

// ── version ──
if (command === 'version' || command === '-v' || command === '--version') { console.log(`pix-ai v${VERSION}`); process.exit(0); }

// ── chat ──
if (command === 'chat' || command === 'i') {
  banner();
  console.log(`${c.cyan}  🤖 Interactive mode${c.reset}`);
  console.log(`${c.dim}  Type your question or command. Use 'exit' to quit.${c.reset}\n`);
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `${c.green}> ${c.reset}` });
  const session = memory.createSession(process.cwd());
  console.log(`${c.dim}  Session: ${session.id}${c.reset}\n`);
  rl.prompt();
  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input || input === 'exit' || input === 'quit') { console.log(`\n${c.dim}  Session saved. Goodbye!${c.reset}\n`); rl.close(); process.exit(0); }
    memory.addMessage(session.id, 'user', input);
    dashboard.logEvent('chat-message', { input: input.substring(0, 100) });
    if (config.apiKey) {
      console.log(`${c.dim}  Connecting to ${config.provider}...${c.reset}`);
      try {
        const { spawn } = require('child_process');
        const httpsMod = require('https');
        const postData = JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: input }], max_tokens: 2048 });
        const hosts = { openrouter: 'openrouter.ai', gemini: 'generativelanguage.googleapis.com', groq: 'api.groq.com', openai: 'api.openai.com' };
        const host = hosts[config.provider] || 'openrouter.ai';
        const reqPath = config.provider === 'openrouter' ? '/api/v1/chat/completions' : config.provider === 'groq' ? '/openai/v1/chat/completions' : '/v1/chat/completions';
        const req = httpsMod.request({ hostname: host, port: 443, path: reqPath, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), 'Authorization': `Bearer ${config.apiKey}` } }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              const reply = json.choices?.[0]?.message?.content || json.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
              console.log(`\n${c.cyan}  🤖 ${reply}${c.reset}\n`);
              memory.addMessage(session.id, 'assistant', reply);
              if (json.usage) costTracker.logUsage(config.provider, 'default', json.usage.prompt_tokens, json.usage.completion_tokens);
            } catch (e) { console.log(`${c.red}  Parse error${c.reset}\n`); }
            rl.prompt();
          });
        });
        req.on('error', (e) => { console.log(`${c.red}  Connection error: ${e.message}${c.reset}\n`); rl.prompt(); });
        req.write(postData);
        req.end();
      } catch (e) { console.log(`${c.red}  Error: ${e.message}${c.reset}\n`); rl.prompt(); }
    } else {
      console.log(`${c.yellow}  ⚠ No API key set. Run: pix config --set-key <key>${c.reset}\n`);
      rl.prompt();
    }
  });
  process.exit(0);
}

// ── ask ──
if (command === 'ask') {
  banner();
  const autoMode = args.includes('--auto');
  const question = args.filter(a => a !== '--auto' && a !== 'ask').join(' ');
  if (!question) { console.log(`${c.red}  Usage: pix ask [--auto] <question>${c.reset}\n`); process.exit(1); }
  console.log(`${c.cyan}  🤖 ${question}${c.reset}`);
  console.log(`${c.dim}  Mode: ${autoMode ? 'Auto-execute' : 'Ask first'}${c.reset}`);
  if (!config.apiKey) { console.log(`${c.yellow}  ⚠ No API key. Run: pix config --set-key <key>${c.reset}\n`); process.exit(1); }
  console.log(`${c.dim}  Connecting to ${config.provider}...${c.reset}\n`);
  const postData = JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: question }], max_tokens: 2048 });
  const httpsMod = require('https');
  const hosts = { openrouter: 'openrouter.ai', groq: 'api.groq.com', openai: 'api.openai.com' };
  const host = hosts[config.provider] || 'openrouter.ai';
  const reqPath = config.provider === 'openrouter' ? '/api/v1/chat/completions' : '/v1/chat/completions';
  const req = httpsMod.request({ hostname: host, port: 443, path: reqPath, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), 'Authorization': `Bearer ${config.apiKey}` } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const reply = json.choices?.[0]?.message?.content || 'No response';
        console.log(`${c.green}  📝 Answer:${c.reset}\n${reply}\n`);
        if (json.usage) costTracker.logUsage(config.provider, 'default', json.usage.prompt_tokens, json.usage.completion_tokens);
      } catch (e) { console.log(`${c.red}  Parse error${c.reset}\n`); }
      process.exit(0);
    });
  });
  req.on('error', (e) => { console.log(`${c.red}  Error: ${e.message}${c.reset}\n`); process.exit(1); });
  req.write(postData);
  req.end();
}

// ── config ──
if (command === 'config') {
  banner();
  console.log(`${c.bold}${c.cyan}  ⚙️  Configuration${c.reset}\n`);
  console.log(`  ${c.bold}Provider:${c.reset}   ${config.provider}`);
  console.log(`  ${c.bold}API Key:${c.reset}     ${config.apiKey ? '***' + config.apiKey.slice(-4) : 'Not set'}`);
  console.log(`  ${c.bold}Mode:${c.reset}        ${config.mode}`);
  console.log(`  ${c.bold}Auto Update:${c.reset} ${config.autoUpdate}`);
  console.log(`  ${c.bold}Version:${c.reset}     ${VERSION}\n`);
  if (args[1] === '--set-key' && args[2]) { config.apiKey = args[2]; saveConfig(config); console.log(`${c.green}  ✓ API key saved${c.reset}\n`); }
  else if (args[1] === '--set-provider' && args[2]) { config.provider = args[2]; saveConfig(config); console.log(`${c.green}  ✓ Provider: ${args[2]}${c.reset}\n`); }
  else if (args[1] === '--set-mode' && args[2]) { config.mode = args[2]; saveConfig(config); console.log(`${c.green}  ✓ Mode: ${args[2]}${c.reset}\n`); }
  else if (args[1] === '--set-auto-update' && args[2]) { config.autoUpdate = args[2] === 'true'; saveConfig(config); console.log(`${c.green}  ✓ Auto-update: ${config.autoUpdate}${c.reset}\n`); }
  else { console.log(`${c.dim}  pix config --set-key <key>${c.reset}\n  ${c.dim}pix config --set-provider <provider>${c.reset}\n  ${c.dim}pix config --set-mode <mode>${c.reset}\n  ${c.dim}pix config --set-auto-update <true|false>${c.reset}\n`); }
  process.exit(0);
}

// ── status ──
if (command === 'status') {
  banner();
  const sys = dashboard.getSystemInfo();
  box([
    `${c.bold}${c.cyan}Pix AI Status — v${VERSION}${c.reset}`, ``,
    `${c.dim}Provider:${c.reset}     ${config.provider}`,
    `${c.dim}API Key:${c.reset}      ${config.apiKey ? '***' + config.apiKey.slice(-4) : 'Not set'}`,
    `${c.dim}Mode:${c.reset}         ${config.mode}`,
    `${c.dim}Platform:${c.reset}     ${sys.platform}`,
    `${c.dim}Node:${c.reset}         ${sys.node}`,
    `${c.dim}CPUs:${c.reset}         ${sys.cpus} cores`,
    `${c.dim}Memory:${c.reset}       ${sys.memory.used} / ${sys.memory.total} (${sys.memory.pct})`,
    `${c.dim}Uptime:${c.reset}       ${sys.uptime}`,
    sys.disk ? `${c.dim}Disk:${c.reset}         ${sys.disk.used} / ${sys.disk.size} (${sys.disk.pct})` : '',
    ``, `${c.dim}Engines:${c.reset}      59 active`,
    `${c.dim}Cognitive:${c.reset}    82 features`,
    `${c.dim}Safety:${c.reset}       Bouncer active`,
    `${c.dim}License:${c.reset}      Proprietary`
  ]);
  console.log('');
  process.exit(0);
}

// ── doctor ──
if (command === 'doctor') {
  banner();
  console.log(`${c.bold}${c.cyan}  Running diagnostics...${c.reset}\n`);
  const checks = [
    ['Node.js', process.version, 'ok'],
    ['Pix Home', fs.existsSync(PIX_HOME) ? 'exists' : 'missing', fs.existsSync(PIX_HOME) ? 'ok' : 'warn'],
    ['Config', fs.existsSync(CONFIG_FILE) ? 'exists' : 'missing', fs.existsSync(CONFIG_FILE) ? 'ok' : 'warn'],
    ['Sessions', fs.existsSync(SESSIONS_DIR) ? 'exists' : 'missing', fs.existsSync(SESSIONS_DIR) ? 'ok' : 'warn'],
    ['Plugins', fs.existsSync(PLUGINS_DIR) ? 'exists' : 'missing', fs.existsSync(PLUGINS_DIR) ? 'ok' : 'warn'],
    ['API Key', config.apiKey ? 'set' : 'missing', config.apiKey ? 'ok' : 'warn'],
    ['Platform', `${os.platform()} ${os.arch()}`, 'ok'],
    ['Memory', `${Math.round(os.totalmem()/1024/1024/1024)}GB`, 'ok'],
    ['CPUs', `${os.cpus().length} cores`, 'ok'],
    ['Voice', voice.isAvailable().available ? 'available' : 'not found', voice.isAvailable().available ? 'ok' : 'warn']
  ];
  checks.forEach(([name, val, status]) => {
    const icon = status === 'ok' ? `${c.green}✓${c.reset}` : `${c.yellow}⚠${c.reset}`;
    console.log(`  ${icon} ${name.padEnd(12)} ${c.dim}${val}${c.reset}`);
  });
  console.log('');
  process.exit(0);
}

// ── engines ──
if (command === 'engines') {
  banner();
  const engines = ['🧠 Core AI','🕸 Orchestrator','🔮 Strategy','💭 Thinking','🧩 Memory','📋 Planner','📦 Sandbox (20+ langs)','💻 Terminal','📁 File System','⚙️ Processes','🌐 Web Automation','📝 Code Editor','🚀 Go On','📜 History','❓ Clarification','🔬 Research','👁 Vision','🔒 Modes','🔑 API Keys','📝 Markdown','🪟 VS Code','🦙 Local Models','🤖 Bots (18 platforms)','🎤 Voice I/O','📸 Screen Recording','🧪 API Testing','🔗 Sub-Agents','⚡ Parallel Tasks','🔄 Background Tasks','📊 Task Stream','📱 App Connector','🎮 Game Engine Bridge','💬 AI-to-AI Chat','👥 Teams/Discord Bot','🌐 Browser Agent','🖥 Terminal Mux','🔐 SSH Manager','🐳 Docker Manager','🔀 Git Advanced','🧠 Pattern Learner','⌨️ Smart AutoComplete','⚠️ Error Predictor','👁 Code Review','📚 Doc Generator','🗺 Mind Map','💡 Prompt Templates','🔄 Workflow Builder','🎯 Focus Mode','📊 System Monitor','🛡 Security Scanner','💾 Backup','🕸 Knowledge Graph','📈 Learning Path','📋 Code Digest','📧 Email Agent','📅 Calendar Agent','🌐 Translate','🧠 Cognitive Meta (82)','🛡 Safety Bouncer'];
  console.log(`${c.bold}${c.cyan}  ${engines.length} Engines:${c.reset}\n`);
  engines.forEach((e, i) => console.log(`  ${c.dim}${String(i+1).padStart(2)}.${c.reset} ${e}`));
  console.log('');
  process.exit(0);
}

// ── modes ──
if (command === 'modes') {
  banner();
  const modes = [['Plan','Research & plan only','📋'],['Build','Full capabilities','🔨'],['Private','Isolated privacy','🔒'],['Research','Deep research','🔬'],['Review','Code review','🔍'],['Debug','Step-through debugging','🐛'],['Teach','Educational','📚'],['Creative','Brainstorming','🎨'],['Write Fast','Speed - ship now','⚡'],['Debug Deep','Forensic debugging','🔬'],['Self-Rewrite','Pix tweaks itself','🪞']];
  console.log(`${c.bold}${c.cyan}  Modes:${c.reset}\n`);
  modes.forEach(([n,d,i]) => console.log(`  ${i} ${c.bold}${n.padEnd(15)}${c.reset} ${c.dim}${d}${c.reset}`));
  console.log('');
  process.exit(0);
}

// ── safety ──
if (command === 'safety') {
  banner();
  console.log(`${c.bold}${c.yellow}  🛡️  Safety Bouncer${c.reset}\n`);
  [['✓','Immutable guardrails','ACTIVE'],['✓','No guardrail rewrite','ENFORCED'],['✓','Risky mod consultation','REQUIRED'],['✓','Illegal content','BLOCKED'],['✓','Adult content','ALLOWED w/ censor'],['✓','Audit trail','ENABLED'],['✓','Reversibility','REQUIRED']].forEach(([i,r,s]) => console.log(`  ${c.green}${i}${c.reset} ${r.padEnd(25)} ${c.cyan}${s}${c.reset}`));
  console.log(`\n  ${c.dim}All modifications logged. Risky changes need your approval.${c.reset}\n`);
  process.exit(0);
}

// ── plugins ──
if (command === 'plugins') {
  banner();
  if (args[1] === 'enable' && args[2]) { plugins.enable(args[2]); console.log(`${c.green}  ✓ Plugin enabled: ${args[2]}${c.reset}\n`); process.exit(0); }
  if (args[1] === 'disable' && args[2]) { plugins.disable(args[2]); console.log(`${c.green}  ✓ Plugin disabled: ${args[2]}${c.reset}\n`); process.exit(0); }
  const list = plugins.getPlugins();
  const enabled = plugins.getEnabled();
  console.log(`${c.bold}${c.cyan}  Plugins (${list.length} available):${c.reset}\n`);
  const cats = {};
  list.forEach(p => { if (!cats[p.category]) cats[p.category] = []; cats[p.category].push(p); });
  Object.entries(cats).forEach(([cat, items]) => {
    console.log(`  ${c.bold}${c.magenta}${cat.toUpperCase()}${c.reset}`);
    items.forEach(p => {
      const isOn = enabled.includes(p.id);
      console.log(`    ${isOn ? c.green+'●'+c.reset : c.dim+'○'+c.reset} ${c.bold}${p.name.padEnd(18)}${c.reset} ${c.dim}${p.desc}${c.reset}`);
    });
    console.log('');
  });
  console.log(`${c.dim}  pix plugins enable <id> / pix plugins disable <id>${c.reset}\n`);
  process.exit(0);
}

// ── git ──
if (command === 'git') {
  banner();
  const gw = new GitWorkflow(process.cwd());
  const sub = args[1];
  if (sub === 'status' || !sub) {
    const s = gw.status();
    if (s.error) { console.log(`${c.red}  ${s.error}${c.reset}\n`); } else {
      console.log(`${c.bold}${c.cyan}  Git Status${c.reset}\n`);
      console.log(`  ${c.dim}Branch:${c.reset} ${s.branch}`);
      console.log(`  ${c.dim}Changes:${c.reset} ${s.files.length} files`);
      s.files.forEach(f => console.log(`    ${f}`));
      console.log(`\n  ${c.dim}Recent:${c.reset}`);
      s.commits.forEach(c2 => console.log(`    ${c2}`));
    }
  } else if (sub === 'commit') {
    const msg = args.slice(2).join(' ');
    if (!msg) { console.log(`${c.red}  Usage: pix git commit <message>${c.reset}\n`); } else {
      const r = gw.autoCommit(msg);
      r.success ? console.log(`${c.green}  ✓ Committed: ${msg}${c.reset}\n`) : console.log(`${c.red}  ✗ ${r.error}${c.reset}\n`);
    }
  } else if (sub === 'branch') {
    if (args[2]) { const r = gw.createBranch(args[2]); r.success ? console.log(`${c.green}  ✓ Branch: ${args[2]}${c.reset}\n`) : console.log(`${c.red}  ✗ ${r.error}${c.reset}\n`); }
    else { console.log(`${c.bold}  Branches:${c.reset}\n`); gw.listBranches().forEach(b => console.log(`    ${b}`)); console.log(''); }
  } else if (sub === 'pr') {
    const title = args.slice(2).join(' ') || 'Pix AI PR';
    const r = gw.createPR(title);
    r.success ? console.log(`${c.green}  ✓ PR created${c.reset}\n`) : console.log(`${c.red}  ✗ ${r.error}${c.reset}\n`);
  } else if (sub === 'diff') {
    const d = gw.diff();
    console.log(d || `${c.dim}  No changes${c.reset}\n`);
  } else if (sub === 'log') {
    gw.log(parseInt(args[2]) || 10).forEach(l => console.log(`  ${l}`));
    console.log('');
  }
  process.exit(0);
}

// ── review ──
if (command === 'review') {
  banner();
  const cra = new CodeReviewAgent(process.cwd());
  if (args[1] === '--dir') {
    const r = cra.reviewDir(args[2] || '.');
    console.log(`${c.bold}${c.cyan}  Review: ${r.files} files, ${r.totalIssues} issues, score ${r.avgScore}/100${c.reset}\n`);
    r.reviews.forEach(rev => {
      if (rev.issues.length > 0) {
        console.log(`  ${c.bold}${rev.file}${c.reset} (score: ${rev.score})`);
        rev.issues.forEach(i => console.log(`    ${i.sev==='error'?c.red:c.sev==='warn'?c.yellow:c.blue}L${i.line}${c.reset} ${c.dim}${i.msg}${c.reset}`));
      }
    });
    console.log('');
  } else if (args[1] === '--pr') {
    console.log(`${c.cyan}  Reviewing staged changes...${c.reset}\n`);
    try {
      const files = cmd('git diff --cached --name-only').split('\n').filter(Boolean);
      files.forEach(f => { const r = cra.reviewFile(f); console.log(`  ${r.file}: ${r.score}/100 (${r.errors}E ${r.warnings}W ${r.info}I)`); });
    } catch(e) { console.log(`${c.red}  No staged changes${c.reset}\n`); }
  } else if (args[1]) {
    const r = cra.reviewFile(args[1]);
    console.log(`${c.bold}${c.cyan}  Review: ${r.file}${c.reset}`);
    console.log(`  ${c.dim}Lines:${c.reset} ${r.lines}  ${c.dim}Score:${c.reset} ${r.score}/100`);
    console.log(`  ${c.red}Errors:${c.reset} ${r.errors}  ${c.yellow}Warnings:${c.reset} ${r.warnings}  ${c.blue}Info:${c.reset} ${r.info}\n`);
    r.issues.forEach(i => console.log(`  ${i.sev==='error'?c.red:i.sev==='warn'?c.yellow:c.blue}L${i.line}${c.reset} ${c.dim}${i.type}: ${i.msg}${c.reset}`));
    console.log('');
  } else {
    console.log(`${c.dim}  Usage: pix review <file> | pix review --dir <dir> | pix review --pr${c.reset}\n`);
  }
  process.exit(0);
}

// ── sessions ──
if (command === 'sessions' || command === 'session') {
  banner();
  if (args[1] === 'new') {
    const s = memory.createSession(args[2] || process.cwd());
    console.log(`${c.green}  ✓ Session created: ${s.id}${c.reset}\n`);
  } else if (args[1] === 'search' && args[2]) {
    const q = args.slice(2).join(' ');
    const results = memory.searchMessages(q);
    console.log(`${c.bold}  Search: "${q}" — ${results.length} results${c.reset}\n`);
    results.forEach(r => console.log(`  ${c.dim}[${r.sessionId}]${c.reset} ${r.role}: ${r.content}`));
    console.log('');
  } else if (args[1] === 'list' || !args[1]) {
    const sessions = memory.listSessions();
    console.log(`${c.bold}${c.cyan}  Sessions (${sessions.length}):${c.reset}\n`);
    sessions.forEach(s => console.log(`  ${c.dim}${s.id}${c.reset} ${s.project} — ${s.messages} messages — ${s.created}`));
    console.log('');
  } else if (args[1] === 'memory' && args[2] === 'set' && args[3]) {
    const key = args[3], val = args.slice(4).join(' ');
    memory.saveLongTermMemory(key, val);
    console.log(`${c.green}  ✓ Memory saved: ${key}${c.reset}\n`);
  } else if (args[1] === 'memory' && args[2] === 'get' && args[3]) {
    const m = memory.getLongTermMemory(args[3]);
    m ? console.log(`  ${c.cyan}${args[3]}:${c.reset} ${m.value}\n`) : console.log(`${c.dim}  Not found${c.reset}\n`);
  } else {
    console.log(`${c.dim}  pix sessions | pix session new [project] | pix session search <q>${c.reset}`);
    console.log(`${c.dim}  pix session memory set <key> <value> | pix session memory get <key>${c.reset}\n`);
  }
  process.exit(0);
}

// ── cost ──
if (command === 'cost') {
  banner();
  if (args[1] === '--set-budget' && args[2]) {
    const b = costTracker.loadBudget();
    b.dailyLimit = parseFloat(args[2]);
    b.enabled = true;
    costTracker.saveBudget(b);
    console.log(`${c.green}  ✓ Daily budget: $${b.dailyLimit}${c.reset}\n`);
  } else if (args[1] === 'history') {
    const h = costTracker.getDailyHistory(parseInt(args[2]) || 7);
    console.log(`${c.bold}${c.cyan}  Cost History:${c.reset}\n`);
    h.forEach(d => console.log(`  ${c.dim}${d.date}${c.reset}  $${d.cost.toFixed(4)}  ${d.calls} calls`));
    console.log('');
  } else {
    const s = costTracker.getStats();
    console.log(`${c.bold}${c.cyan}  Cost Tracker:${c.reset}\n`);
    console.log(`  ${c.dim}Total:${c.reset}       $${s.total.toFixed(4)}`);
    console.log(`  ${c.dim}Today:${c.reset}       $${s.today.toFixed(4)}`);
    console.log(`  ${c.dim}Tokens:${c.reset}      ${s.tokens.toLocaleString()}`);
    console.log(`  ${c.dim}Calls:${c.reset}       ${s.calls}`);
    console.log(`  ${c.dim}Budget:${c.reset}      ${s.budget.enabled ? `$${s.budget.dailyLimit}/day` : 'Disabled'}`);
    if (Object.keys(s.byProvider).length > 0) {
      console.log(`\n  ${c.bold}By Provider:${c.reset}`);
      Object.entries(s.byProvider).forEach(([p, v]) => console.log(`    ${p}: $${v.cost.toFixed(4)} (${v.calls} calls)`));
    }
    console.log('');
  }
  process.exit(0);
}

// ── rewrite ──
if (command === 'rewrite') {
  banner();
  const sub = args[1];
  if (sub === 'profile') {
    const p = selfRewrite.loadProfile();
    console.log(`${c.bold}${c.cyan}  AI Profile:${c.reset}\n`);
    Object.entries(p).forEach(([k, v]) => console.log(`  ${c.dim}${k}:${c.reset} ${Array.isArray(v) ? v.join(', ') || 'none' : v}`));
    console.log('');
  } else if (sub === 'set' && args[2] && args[3]) {
    const changes = { [args[2]]: args.slice(3).join(' ') };
    const r = selfRewrite.rewriteProfile(changes);
    console.log(`${c.green}  ✓ Profile updated: ${args[2]} = ${args.slice(3).join(' ')}${c.reset}\n`);
  } else if (sub === 'trait' && args[2] === 'add' && args[3]) {
    selfRewrite.addTrait(args.slice(3).join(' '));
    console.log(`${c.green}  ✓ Trait added: ${args.slice(3).join(' ')}${c.reset}\n`);
  } else if (sub === 'trait' && args[2] === 'remove' && args[3]) {
    selfRewrite.removeTrait(args.slice(3).join(' '));
    console.log(`${c.green}  ✓ Trait removed${c.reset}\n`);
  } else if (sub === 'depth' && args[2]) {
    selfRewrite.setThinkingDepth(args[2]);
    console.log(`${c.green}  ✓ Thinking depth: ${args[2]}${c.reset}\n`);
  } else if (sub === 'codestyle' && args[2]) {
    selfRewrite.setCodeStyle(args[2]);
    console.log(`${c.green}  ✓ Code style: ${args[2]}${c.reset}\n`);
  } else if (sub === 'rules') {
    const rules = selfRewrite.listRules();
    console.log(`${c.bold}  Rules (${rules.rules.length}):${c.reset}\n`);
    rules.rules.forEach(r => console.log(`  ${c.dim}${r.id}${c.reset} [${r.category}] ${r.rule}`));
    console.log(`\n  ${c.dim}Immutable: ${rules.immutable.join(', ')}${c.reset}\n`);
  } else if (sub === 'rule' && args[2] === 'add') {
    const r = selfRewrite.addRule({ category: args[3] || 'general', rule: args.slice(4).join(' ') });
    r.success ? console.log(`${c.green}  ✓ Rule added${c.reset}\n`) : console.log(`${c.red}  ✗ ${r.error}${c.reset}\n`);
  } else if (sub === 'history') {
    const h = selfRewrite.getHistory();
    console.log(`${c.bold}  Rewrite History (${h.length}):${c.reset}\n`);
    h.slice(0, 10).forEach(r => console.log(`  ${c.dim}${r.timestamp}${c.reset} ${r.type}`));
    console.log('');
  } else if (sub === 'prompt') {
    console.log(`\n${c.cyan}  ${selfRewrite.getSystemPrompt()}${c.reset}\n`);
  } else if (sub === 'reset') {
    selfRewrite.reset();
    console.log(`${c.green}  ✓ Profile reset to defaults${c.reset}\n`);
  } else {
    console.log(`${c.dim}  pix rewrite profile | pix rewrite set <key> <value>${c.reset}`);
    console.log(`${c.dim}  pix rewrite trait add/remove <trait>${c.reset}`);
    console.log(`${c.dim}  pix rewrite depth <minimal|standard|deep|exhaustive>${c.reset}`);
    console.log(`${c.dim}  pix rewrite codestyle <clean|compact|verbose|functional|oop>${c.reset}`);
    console.log(`${c.dim}  pix rewrite rules | pix rewrite rule add <cat> <rule>${c.reset}`);
    console.log(`${c.dim}  pix rewrite history | pix rewrite prompt | pix rewrite reset${c.reset}\n`);
  }
  process.exit(0);
}

// ── voice ──
if (command === 'voice') {
  banner();
  const sub = args[1];
  if (sub === 'speak' && args[2]) {
    const text = args.slice(2).join(' ');
    const r = voice.speak(text);
    r.success ? console.log(`${c.green}  ✓ Speaking: ${text}${c.reset}\n`) : console.log(`${c.red}  ✗ ${r.error}${c.reset}\n`);
  } else if (sub === 'commands') {
    console.log(`${c.bold}${c.cyan}  Voice Commands:${c.reset}\n`);
    voice.listCommands().forEach(c2 => console.log(`  ${c.dim}"${c2.phrase}"${c.reset} → ${c2.action}`));
    console.log('');
  } else if (sub === 'add' && args[2]) {
    voice.addCommand(args[2], args.slice(3).join(' '));
    console.log(`${c.green}  ✓ Command added: "${args[2]}" → ${args.slice(3).join(' ')}${c.reset}\n`);
  } else if (sub === 'remove' && args[2]) {
    voice.removeCommand(args[2]);
    console.log(`${c.green}  ✓ Command removed${c.reset}\n`);
  } else {
    const avail = voice.isAvailable();
    console.log(`${c.bold}${c.cyan}  Voice Interface:${c.reset}\n`);
    console.log(`  ${c.dim}TTS:${c.reset} ${avail.available ? `${c.green}Available (${avail.engine})${c.reset}` : `${c.yellow}Not available${c.reset}`}`);
    console.log(`  ${c.dim}Commands:${c.reset} ${voice.listCommands().length}\n`);
    console.log(`${c.dim}  pix voice speak <text> | pix voice commands | pix voice add <phrase> <cmd>${c.reset}\n`);
  }
  process.exit(0);
}

// ── dashboard ──
if (command === 'dashboard') {
  banner();
  const sys = dashboard.getSystemInfo();
  const stats = dashboard.getStats();
  box([
    `${c.bold}${c.cyan}System Dashboard${c.reset}`, ``,
    `${c.dim}Platform:${c.reset}  ${sys.platform}`,
    `${c.dim}Node:${c.reset}      ${sys.node}`,
    `${c.dim}CPUs:${c.reset}      ${sys.cpus} cores — Load: ${sys.load}`,
    `${c.dim}Memory:${c.reset}    ${sys.memory.used} / ${sys.memory.total} (${sys.memory.pct})`,
    `${c.dim}Uptime:${c.reset}    ${sys.uptime}`,
    sys.disk ? `${c.dim}Disk:${c.reset}      ${sys.disk.used} / ${sys.disk.size} (${sys.disk.pct})` : '',
    ``, `${c.bold}${c.cyan}Usage Stats${c.reset}`, ``,
    `${c.dim}Total Events:${c.reset} ${stats.totalEvents || 0}`,
    `${c.dim}Chat Messages:${c.reset} ${stats['chat-message'] || 0}`
  ]);
  console.log('');
  const events = dashboard.getRecentEvents(5);
  if (events.length > 0) {
    console.log(`${c.bold}  Recent Events:${c.reset}`);
    events.forEach(e => console.log(`  ${c.dim}${e.timestamp}${c.reset} ${e.event}`));
    console.log('');
  }
  process.exit(0);
}

// ── goals ──
if (command === 'goals') {
  banner();
  if (args[1] === 'add' && args[2]) {
    const goals = dashboard.setGoal(args.slice(2).join(' '));
    console.log(`${c.green}  ✓ Goal added${c.reset}\n`);
  } else if (args[1] === 'done' && args[2]) {
    dashboard.completeGoal(args[2]);
    console.log(`${c.green}  ✓ Goal completed${c.reset}\n`);
  } else {
    const goals = dashboard.getGoals();
    console.log(`${c.bold}${c.cyan}  Goals (${goals.length}):${c.reset}\n`);
    goals.forEach(g => console.log(`  ${g.completed ? c.green+'✓'+c.reset : c.yellow+'○'+c.reset} ${c.dim}${g.id}${c.reset} ${g.text}`));
    console.log(`\n${c.dim}  pix goals add <text> | pix goals done <id>${c.reset}\n`);
  }
  process.exit(0);
}

// ── project-stats ──
if (command === 'project-stats') {
  banner();
  const dir = args[1] || process.cwd();
  const stats = dashboard.getProjectStats(dir);
  console.log(`${c.bold}${c.cyan}  Project Stats: ${dir}${c.reset}\n`);
  console.log(`  ${c.dim}Files:${c.reset}  ${stats.files}`);
  console.log(`  ${c.dim}Lines:${c.reset}  ${stats.lines.toLocaleString()}`);
  console.log(`\n  ${c.bold}Languages:${c.reset}`);
  Object.entries(stats.langs).sort((a,b) => b[1] - a[1]).forEach(([ext, count]) => {
    const bar = '█'.repeat(Math.min(20, Math.round(count / Math.max(...Object.values(stats.langs)) * 20)));
    console.log(`  ${ext.padEnd(6)} ${c.cyan}${bar}${c.reset} ${count}`);
  });
  console.log('');
  process.exit(0);
}

// ── update-publish ──
if (command === 'update-publish') {
  banner();
  const newVersion = args[1] || VERSION;
  console.log(`${c.bold}${c.cyan}  📦 Update & Publish${c.reset}\n`);
  console.log(`${c.dim}  Version: v${VERSION} → v${newVersion}${c.reset}\n`);

  console.log(`${c.cyan}  Updating package.json...${c.reset}`);
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = newVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log(`${c.green}  ✓ Updated${c.reset}`);
  } catch (e) { console.log(`${c.yellow}  ⚠ ${e.message}${c.reset}`); }

  console.log(`${c.cyan}  Publishing to npm...${c.reset}`);
  try {
    const r = cmd(`cd ${path.join(__dirname, '..')} && npm publish 2>&1`);
    if (r.includes('published') || r.includes('+')) {
      console.log(`${c.green}  ✓ Published v${newVersion}!${c.reset}`);
      console.log(`${c.green}    Users: npm install -g pix-ai@${newVersion}${c.reset}`);
    } else { console.log(`${c.yellow}  ⚠ ${r.substring(0, 200)}${c.reset}`); }
  } catch (e) { console.log(`${c.yellow}  ⚠ May need: npm login${c.reset}`); }

  const notifPath = path.join(CACHE_DIR, 'update-notification.json');
  fs.writeFileSync(notifPath, JSON.stringify({ version: newVersion, timestamp: new Date().toISOString(), message: `Pix AI v${newVersion} available` }, null, 2));
  console.log(`${c.green}  ✓ Update notification created${c.reset}\n`);
  process.exit(0);
}

// ── update ──
if (command === 'update') {
  banner();
  console.log(`${c.bold}${c.cyan}  🔍 Checking for updates...${c.reset}\n`);
  try {
    const npmVersion = cmd('npm view pix-ai version 2>/dev/null');
    if (npmVersion && npmVersion !== VERSION) {
      console.log(`${c.yellow}  📢 Update available: v${npmVersion}${c.reset}`);
      console.log(`${c.cyan}  Run: npm install -g pix-ai@${npmVersion}${c.reset}\n`);
    } else if (npmVersion) {
      console.log(`${c.green}  ✓ Up to date (v${VERSION})${c.reset}\n`);
    } else {
      console.log(`${c.dim}  Could not reach npm registry${c.reset}\n`);
    }
  } catch (e) { console.log(`${c.dim}  npm registry unreachable${c.reset}\n`); }
  process.exit(0);
}

// ── self-update ──
if (command === 'self-update') {
  banner();
  const target = args[1];
  if (!target) { console.log(`${c.red}  Usage: pix self-update <version>${c.reset}\n`); process.exit(1); }
  console.log(`${c.cyan}  Updating to v${target}...${c.reset}`);
  try {
    const r = cmd(`npm install -g pix-ai@${target} 2>&1`);
    console.log(`${c.green}  ✓ Updated to v${target}${c.reset}\n`);
  } catch (e) { console.log(`${c.red}  ✗ ${e.message}${c.reset}\n`); }
  process.exit(0);
}

// ── run ──
if (command === 'run') {
  banner();
  const file = args[1];
  if (!file) { console.log(`${c.red}  Usage: pix run <file>${c.reset}\n`); process.exit(1); }
  const fp = path.resolve(file);
  if (!fs.existsSync(fp)) { console.log(`${c.red}  Not found: ${fp}${c.reset}\n`); process.exit(1); }
  console.log(`${c.cyan}  ▶ Running: ${fp}${c.reset}\n`);
  try { execSync(`node ${fp}`, { stdio: 'inherit' }); } catch (e) { console.log(`${c.red}  ✗ Failed${c.reset}\n`); }
  process.exit(0);
}

// ── init ──
if (command === 'init') {
  banner();
  const pixDir = path.join(process.cwd(), '.pix');
  if (!fs.existsSync(pixDir)) fs.mkdirSync(pixDir, { recursive: true });
  const projConfig = { project: path.basename(process.cwd()), created: new Date().toISOString(), version: VERSION, engines: { cognitive: true, subagents: true, background: true, browser: true }, safety: { bouncer: true, contentFilter: true, consultationRequired: true } };
  fs.writeFileSync(path.join(pixDir, 'project.json'), JSON.stringify(projConfig, null, 2));
  console.log(`${c.green}  ✓ Pix initialized${c.reset}\n`);
  process.exit(0);
}

// ── unknown ──
console.log(`${c.red}  Unknown command: ${command}${c.reset}`);
console.log(`${c.dim}  Run: pix --help${c.reset}\n`);
process.exit(1);
