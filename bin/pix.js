#!/usr/bin/env node
/**
 * Pix AI — Autonomous AI Coding Companion
 * v2.5.0 · by Aghosh-mv · justcode
 * Clean CLI like Claude Code
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const crypto = require('crypto');
const readline = require('readline');
const { execSync } = require('child_process');

// ── Modules ──
const MultiModel = require('../src/modules/cli/multi-model');
const AutoSearch = require('../src/modules/cli/search');
const CompactionEngine = require('../src/modules/features/compaction');
const PixSave = require('../src/modules/cli/pixsave');
const CredentialVault = require('../src/modules/cli/credentials');
const ToolDiscovery = require('../src/modules/cli/tool-discovery');
const PersistentMemory = require('../src/modules/cli/memory');
const GitAutopilot = require('../src/modules/cli/git-autopilot');
const VoiceMode = require('../src/modules/cli/voice');
const PluginMarketplace = require('../src/modules/cli/plugins');
const PreSnapshot = require('../src/modules/cli/snapshot');
const TaskRouter = require('../src/modules/cli/task-router');
const SandboxAgent = require('../src/modules/cli/sandbox');
const PIIMasking = require('../src/modules/cli/pii-masking');
const ContentFilter = require('../src/modules/cli/content-filter');
const PromptTransparency = require('../src/modules/cli/prompt-trace');
const UncensoredPersonality = require('../src/modules/cli/personality');

// ── Config ──
const VERSION = '2.5.0';
const BY = 'by Aghosh-mv · justcode';
const PIX_HOME = path.join(os.homedir(), '.pix');
const CONFIG_FILE = path.join(PIX_HOME, 'config.json');
const SESSIONS_DIR = path.join(PIX_HOME, 'sessions');

function ensureDirs() { [PIX_HOME, SESSIONS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }); }
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) {
    return { apiKey: '', provider: 'openrouter', providers: {}, models: [], fallbackChain: [], autoCompactThreshold: 50, autoSearch: true, promptTrace: false, uncensored: false };
  }
}
function saveConfig(c) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2)); }
function git(cmd) { try { return execSync(cmd, { encoding: 'utf8', cwd: process.cwd() }).trim(); } catch (e) { return ''; } }

ensureDirs();
const config = loadConfig();

// ── Initialize modules ──
const multiModel = new MultiModel(() => config, (p) => config.providers?.[p] || config.apiKey);
const autoSearch = new AutoSearch(config.autoSearch);
const compaction = new CompactionEngine(PIX_HOME);
const pixsave = new PixSave();
const vault = new CredentialVault();
const tools = new ToolDiscovery(vault);
const memory = new PersistentMemory(PIX_HOME);
const gitAuto = new GitAutopilot();
const voice = new VoiceMode((p) => config.providers?.[p] || config.apiKey);
const plugins = new PluginMarketplace();
const snapshot = new PreSnapshot();
const taskRouter = new TaskRouter(config);
const sandbox = new SandboxAgent();
const pii = new PIIMasking();
const contentFilter = new ContentFilter(config.provider);
const promptTrace = new PromptTransparency();
const personality = new UncensoredPersonality();

if (config.uncensored) { contentFilter.setUncensored(true); personality.enabled = true; }

// ── State ──
let currentSessionId = null;
let sessionMessages = [];
let contextTrack = { filesOpened: [], filesModified: [], commandsRun: [], decisions: [], notes: [], fileSnapshots: {} };

// ══════════════════════════════════════════════
// ANSI
// ══════════════════════════════════════════════

const T = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', clear: '\x1b[2J\x1b[H',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
  white: '\x1b[37m', gray: '\x1b[90m', bg: '\x1b[48;5;236m',
};

function print(line) { process.stdout.write(`  ${line}\n`); }
function printLines(lines) { lines.forEach(l => print(l)); }
function divider() { print(`${T.gray}${'─'.repeat(50)}${T.reset}`); }

// ══════════════════════════════════════════════
// INTRO / SPLASH
// ══════════════════════════════════════════════

function showIntro() {
  const branch = git('git branch --show-current');
  const dir = path.basename(process.cwd());
  const prov = config.provider;
  const key = config.apiKey ? '***' + config.apiKey.slice(-4) : 'not set';

  console.log(T.clear);
  console.log('');
  console.log(`  ${T.bold}${T.magenta} pix ${T.reset}${T.gray}v${VERSION}${T.reset}`);
  console.log(`  ${T.gray}${BY}${T.reset}`);
  console.log('');
  console.log(`  ${T.gray}provider${T.reset}  ${prov}`);
  console.log(`  ${T.gray}api key${T.reset}   ${key}`);
  console.log(`  ${T.gray}project${T.reset}   ${dir}`);
  console.log(`  ${T.gray}branch${T.reset}    ${branch || 'none'}`);
  console.log('');
  console.log(`  ${T.gray}type ${T.bold}${T.white}help${T.reset}${T.gray} for commands, or just ask anything${T.reset}`);
  console.log('');

  const personalityGreeting = personality.getGreeting();
  if (personalityGreeting) {
    print(`${T.gray}${personalityGreeting}${T.reset}`);
    console.log('');
  }
}

// ══════════════════════════════════════════════
// PROMPT
// ══════════════════════════════════════════════

function getPrompt() {
  const branch = git('git branch --show-current');
  const dir = path.basename(process.cwd());
  const parts = [
    `${T.bold}${T.green}pix${T.reset}`,
    `${T.gray}${dir}${T.reset}`,
  ];
  if (branch) parts.push(`${T.cyan}${branch}${T.reset}`);
  parts.push(`${T.green}❯${T.reset}`);
  return parts.join(` ${T.gray}│${T.reset} `);
}

// ══════════════════════════════════════════════
// ASK AI
// ══════════════════════════════════════════════

function askAI(raw, cb) {
  if (!config.apiKey) { print(`${T.red}No API key. Run: pix config --set-key <key>${T.reset}`); cb(); return; }

  const route = taskRouter.getRouting(raw, Object.keys(config.providers || {}).filter(k => config.providers[k]));
  let masked = pii.mask(raw);

  const filterResult = contentFilter.filter(masked);
  if (filterResult.filtered && filterResult.text.includes('[BLOCKED]')) {
    print(`${T.red}${filterResult.text}${T.reset}`);
    cb();
    return;
  }

  const messages = [];
  const memCtx = memory.getFullContext(process.cwd());
  if (memCtx.length > 50) messages.push({ role: 'system', content: memCtx });
  if (sessionMessages.length > 0 && sessionMessages[0].role === 'system') messages.push(sessionMessages[0]);
  messages.push({ role: 'user', content: filterResult.text });

  if (config.promptTrace) {
    const trace = promptTrace.tracePrompt({ userMessage: raw, memoryContext: memCtx.length > 50 ? memCtx : null, memoryFactCount: memory.stats().totalFacts });
    promptTrace.renderHighlighted(trace).forEach(l => print(l));
  }

  print(`${T.gray}→ ${route.provider} (${route.tier})${T.reset}`);

  multiModel.askChain(messages, (reply, err, usedProvider) => {
    if (reply) {
      reply.split('\n').forEach(l => print(l));
      print('');
      if (!currentSessionId) newSession();
      saveMsg(currentSessionId, 'user', raw);
      saveMsg(currentSessionId, 'assistant', reply);
      memory.remember(raw.substring(0, 100), reply.substring(0, 200), { category: 'conversation', project: process.cwd() });

      const broJoke = personality.getBroJoke();
      if (broJoke) print(`${T.gray}${broJoke}${T.reset}\n`);

      autoCompact();
    } else {
      print(`${T.red}✗ ${err || 'no response'}${T.reset}\n`);
    }
    cb();
  });
}

// ══════════════════════════════════════════════
// SESSION
// ══════════════════════════════════════════════

function newSession() {
  const id = crypto.randomBytes(4).toString('hex');
  currentSessionId = id;
  sessionMessages = [];
  contextTrack = { filesOpened: [], filesModified: [], commandsRun: [], decisions: [], notes: [], fileSnapshots: {} };
  fs.writeFileSync(path.join(SESSIONS_DIR, `${id}.json`), JSON.stringify({ id, cwd: process.cwd(), created: new Date().toISOString(), messages: [] }));
  return id;
}

function saveMsg(sessionId, role, content) {
  sessionMessages.push({ role, content, timestamp: new Date().toISOString() });
  try {
    const f = path.join(SESSIONS_DIR, `${sessionId}.json`);
    const s = JSON.parse(fs.readFileSync(f, 'utf8'));
    s.messages.push({ role, content, t: Date.now() });
    fs.writeFileSync(f, JSON.stringify(s));
  } catch (e) {}
}

function autoCompact() {
  const threshold = config.autoCompactThreshold || 50;
  if (sessionMessages.length >= threshold && currentSessionId) {
    print(`${T.yellow}● auto-compacting ${sessionMessages.length} messages...${T.reset}`);
    const result = compaction.compact(currentSessionId, sessionMessages, { cwd: process.cwd(), gitBranch: git('git branch --show-current'), ...contextTrack });
    print(`${T.green}✓ saved ${result.compressed} bytes (${result.ratio}% compressed)${T.reset}\n`);
    sessionMessages = [{ role: 'system', content: `Previous session compacted as ${result.id}. ${sessionMessages.length} messages.` }];
  }
}

// ══════════════════════════════════════════════
// COMMANDS
// ══════════════════════════════════════════════

function handleCommand(raw) {
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0];
  const arg = parts.slice(1).join(' ');

  switch (cmd) {
    case 'help':
      printLines([
        '',
        `  ${T.bold}${T.magenta}pix${T.reset} ${T.gray}v${VERSION}${T.reset}`,
        '',
        `  ${T.gray}Usage:${T.reset}`,
        '',
        `    ${T.bold}ask${T.reset}  <question>       Ask a question`,
        `    ${T.bold}review${T.reset} <file>         Review a file`,
        `    ${T.bold}git${T.reset}  <sub>            Git autopilot`,
        `    ${T.bold}models${T.reset}               Provider & chain`,
        `    ${T.bold}compact${T.reset}              Manual compaction`,
        `    ${T.bold}restore${T.reset} <id>          Restore compaction`,
        `    ${T.bold}save${T.reset} <name> <code>   Save to PixSave`,
        `    ${T.bold}load${T.reset} <package>       Install from PixSave`,
        `    ${T.bold}creds${T.reset} add <e> <p>    Save credentials`,
        `    ${T.bold}tools${T.reset}                Available tools`,
        `    ${T.bold}suggest${T.reset} <problem>    Tool suggestions`,
        `    ${T.bold}remember${T.reset} <k> <v>     Save to memory`,
        `    ${T.bold}recall${T.reset} <query>       Recall from memory`,
        `    ${T.bold}snapshot${T.reset}             Pre-rewrite backup`,
        `    ${T.bold}sandbox${T.reset} <task>       Run in sandbox`,
        `    ${T.bold}plugins${T.reset}              Plugin marketplace`,
        `    ${T.bold}voice${T.reset} on|off         Toggle voice`,
        `    ${T.bold}prompt${T.reset} on|off        Prompt transparency`,
        `    ${T.bold}scan${T.reset} <text>          Scan for PII`,
        `    ${T.bold}filter${T.reset}               Content filter info`,
        `    ${T.bold}config${T.reset}              Configure`,
        `    ${T.bold}status${T.reset}              System info`,
        `    ${T.bold}doctor${T.reset}              Diagnostics`,
        `    ${T.bold}version${T.reset}             Version`,
        `    ${T.bold}clear${T.reset}               Clear screen`,
        `    ${T.bold}exit${T.reset}                Quit`,
        ''
      ]);
      break;

    case 'clear': console.log(T.clear); break;
    case 'version': print(`pix v${VERSION} ${BY}`); break;

    case 'doctor':
      divider(); print(`${T.bold}diagnostics${T.reset}`); divider();
      [
        ['node', process.version], ['pix home', fs.existsSync(PIX_HOME) ? `${T.green}✓${T.reset}` : `${T.red}✗${T.reset}`],
        ['config', fs.existsSync(CONFIG_FILE) ? `${T.green}✓${T.reset}` : `${T.red}✗${T.reset}`],
        ['api key', config.apiKey ? '***' + config.apiKey.slice(-4) : `${T.yellow}not set${T.reset}`],
        ['platform', `${os.platform()} ${os.arch()}`],
        ['content-filter', contentFilter.getProfile().level],
        ['pii-masking', `${T.green}active${T.reset}`],
        ['sandbox', `${sandbox.list().length} active`],
        ['memory', `${memory.stats().totalFacts} facts`],
        ['snapshots', `${snapshot.list().length} saved`],
      ].forEach(([k, v]) => print(`  ${T.gray}${k.padEnd(16)}${T.reset} ${v}`));
      print('');
      break;

    case 'status':
      divider(); print(`${T.bold}pix${T.reset} ${T.gray}v${VERSION}${T.reset}`); divider();
      const total = os.totalmem(), free = os.freemem();
      const fmt = b => { const u = ['B','KB','MB','GB']; let i = 0; while (b >= 1024 && i < u.length-1) { b /= 1024; i++; } return b.toFixed(1)+u[i]; };
      let disk = '';
      try { const o = execSync('df -h /', { encoding: 'utf8' }); const p = o.split('\n')[1]?.split(/\s+/); if (p) disk = p[2]+'/'+p[3]; } catch (e) {}
      [
        ['provider', config.provider], ['api key', config.apiKey ? '***'+config.apiKey.slice(-4) : 'not set'],
        ['models', config.models?.length ? config.models.join(' → ') : 'auto (MoE)'],
        ['content-filter', contentFilter.getProfile().level],
        ['node', process.version], ['load', os.loadavg()[0].toFixed(2)],
        ['memory', fmt(total-free)+'/'+fmt(total)], disk ? ['disk', disk] : null,
        ['session msgs', `${sessionMessages.length}`], ['compactions', `${compaction.list().length}`],
        ['facts', `${memory.stats().totalFacts}`], ['snapshots', `${snapshot.list().length}`],
        ['sandbox agents', `${sandbox.list().length}`], ['plugins', `${plugins.listInstalled().length}`],
        ['pii masked', `${pii.getStats().masked}`],
      ].filter(Boolean).forEach(([k,v]) => print(`  ${T.gray}${k.padEnd(16)}${T.reset} ${v}`));
      print('');
      break;

    case 'config':
      if (arg.startsWith('--set-key ')) { config.apiKey = arg.replace('--set-key ', ''); saveConfig(config); print(`${T.green}✓${T.reset} api key saved`); }
      else if (arg.startsWith('--set-provider ')) { config.provider = arg.replace('--set-provider ', ''); saveConfig(config); contentFilter.setModel(config.provider); print(`${T.green}✓${T.reset} provider: ${config.provider}`); }
      else if (arg === '--auto-search on') { config.autoSearch = true; saveConfig(config); print(`${T.green}✓${T.reset} auto-search on`); }
      else if (arg === '--auto-search off') { config.autoSearch = false; saveConfig(config); print(`${T.green}✓${T.reset} auto-search off`); }
      else if (arg === '--uncensored on') { config.uncensored = true; contentFilter.setUncensored(true); personality.enabled = true; saveConfig(config); print(`${T.green}✓${T.reset} uncensored mode on`); }
      else if (arg === '--uncensored off') { config.uncensored = false; contentFilter.setUncensored(false); personality.enabled = false; saveConfig(config); print(`${T.green}✓${T.reset} uncensored mode off`); }
      else if (arg.startsWith('--compact-threshold ')) { config.autoCompactThreshold = parseInt(arg.split(' ')[1]) || 50; saveConfig(config); print(`${T.green}✓${T.reset} auto-compact every ${config.autoCompactThreshold} msgs`); }
      else {
        divider(); print(`${T.bold}config${T.reset}`); divider();
        print(`  ${T.gray}provider${T.reset}         ${config.provider}`);
        print(`  ${T.gray}api key${T.reset}          ${config.apiKey ? '***'+config.apiKey.slice(-4) : `${T.yellow}not set${T.reset}`}`);
        print(`  ${T.gray}models${T.reset}           ${config.models?.length ? config.models.join(' → ') : 'auto (MoE)'}`);
        print(`  ${T.gray}auto-search${T.reset}      ${config.autoSearch ? 'on' : 'off'}`);
        print(`  ${T.gray}uncensored${T.reset}       ${config.uncensored ? 'on' : 'off'}`);
        print(`  ${T.gray}compact-threshold${T.reset} ${config.autoCompactThreshold || 50} msgs`);
        print('');
        print(`  ${T.gray}pix config --set-key <key>${T.reset}`);
        print(`  ${T.gray}pix config --set-provider <provider>${T.reset}`);
        print(`  ${T.gray}pix config --uncensored on|off${T.reset}`);
      }
      print('');
      break;

    case 'models':
      if (arg.startsWith('set ')) { const chain = arg.replace('set ', '').split(/[,\s]+/).filter(Boolean); config.models = chain; saveConfig(config); print(`${T.green}✓${T.reset} chain: ${chain.join(' → ')}`); }
      else if (arg === 'moe on') { config.models = []; config.fallbackChain = []; saveConfig(config); print(`${T.green}✓${T.reset} MoE auto-routing enabled`); }
      else {
        divider(); print(`${T.bold}models${T.reset}`); divider();
        const chain = multiModel.getChain('');
        print(`  ${T.gray}active chain${T.reset}    ${chain.join(' → ')}`);
        print(`  ${T.gray}mode${T.reset}            ${config.models?.length ? 'explicit' : 'MoE auto'}`);
        print('');
        multiModel.listProviders().forEach(p => print(`    ${p.hasKey ? `${T.green}●${T.reset}` : `${T.gray}○${T.reset}`} ${p.name.padEnd(12)} ${p.model}`));
        print('');
        print(`  ${T.gray}pix models set groq,openai,anthropic${T.reset}`);
        print(`  ${T.gray}pix models moe on${T.reset}`);
      }
      print('');
      break;

    case 'compact':
      if (!currentSessionId) { print(`${T.gray}no active session${T.reset}`); break; }
      print(`${T.yellow}● compacting ${sessionMessages.length} messages...${T.reset}`);
      const cr = compaction.compact(currentSessionId, sessionMessages, { cwd: process.cwd(), gitBranch: git('git branch --show-current'), ...contextTrack });
      print(`${T.green}✓${T.reset} id: ${cr.id} · ${cr.original} → ${cr.compressed} bytes (${cr.ratio}%)`);
      print('');
      break;

    case 'restore':
      if (!arg) { print(`${T.gray}pix restore <id>${T.reset}`); break; }
      const rd = compaction.restore(arg);
      if (!rd) { print(`${T.red}✗ compaction ${arg} not found${T.reset}`); break; }
      divider(); print(`${T.bold}restored: ${rd.id}${T.reset} ${T.gray}${rd.messageCount} messages${T.reset}`); divider();
      rd.messages.slice(-10).forEach(m => {
        const role = m.role === 'user' ? `${T.green}❯${T.reset}` : `${T.magenta}pix${T.reset}`;
        m.content.split('\n').forEach(l => print(`  ${role} ${l}`));
      });
      print('');
      break;

    case 'compactions': {
      const list = compaction.list();
      divider(); print(`${T.bold}compactions${T.reset} ${T.gray}(${list.length})${T.reset}`); divider();
      list.forEach(s => print(`  ${T.gray}${s.id}${T.reset}  ${s.messageCount} msgs  ${s.compressed} bytes  ${s.ratio}%`));
      if (list.length === 0) print(`  ${T.gray}none yet${T.reset}`);
      print('');
      break;
    }

    case 'search':
      if (!arg) { print(`${T.gray}pix search <query>${T.reset}`); break; }
      const results = compaction.search(arg);
      divider(); print(`${T.bold}search: "${arg}"${T.reset} ${T.gray}(${results.length} results)${T.reset}`); divider();
      results.slice(0, 10).forEach(r => print(`  ${T.gray}${r.sessionId}${T.reset}  ${r.type || r.role}  ${r.content?.substring(0, 80)}`));
      if (results.length === 0) print(`  ${T.gray}no matches${T.reset}`);
      print('');
      break;

    case 'review':
      if (!arg) { print(`${T.gray}pix review <file>${T.reset}`); break; }
      const fp = path.resolve(arg);
      if (!fs.existsSync(fp)) { print(`${T.red}✗ ${arg} not found${T.reset}`); break; }
      contextTrack.filesOpened.push(fp);
      const content = fs.readFileSync(fp, 'utf8');
      contextTrack.fileSnapshots[fp] = content;
      const lines = content.split('\n');
      const issues = [];
      lines.forEach((line, i) => {
        const n = i + 1;
        if (line.length > 120) issues.push({ l: n, s: 'w', m: `line too long (${line.length})` });
        if (line.includes('TODO')) issues.push({ l: n, s: 'i', m: 'TODO' });
        if (line.includes('FIXME')) issues.push({ l: n, s: 'w', m: 'FIXME' });
        if (/eval\(/.test(line)) issues.push({ l: n, s: 'e', m: 'eval() security risk' });
        if (/password|secret|api.?key/i.test(line) && /=.+['"]/) issues.push({ l: n, s: 'e', m: 'hardcoded secret' });
      });
      const score = Math.max(0, 100 - issues.filter(i=>i.s==='e').length*15 - issues.filter(i=>i.s==='w').length*5 - issues.length*2);
      const sc = score >= 80 ? T.green : score >= 60 ? T.yellow : T.red;
      divider(); print(`${T.bold}${path.basename(fp)}${T.reset} ${T.gray}${lines.length} lines · score ${sc}${score}/100${T.reset}`); divider();
      if (issues.length === 0) { print(`${T.green}✓ no issues${T.reset}`); }
      else { issues.forEach(i => {
        const sev = i.s === 'e' ? `${T.red}error${T.reset}` : i.s === 'w' ? `${T.yellow}warn${T.reset}` : `${T.blue}info${T.reset}`;
        print(`  ${T.gray}L${i.l}${T.reset}  ${sev}  ${i.m}`);
      }); }
      print('');
      break;

    case 'git': {
      const sub = arg || 'status';
      if (sub === 'status' || sub === '') {
        const branch = git('git branch --show-current');
        const changes = git('git status --porcelain').split('\n').filter(Boolean);
        const recent = git('git log --oneline -5').split('\n');
        divider(); print(`${T.bold}git${T.reset}`); divider();
        print(`  ${T.gray}branch${T.reset}  ${branch || `${T.red}none${T.reset}`}`);
        print(`  ${T.gray}changes${T.reset} ${changes.length} files`);
        if (changes.length > 0) { print(''); changes.slice(0,5).forEach(f => print(`    ${T.cyan}·${T.reset} ${f}`)); }
        print(''); print(`  ${T.gray}recent:${T.reset}`);
        recent.forEach(c => print(`    ${c}`));
      } else if (sub.startsWith('commit ')) {
        const msg = sub.replace('commit ', '');
        const r = gitAuto.commit(msg);
        print(r.ok ? `${T.green}✓${T.reset} committed: ${msg}` : `${T.red}✗ ${r.error}${T.reset}`);
      } else if (sub === 'auto-commit') {
        const r = gitAuto.autoCommit();
        print(r.ok ? `${T.green}✓${T.reset} ${r.message} (${r.hash})` : `${T.red}✗ ${r.error}${T.reset}`);
      } else if (sub === 'diff') {
        const diff = git('git diff --stat');
        print(`\n  ${diff || `${T.gray}no changes${T.reset}`}\n`);
      }
      print('');
      break;
    }

    case 'save':
      if (!arg) { print(`${T.gray}pix save <name> <code>${T.reset}`); break; }
      const saveParts = arg.split(/\s+/);
      const sr = pixsave.saveSnippet(saveParts[0], saveParts.slice(1).join(' '));
      print(sr.ok ? `${T.green}✓${T.reset} saved: ${sr.name} v${sr.version}` : `${T.red}✗ ${sr.error}${T.reset}`);
      print('');
      break;

    case 'load':
      if (!arg) { print(`${T.gray}pix load <package>${T.reset}`); break; }
      const lr = pixsave.install(arg, process.cwd());
      print(lr.ok ? `${T.green}✓${T.reset} installed: ${lr.name} v${lr.version}` : `${T.red}✗ ${lr.error}${T.reset}`);
      print('');
      break;

    case 'registry': {
      const list = pixsave.list();
      divider(); print(`${T.bold}registry${T.reset} ${T.gray}(${list.length})${T.reset}`); divider();
      list.forEach(p => print(`  ${T.gray}${p.name.padEnd(20)}${T.reset} ${p.description.substring(0, 40)}  ⭐${p.stars}  ↓${p.downloads}`));
      if (list.length === 0) print(`  ${T.gray}empty${T.reset}`);
      print('');
      break;
    }

    case 'creds':
      if (arg.startsWith('add ')) {
        const credParts = arg.replace('add ', '').split(/\s+/);
        const [email, pass, ...domainParts] = credParts;
        const domain = domainParts.join(' ') || 'github.com';
        const cr = vault.add(domain, email, pass);
        print(cr.ok ? `${T.green}✓${T.reset} credentials saved for ${domain}` : `${T.red}✗ ${cr.reason}${T.reset}`);
      } else {
        const list = vault.list();
        divider(); print(`${T.bold}credentials${T.reset}`); divider();
        list.forEach(c => print(`  ${T.gray}${c.domain}${T.reset}  ${c.email}`));
        if (list.length === 0) print(`  ${T.gray}none saved${T.reset}`);
      }
      print('');
      break;

    case 'tools': {
      const list = tools.available();
      divider(); print(`${T.bold}tools${T.reset}`); divider();
      list.forEach(t => print(`    ${t.installed ? `${T.green}●${T.reset}` : `${T.gray}○${T.reset}`} ${t.name.padEnd(12)} ${t.type}`));
      print('');
      break;
    }

    case 'suggest':
      if (!arg) { print(`${T.gray}pix suggest <problem>${T.reset}`); break; }
      const suggestions = tools.suggest(arg);
      divider(); print(`${T.bold}suggestions: ${arg}${T.reset}`); divider();
      if (suggestions.cli.length > 0) { print(`  ${T.gray}CLI tools:${T.reset}`); suggestions.cli.forEach(t => print(`    ${t.installed ? `${T.green}●${T.reset}` : `${T.gray}○${T.reset}`} ${t.name}`)); }
      if (suggestions.web.length > 0) { print(`  ${T.gray}Web apps:${T.reset}`); suggestions.web.forEach(a => print(`    ${a.safe ? `${T.green}●${T.reset}` : `${T.gray}○${T.reset}`} ${a.name}`)); }
      print('');
      break;

    case 'remember':
      if (!arg) { print(`${T.gray}pix remember <key> <value>${T.reset}`); break; }
      const remParts = arg.split(/\s+/);
      memory.remember(remParts[0], remParts.slice(1).join(' '), { project: process.cwd() });
      print(`${T.green}✓${T.reset} remembered: ${remParts[0]}`);
      print('');
      break;

    case 'recall':
      if (!arg) { print(`${T.gray}pix recall <query>${T.reset}`); break; }
      const recalled = memory.recall(arg);
      divider(); print(`${T.bold}recall: "${arg}"${T.reset} ${T.gray}(${recalled.length})${T.reset}`); divider();
      recalled.forEach(r => print(`  ${T.gray}[${r.category}]${T.reset} ${r.key}: ${r.value.substring(0, 80)}`));
      if (recalled.length === 0) print(`  ${T.gray}nothing found${T.reset}`);
      print('');
      break;

    case 'memory': {
      const ms = memory.stats();
      divider(); print(`${T.bold}memory${T.reset}`); divider();
      print(`  ${T.gray}total facts${T.reset}     ${ms.totalFacts}`);
      print(`  ${T.gray}conversations${T.reset}   ${ms.totalConversations}`);
      print(`  ${T.gray}patterns${T.reset}        ${ms.totalPatterns}`);
      print(`  ${T.gray}errors fixed${T.reset}    ${ms.totalErrors}`);
      print(`  ${T.gray}user prefs${T.reset}      ${ms.userPrefs}`);
      print(`  ${T.gray}projects${T.reset}        ${ms.projects}`);
      print('');
      break;
    }

    case 'snapshot':
      print(`${T.yellow}● taking snapshot...${T.reset}`);
      const snap = snapshot.snapshotPix('manual');
      print(`${T.green}✓${T.reset} snapshot: ${snap.id} · ${snap.files} files · ${snap.size} bytes`);
      print('');
      break;

    case 'restore-snap':
      if (!arg) { print(`${T.gray}pix restore-snap <id>${T.reset}`); break; }
      const rs = snapshot.restore(arg);
      print(rs.ok ? `${T.green}✓${T.reset} restored ${rs.restored} files` : `${T.red}✗ ${rs.error}${T.reset}`);
      print('');
      break;

    case 'snapshots': {
      const list = snapshot.list();
      divider(); print(`${T.bold}snapshots${T.reset} ${T.gray}(${list.length})${T.reset}`); divider();
      list.forEach(s => print(`  ${T.gray}${s.id}${T.reset}  ${s.label}  ${s.files.length} files  ${s.timestamp?.split('T')[0] || ''}`));
      if (list.length === 0) print(`  ${T.gray}none yet${T.reset}`);
      print('');
      break;
    }

    case 'sandbox':
      if (arg === 'list') {
        const list = sandbox.list();
        divider(); print(`${T.bold}sandboxes${T.reset} ${T.gray}(${list.length})${T.reset}`); divider();
        list.forEach(a => print(`  ${T.gray}${a.id}${T.reset}  ${a.status}  ${a.mutations} mutations  ${a.errors} errors`));
        if (list.length === 0) print(`  ${T.gray}none active${T.reset}`);
      } else if (arg) {
        print(`${T.yellow}● running in sandbox...${T.reset}`);
        const result = sandbox.quickTest(arg);
        print(`  ${result.safe ? `${T.green}✓ safe${T.reset}` : `${T.red}⚠ had errors${T.reset}`}`);
        print(`  ${T.gray}${result.summary}${T.reset}`);
      } else {
        print(`${T.gray}pix sandbox <task> | pix sandbox list${T.reset}`);
      }
      print('');
      break;

    case 'plugins': {
      const sub = arg || 'list';
      if (sub.startsWith('install ')) {
        const r = plugins.install(sub.replace('install ', ''));
        print(r.ok ? `${T.green}✓${T.reset} installed: ${r.name}` : `${T.red}✗ ${r.error}${T.reset}`);
      } else {
        const list = plugins.list();
        divider(); print(`${T.bold}plugins${T.reset}`); divider();
        const cats = {};
        list.forEach(p => { if (!cats[p.category]) cats[p.category] = []; cats[p.category].push(p); });
        Object.entries(cats).forEach(([cat, items]) => {
          print(`  ${T.gray}${cat}${T.reset}`);
          items.forEach(p => print(`    ${p.installed ? `${T.green}●${T.reset}` : `${T.gray}○${T.reset}`} ${p.name.padEnd(20)} ${p.description.substring(0, 35)}`));
          print('');
        });
      }
      print('');
      break;
    }

    case 'voice':
      if (arg === 'on') { voice.enabled = true; print(`${T.green}✓${T.reset} voice on`); }
      else if (arg === 'off') { voice.enabled = false; print(`${T.green}✓${T.reset} voice off`); }
      else { voice.toggle(); print(`${T.green}✓${T.reset} voice ${voice.enabled ? 'on' : 'off'}`); }
      print('');
      break;

    case 'prompt':
      if (arg === 'on') { config.promptTrace = true; saveConfig(config); print(`${T.green}✓${T.reset} prompt transparency on`); }
      else if (arg === 'off') { config.promptTrace = false; saveConfig(config); print(`${T.green}✓${T.reset} prompt transparency off`); }
      else { config.promptTrace = !config.promptTrace; saveConfig(config); print(`${T.green}✓${T.reset} prompt transparency ${config.promptTrace ? 'on' : 'off'}`); }
      print('');
      break;

    case 'scan':
      if (!arg) { print(`${T.gray}pix scan <text>${T.reset}`); break; }
      const findings = pii.scan(arg);
      divider(); print(`${T.bold}PII scan${T.reset} ${T.gray}(${findings.length} findings)${T.reset}`); divider();
      findings.forEach(f => print(`  ${T.gray}${f.type.padEnd(12)}${T.reset} ${f.value}`));
      if (findings.length === 0) print(`${T.green}✓ no PII detected${T.reset}`);
      print('');
      break;

    case 'filter': {
      const prof = contentFilter.getProfile();
      divider(); print(`${T.bold}content filter${T.reset}`); divider();
      print(`  ${T.gray}model${T.reset}      ${prof.name}`);
      print(`  ${T.gray}level${T.reset}      ${prof.level}`);
      print(`  ${T.gray}note${T.reset}       ${prof.note}`);
      print('');
      break;
    }

    case 'sessions': {
      let list = [];
      try {
        list = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json')).map(f => {
          try { return JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8')); } catch (e) { return null; }
        }).filter(Boolean);
      } catch (e) {}
      divider(); print(`${T.bold}sessions${T.reset} ${T.gray}(${list.length})${T.reset}`); divider();
      list.forEach(s => print(`  ${T.gray}${s.id}${T.reset}  ${s.cwd || '-'}  ${s.messages?.length || 0} msgs`));
      print('');
      break;
    }

    case 'cost': {
      let costs = { sessions: [], total: 0 };
      try { costs = JSON.parse(fs.readFileSync(path.join(PIX_HOME, 'costs.json'), 'utf8')); } catch (e) {}
      const today = new Date().toISOString().split('T')[0];
      const todayCosts = costs.sessions.filter(s => s.time?.startsWith(today));
      const todayTotal = todayCosts.reduce((s, x) => s + (x.cost || 0), 0);
      divider(); print(`${T.bold}cost${T.reset}`); divider();
      print(`  ${T.gray}total${T.reset}  $${(costs.total||0).toFixed(4)}`);
      print(`  ${T.gray}today${T.reset}  $${todayTotal.toFixed(4)}`);
      print(`  ${T.gray}calls${T.reset}  ${costs.sessions.length}`);
      print('');
      break;
    }

    case 'init': {
      const dir = path.join(process.cwd(), '.pix');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({ project: path.basename(process.cwd()), created: new Date().toISOString(), version: VERSION }, null, 2));
      print(`${T.green}✓${T.reset} initialized in ${process.cwd()}`);
      print('');
      break;
    }

    case 'exit': case 'quit': process.exit(0);

    default:
      if (!cmd) break;
      if (!currentSessionId) newSession();

      if (autoSearch.needsSearch(raw)) {
        print(`${T.cyan}⟳ searching web...${T.reset}`);
        autoSearch.search(raw, (searchData) => {
          if (searchData.raw) {
            contextTrack.notes.push({ content: `Search: ${searchData.raw}`, timestamp: new Date().toISOString() });
            sessionMessages.push({ role: 'system', content: `Web search results:\n${searchData.raw}` });
          }
          askAI(raw, () => {});
        });
      } else {
        askAI(raw, () => {});
      }
      break;
  }
}

// ══════════════════════════════════════════════
// MAIN LOOP
// ══════════════════════════════════════════════

showIntro();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: getPrompt() });

function prompt() {
  rl.question(getPrompt() + ' ', (answer) => {
    const text = answer.trim();
    if (!text) { prompt(); return; }
    handleCommand(text);
    prompt();
  });
}

rl.on('close', () => process.exit(0));
prompt();
