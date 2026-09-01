#!/usr/bin/env node
/**
 * Pix AI — Autonomous AI Coding Companion
 * v2.5.0 · by Aghosh-mv · justcode
 * 19 modules · MoE routing · PII masking · split screen · sandbox
 */
const blessed = require('blessed');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ── Modules ──
const MultiModel = require('../src/modules/cli/multi-model');
const AutoSearch = require('../src/modules/cli/search');
const CompactionEngine = require('../src/modules/features/compaction');
const PixSave = require('../src/modules/cli/pixsave');
const CredentialVault = require('../src/modules/cli/credentials');
const ToolDiscovery = require('../src/modules/cli/tool-discovery');
const SplitScreen = require('../src/modules/cli/split-screen');
const PersistentMemory = require('../src/modules/cli/memory');
const GitAutopilot = require('../src/modules/cli/git-autopilot');
const ImageUnderstanding = require('../src/modules/cli/image-understanding');
const VoiceMode = require('../src/modules/cli/voice');
const PluginMarketplace = require('../src/modules/cli/plugins');
const LiveCollab = require('../src/modules/cli/collab');
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

// ── Initialize all modules ──
const multiModel = new MultiModel(() => config, (p) => config.providers?.[p] || config.apiKey);
const autoSearch = new AutoSearch(config.autoSearch);
const compaction = new CompactionEngine(PIX_HOME);
const pixsave = new PixSave();
const vault = new CredentialVault();
const tools = new ToolDiscovery(vault);
const memory = new PersistentMemory(PIX_HOME);
const gitAuto = new GitAutopilot();
const imageAI = new ImageUnderstanding((p) => config.providers?.[p] || config.apiKey);
const voice = new VoiceMode((p) => config.providers?.[p] || config.apiKey);
const plugins = new PluginMarketplace();
const collab = new LiveCollab();
const snapshot = new PreSnapshot();
const taskRouter = new TaskRouter(config);
const sandbox = new SandboxAgent();
const pii = new PIIMasking();
const contentFilter = new ContentFilter(config.provider);
const promptTrace = new PromptTransparency();

// ── Session state ──
let currentSessionId = null;
let sessionMessages = [];
let contextTrack = { filesOpened: [], filesModified: [], commandsRun: [], decisions: [], notes: [], fileSnapshots: {} };

// ══════════════════════════════════════════════
// TUI
// ══════════════════════════════════════════════

const screen = blessed.screen({ smartCSR: true, title: 'pix', dockBorders: true, fullUnicode: true });

const statusBar = blessed.box({
  parent: screen, bottom: 0, left: 0, right: 0, height: 1,
  tags: true, style: { fg: '#18181b', bg: '#a1a1aa' },
  content: ` {bold}pix{/bold} {gray-fg}v${VERSION}{/gray-fg} │ {white-fg}${config.provider}{/white-fg} │ ${git('git branch --show-current') || 'detached'} │ ${path.basename(process.cwd())} `
});

const outputBox = blessed.box({
  parent: screen, top: 0, left: 0, right: 0, bottom: 2,
  tags: true, scrollable: true, alwaysScroll: true,
  scrollbar: { style: { bg: '#3f3f46' } },
  style: { fg: '#d4d4d8', bg: '#09090b' },
  padding: { left: 1, right: 1 }
});

const inputBox = blessed.box({
  parent: screen, bottom: 1, left: 0, right: 0, height: 3,
  tags: true, style: { fg: '#d4d4d8', bg: '#18181b', border: { fg: '#27272a' } },
  border: { type: 'line' }, padding: { left: 1 }
});

blessed.text({ parent: inputBox, left: 0, top: 0, width: '100%', height: 1, tags: true, content: '{#22c55e-fg}{bold}❯{/bold}{/bold}{/} ' });

const input = blessed.textarea({
  parent: inputBox, left: 3, top: 0, right: 0, height: 1,
  inputOnFocus: true, style: { fg: '#fafafa', bg: '#18181b', focus: { bg: '#18181b' } },
  keys: true, vi: true
});

const history = [];
let historyIdx = -1;

// ── Output helpers ──
function print(line) {
  const prev = outputBox.getContent();
  outputBox.setContent(prev ? prev + '\n' + line : line);
  outputBox.setScrollPerc(100);
  screen.render();
}
function printLines(lines) { lines.forEach(print); }
function divider() { print(`{#27272a-fg}${'─'.repeat(screen.width - 4)}{/}`); }

function updateStatusBar(model) {
  const chain = multiModel.getChain('');
  const snapCount = snapshot.list().length;
  const memStats = memory.stats();
  statusBar.setContent(` {bold}pix{/bold} {gray-fg}v${VERSION}{/gray-fg} │ {white-fg}${model || config.provider}{/white-fg} │ ${git('git branch --show-current') || 'detached'} │ ${path.basename(process.cwd())} │ {#22c55e-fg}msg:${sessionMessages.length}{/} │ ${snapCount > 0 ? `{#818cf8-fg}snap:${snapCount}{/}` : ''} `);
  screen.render();
}

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
    print(`  {#eab308-fg}● auto-compacting ${sessionMessages.length} messages...{/}`);
    const result = compaction.compact(currentSessionId, sessionMessages, {
      cwd: process.cwd(), gitBranch: git('git branch --show-current'), ...contextTrack,
    });
    print(`  {#22c55e-fg}✓ saved ${result.compressed} bytes (${result.ratio}% compressed){/}`);
    sessionMessages = [{ role: 'system', content: `Previous session compacted as ${result.id}. ${sessionMessages.length} messages.` }];
    updateStatusBar();
  }
}

// ══════════════════════════════════════════════
// ASK AI (with all modules wired)
// ══════════════════════════════════════════════

function askAI(raw, cb) {
  if (!config.apiKey) { cb('{red-fg}No API key. Run: pix config --set-key <key>{/}'); return; }

  // Task routing
  const route = taskRouter.getRouting(raw, Object.keys(config.providers || {}).filter(k => config.providers[k]));

  // PII masking
  let masked = pii.mask(raw);

  // Content filter
  const filterResult = contentFilter.filter(masked);
  if (filterResult.filtered && filterResult.text.includes('[BLOCKED]')) {
    cb(filterResult.text);
    return;
  }

  // Build messages with context
  const messages = [];

  // Memory context
  const memCtx = memory.getFullContext(process.cwd());
  if (memCtx.length > 50) messages.push({ role: 'system', content: memCtx });

  // Compacted context
  if (sessionMessages.length > 0 && sessionMessages[0].role === 'system') {
    messages.push(sessionMessages[0]);
  }

  // Split screen context
  // (would be added if split screen is active)

  // User message
  messages.push({ role: 'user', content: filterResult.text });

  // Prompt trace
  if (config.promptTrace) {
    const trace = promptTrace.tracePrompt({
      userMessage: raw,
      memoryContext: memCtx.length > 50 ? memCtx : null,
      memoryFactCount: memory.stats().totalFacts,
      piiMasked: pii.hasPII(raw) ? `masked ${pii.getStats().masked} items` : null,
      piiCount: pii.getStats().masked,
    });
    const traceLines = promptTrace.renderHighlighted(trace);
    traceLines.forEach(l => print(l));
  }

  // Multi-model with fallback
  print(`  {gray-fg}→ ${route.provider} (${route.tier}){/}`);
  multiModel.askChain(messages, (reply, err, usedProvider) => {
    // Clean output
    const content = outputBox.getContent().split('\n')
      .filter(l => !l.match(/→ (openrouter|groq|openai|gemini|anthropic|mistral)/))
      .filter(l => !l.includes('searching web'))
      .join('\n');
    outputBox.setContent(content);

    if (reply) {
      reply.split('\n').forEach(l => print(`  ${l}`));
      print('');
      saveMsg(currentSessionId || newSession(), 'user', raw);
      saveMsg(currentSessionId, 'assistant', reply);
      memory.remember(raw.substring(0, 100), reply.substring(0, 200), { category: 'conversation', project: process.cwd() });
      updateStatusBar(usedProvider);
    } else {
      print(`  {#ef4444-fg}✗ ${err || 'no response'}{/}`);
      print('');
    }
    autoCompact();
  });
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
        '', `  {bold}{#818cf8-fg}pix{/} {gray-fg}v${VERSION}{/} {gray-fg}${BY}{/}`, '',
        `  {gray-fg}───────────────────────────────────────{/}`, '',
        `  {bold}chat{/}                  Interactive session`,
        `  {bold}ask{/}  <question>       Ask a question`,
        `  {bold}review{/} <file>         Review a file`,
        `  {bold}git{/}  <sub>            Git autopilot`,
        `  {bold}compact{/}              Manual compaction`,
        `  {bold}restore{/} <id>          Restore compaction`,
        `  {bold}compactions{/}           List compactions`,
        `  {bold}search{/} <query>        Search compactions`,
        `  {bold}models{/}               Provider & chain`,
        `  {bold}models{/} set <chain>    Set model chain`,
        `  {bold}models{/} moe on         MoE auto-routing`,
        `  {bold}save{/} <name> <code>   Save to PixSave`,
        `  {bold}load{/} <package>       Install from PixSave`,
        `  {bold}registry{/}             List packages`,
        `  {bold}creds{/} add <email> <pass>  Save credentials`,
        `  {bold}creds{/} list            List saved creds`,
        `  {bold}tools{/}                Available tools`,
        `  {bold}suggest{/} <problem>    Tool suggestions`,
        `  {bold}remember{/} <key> <val> Save to memory`,
        `  {bold}recall{/} <query>       Recall from memory`,
        `  {bold}memory{/}               Memory stats`,
        `  {bold}snapshot{/}             Pre-rewrite backup`,
        `  {bold}restore-snap{/} <id>    Restore snapshot`,
        `  {bold}snapshots{/}            List snapshots`,
        `  {bold}sandbox{/} <task>       Run in sandbox`,
        `  {bold}sandbox{/} list         List sandboxes`,
        `  {bold}plugins{/}              Plugin marketplace`,
        `  {bold}plugins{/} install <id> Install plugin`,
        `  {bold}collab{/} start         Start collaboration`,
        `  {bold}voice{/} on|off         Toggle voice`,
        `  {bold}prompt{/} on|off        Prompt transparency`,
        `  {bold}scan{/} <text>          Scan for PII`,
        `  {bold}filter{/}               Content filter info`,
        `  {bold}plugins{/}              Plugin marketplace`,
        `  {bold}sessions{/}            Session history`,
        `  {bold}cost{/}                Cost tracker`,
        `  {bold}config{/}              Configure`,
        `  {bold}status{/}              System info`,
        `  {bold}doctor{/}              Diagnostics`,
        `  {bold}init{/}                Initialize project`,
        `  {bold}version{/}             Version`,
        `  {bold}clear{/}               Clear screen`,
        `  {bold}exit{/}                Quit`, ''
      ]);
      break;

    case 'clear': outputBox.setContent(''); screen.render(); break;
    case 'version': print(`  pix v${VERSION} ${BY}`); break;

    case 'doctor':
      divider(); print('  {bold}diagnostics{/}'); divider();
      [
        ['node', process.version], ['pix home', fs.existsSync(PIX_HOME) ? '{#22c55e-fg}✓{/}' : '{#ef4444-fg}✗{/}'],
        ['config', fs.existsSync(CONFIG_FILE) ? '{#22c55e-fg}✓{/}' : '{#ef4444-fg}✗{/}'],
        ['api key', config.apiKey ? '***' + config.apiKey.slice(-4) : '{#eab308-fg}not set{/}'],
        ['platform', `${os.platform()} ${os.arch()}`],
        ['models', config.models?.length ? config.models.join(', ') : 'auto (MoE)'],
        ['auto-search', config.autoSearch ? '{#22c55e-fg}on{/}' : '{gray-fg}off{/}'],
        ['prompt-trace', config.promptTrace ? '{#22c55e-fg}on{/}' : '{gray-fg}off{/}'],
        ['content-filter', contentFilter.getProfile().level],
        ['pii-masking', '{#22c55e-fg}active{/}'],
        ['sandbox', `${sandbox.list().length} active`],
        ['memory', `${memory.stats().totalFacts} facts`],
        ['snapshots', `${snapshot.list().length} saved`],
      ].forEach(([k, v]) => print(`  {gray-fg}${k.padEnd(16)}{/} ${v}`));
      print('');
      break;

    case 'status':
      divider(); print('  {bold}pix{/} {gray-fg}v' + VERSION + '{/}'); divider();
      const total = os.totalmem(), free = os.freemem();
      const fmt = b => { const u = ['B','KB','MB','GB']; let i = 0; while (b >= 1024 && i < u.length-1) { b /= 1024; i++; } return b.toFixed(1)+u[i]; };
      let disk = '';
      try { const o = execSync('df -h /', { encoding: 'utf8' }); const p = o.split('\n')[1]?.split(/\s+/); if (p) disk = p[2]+'/'+p[3]; } catch (e) {}
      [
        ['provider', config.provider], ['api key', config.apiKey ? '***'+config.apiKey.slice(-4) : 'not set'],
        ['models', config.models?.length ? config.models.join(' → ') : 'auto (MoE)'],
        ['content-filter', contentFilter.getProfile().level], ['prompt-trace', config.promptTrace ? 'on' : 'off'],
        ['node', process.version], ['load', os.loadavg()[0].toFixed(2)],
        ['memory', fmt(total-free)+'/'+fmt(total)], disk ? ['disk', disk] : null,
        ['session msgs', `${sessionMessages.length}`], ['compactions', `${compaction.list().length}`],
        ['facts', `${memory.stats().totalFacts}`], ['snapshots', `${snapshot.list().length}`],
        ['sandbox agents', `${sandbox.list().length}`], ['plugins installed', `${plugins.listInstalled().length}`],
        ['pii masked', `${pii.getStats().masked}`],
      ].filter(Boolean).forEach(([k,v]) => print(`  {gray-fg}${k.padEnd(16)}{/} ${v}`));
      print('');
      break;

    case 'config':
      if (arg.startsWith('--set-key ')) { config.apiKey = arg.replace('--set-key ', ''); saveConfig(config); print('  {#22c55e-fg}✓{/} api key saved'); }
      else if (arg.startsWith('--set-provider ')) { config.provider = arg.replace('--set-provider ', ''); saveConfig(config); contentFilter.setModel(config.provider); print(`  {#22c55e-fg}✓{/} provider: ${config.provider}`); updateStatusBar(); }
      else if (arg === '--auto-search on') { config.autoSearch = true; saveConfig(config); print('  {#22c55e-fg}✓{/} auto-search on'); }
      else if (arg === '--auto-search off') { config.autoSearch = false; saveConfig(config); print('  {#22c55e-fg}✓{/} auto-search off'); }
      else if (arg === '--prompt-trace on') { config.promptTrace = true; saveConfig(config); print('  {#22c55e-fg}✓{/} prompt transparency on'); }
      else if (arg === '--prompt-trace off') { config.promptTrace = false; saveConfig(config); print('  {#22c55e-fg}✓{/} prompt transparency off'); }
      else if (arg === '--uncensored on') { config.uncensored = true; contentFilter.setUncensored(true); saveConfig(config); print('  {#22c55e-fg}✓{/} uncensored mode on'); }
      else if (arg === '--uncensored off') { config.uncensored = false; contentFilter.setUncensored(false); saveConfig(config); print('  {#22c55e-fg}✓{/} uncensored mode off'); }
      else if (arg.startsWith('--compact-threshold ')) { config.autoCompactThreshold = parseInt(arg.split(' ')[1]) || 50; saveConfig(config); print(`  {#22c55e-fg}✓{/} auto-compact every ${config.autoCompactThreshold} msgs`); }
      else {
        divider(); print('  {bold}config{/}'); divider();
        print(`  {gray-fg}provider${'{/}'}         ${config.provider}`);
        print(`  {gray-fg}api key${'{/}'}          ${config.apiKey ? '***'+config.apiKey.slice(-4) : '{#eab308-fg}not set{/}'}`);
        print(`  {gray-fg}models${'{/}'}           ${config.models?.length ? config.models.join(' → ') : 'auto (MoE)'}`);
        print(`  {gray-fg}auto-search${'{/}'}      ${config.autoSearch ? 'on' : 'off'}`);
        print(`  {gray-fg}prompt-trace${'{/}'}     ${config.promptTrace ? 'on' : 'off'}`);
        print(`  {gray-fg}uncensored${'{/}'}       ${config.uncensored ? 'on' : 'off'}`);
        print(`  {gray-fg}compact-threshold${'{/}'} ${config.autoCompactThreshold || 50} msgs`);
        print(`  {gray-fg}content-filter${'{/}'}   ${contentFilter.getProfile().level}`);
        print('');
        print('  {gray-fg}pix config --set-key <key>{/}');
        print('  {gray-fg}pix config --set-provider <provider>{/}');
        print('  {gray-fg}pix config --auto-search on|off{/}');
        print('  {gray-fg}pix config --prompt-trace on|off{/}');
        print('  {gray-fg}pix config --uncensored on|off{/}');
        print('  {gray-fg}pix config --compact-threshold <n>{/}');
      }
      print('');
      break;

    case 'models':
      if (arg.startsWith('set ')) { const chain = arg.replace('set ', '').split(/[,\s]+/).filter(Boolean); config.models = chain; saveConfig(config); print(`  {#22c55e-fg}✓{/} chain: ${chain.join(' → ')}`); }
      else if (arg === 'moe on') { config.models = []; config.fallbackChain = []; saveConfig(config); print('  {#22c55e-fg}✓{/} MoE auto-routing enabled'); }
      else {
        divider(); print('  {bold}models{/}'); divider();
        const chain = multiModel.getChain('');
        print(`  {gray-fg}active chain${'{/}'}    ${chain.join(' → ')}`);
        print(`  {gray-fg}mode${'{/}'}            ${config.models?.length ? 'explicit' : 'MoE auto'}`);
        print('');
        multiModel.listProviders().forEach(p => print(`    ${p.hasKey ? '{#22c55e-fg}●{/}' : '{gray-fg}○{/}'} ${p.name.padEnd(12)} ${p.model}`));
        print('');
        print('  {gray-fg}pix models set groq,openai,anthropic{/}');
        print('  {gray-fg}pix models moe on{/}');
      }
      print('');
      break;

    case 'compact':
      if (!currentSessionId) { print('  {gray-fg}no active session{/}'); break; }
      print(`  {#eab308-fg}● compacting ${sessionMessages.length} messages...{/}`);
      const cr = compaction.compact(currentSessionId, sessionMessages, { cwd: process.cwd(), gitBranch: git('git branch --show-current'), ...contextTrack });
      print(`  {#22c55e-fg}✓{/} id: ${cr.id} · ${cr.original} → ${cr.compressed} bytes (${cr.ratio}%)`);
      print('');
      break;

    case 'restore':
      if (!arg) { print('  {gray-fg}pix restore <id>{/}'); break; }
      const rd = compaction.restore(arg);
      if (!rd) { print(`  {#ef4444-fg}✗ compaction ${arg} not found{/}`); break; }
      divider(); print(`  {bold}restored: ${rd.id}{/} {gray-fg}${rd.messageCount} messages · ${rd.timestamp}{/}`); divider();
      rd.messages.slice(-10).forEach(m => {
        const role = m.role === 'user' ? '{#22c55e-fg}❯{/}' : '{#818cf8-fg}pix{/}';
        m.content.split('\n').forEach(l => print(`  ${role} ${l}`));
      });
      print('');
      break;

    case 'compactions': {
      const list = compaction.list();
      divider(); print(`  {bold}compactions${'{/}'} ${gray-fg}(${list.length}){/}`); divider();
      list.forEach(s => print(`  {gray-fg}${s.id}{/}  ${s.messageCount} msgs  ${s.compressed} bytes  ${s.ratio}% ratio`));
      if (list.length === 0) print('  {gray-fg}none yet{/}');
      print('');
      break;
    }

    case 'search':
      if (!arg) { print('  {gray-fg}pix search <query>{/}'); break; }
      const results = compaction.search(arg);
      divider(); print(`  {bold}search: "${arg}"${'{/}'} ${gray-fg}(${results.length} results){/}`); divider();
      results.slice(0, 10).forEach(r => print(`  {gray-fg}${r.sessionId}{/}  ${r.type || r.role}  ${r.content?.substring(0, 80)}`));
      if (results.length === 0) print('  {gray-fg}no matches{/}');
      print('');
      break;

    case 'review':
      if (!arg) { print('  {gray-fg}pix review <file>{/}'); break; }
      const fp = path.resolve(arg);
      if (!fs.existsSync(fp)) { print(`  {#ef4444-fg}✗ ${arg} not found{/}`); break; }
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
      const sc = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
      divider(); print(`  {bold}${path.basename(fp)}{/} {gray-fg}${lines.length} lines · score {/}{#${sc}-fg}${score}/100{/}`); divider();
      if (issues.length === 0) { print('  {#22c55e-fg}✓ no issues{/}'); }
      else { issues.forEach(i => {
        const sev = i.s === 'e' ? '{#ef4444-fg}error{/}' : i.s === 'w' ? '{#eab308-fg}warn{/}' : '{#60a5fa-fg}info{/}';
        print(`  {gray-fg}L${i.l}{/}  ${sev}  ${i.m}`);
      }); }
      print('');
      break;

    case 'git': {
      const sub = arg || 'status';
      if (sub === 'status' || sub === '') {
        const branch = git('git branch --show-current');
        const changes = git('git status --porcelain').split('\n').filter(Boolean);
        const recent = git('git log --oneline -5').split('\n');
        divider(); print('  {bold}git{/}'); divider();
        print(`  {gray-fg}branch${'{/}'}  ${branch || '{#ef4444-fg}none{/}'}`);
        print(`  {gray-fg}changes${'{/}'} ${changes.length} files`);
        if (changes.length > 0) { print(''); changes.slice(0,5).forEach(f => print(`    {#22d3ee-fg}·{/} ${f}`)); }
        print(''); print('  {gray-fg}recent:{/}');
        recent.forEach(c => print(`    ${c}`));
      } else if (sub.startsWith('commit ')) {
        const msg = sub.replace('commit ', '');
        const r = gitAuto.commit(msg);
        print(r.ok ? `  {#22c55e-fg}✓{/} committed: ${msg}` : `  {#ef4444-fg}✗ ${r.error}{/}`);
      } else if (sub === 'auto-commit') {
        const r = gitAuto.autoCommit();
        print(r.ok ? `  {#22c55e-fg}✓{/} ${r.message} (${r.hash})` : `  {#ef4444-fg}✗ ${r.error}{/}`);
      } else if (sub === 'pr') {
        const r = gitAuto.autoPR();
        print(r.ok ? `  {#22c55e-fg}✓{/} PR: ${r.url}` : `  {#ef4444-fg}✗ ${r.error}{/}`);
      } else if (sub === 'rebase') {
        const r = gitAuto.smartRebase();
        print(r.ok ? `  {#22c55e-fg}✓{/} ${r.message}` : `  {#ef4444-fg}✗ ${r.error}{/}`);
      } else if (sub === 'diff') {
        const diff = git('git diff --stat');
        print(`\n  ${diff || '{gray-fg}no changes{/}'}\n`);
      } else if (sub.startsWith('log')) {
        const n = sub.replace('log', '').trim() || '10';
        print('');
        git(`git log --oneline -${n}`).split('\n').forEach(l => print(`  ${l}`));
      }
      print('');
      break;
    }

    case 'save':
      if (!arg) { print('  {gray-fg}pix save <name> <code>{/}'); break; }
      const saveParts = arg.split(/\s+/);
      const saveName = saveParts[0];
      const saveCode = saveParts.slice(1).join(' ');
      const sr = pixsave.saveSnippet(saveName, saveCode);
      print(sr.ok ? `  {#22c55e-fg}✓{/} saved: ${sr.name} v${sr.version}` : `  {#ef4444-fg}✗ ${sr.error}{/}`);
      print('');
      break;

    case 'load':
      if (!arg) { print('  {gray-fg}pix load <package>{/}'); break; }
      const lr = pixsave.install(arg, process.cwd());
      print(lr.ok ? `  {#22c55e-fg}✓{/} installed: ${lr.name} v${lr.version} (${lr.files} files)` : `  {#ef4444-fg}✗ ${lr.error}{/}`);
      print('');
      break;

    case 'registry': {
      const list = pixsave.list();
      divider(); print(`  {bold}registry${'{/}'} ${gray-fg}(${list.length}){/}`); divider();
      list.forEach(p => print(`  {gray-fg}${p.name.padEnd(20)}{/} ${p.description.substring(0, 40)}  ⭐${p.stars}  ↓${p.downloads}`));
      if (list.length === 0) print('  {gray-fg}empty{/}');
      print('');
      break;
    }

    case 'creds':
      if (arg.startsWith('add ')) {
        const credParts = arg.replace('add ', '').split(/\s+/);
        const [email, pass, ...domainParts] = credParts;
        const domain = domainParts.join(' ') || 'github.com';
        const cr = vault.add(domain, email, pass);
        print(cr.ok ? `  {#22c55e-fg}✓{/} credentials saved for ${domain}` : `  {#ef4444-fg}✗ ${cr.reason}{/}`);
      } else {
        const list = vault.list();
        divider(); print('  {bold}credentials{/}'); divider();
        list.forEach(c => print(`  {gray-fg}${c.domain}{/}  ${c.email}  ${c.added?.split('T')[0] || ''}`));
        if (list.length === 0) print('  {gray-fg}none saved{/}');
      }
      print('');
      break;

    case 'tools': {
      const list = tools.available();
      divider(); print('  {bold}tools{/}'); divider();
      list.forEach(t => print(`    ${t.installed ? '{#22c55e-fg}●{/}' : '{gray-fg}○{/}'} ${t.name.padEnd(12)} ${t.type}`));
      print('');
      break;
    }

    case 'suggest':
      if (!arg) { print('  {gray-fg}pix suggest <problem>{/}'); break; }
      const suggestions = tools.suggest(arg);
      divider(); print(`  {bold}suggestions for: ${arg}{/}`); divider();
      if (suggestions.cli.length > 0) { print('  {gray-fg}CLI tools:{/}'); suggestions.cli.forEach(t => print(`    ${t.installed ? '{#22c55e-fg}●{/}' : '{gray-fg}○{/}'} ${t.name} — ${t.type}`)); }
      if (suggestions.web.length > 0) { print('  {gray-fg}Web apps:{/}'); suggestions.web.forEach(a => print(`    ${a.safe ? '{#22c55e-fg}●{/}' : '{gray-fg}○{/}'} ${a.name} — ${a.domain}`)); }
      print('');
      break;

    case 'remember':
      if (!arg) { print('  {gray-fg}pix remember <key> <value>{/}'); break; }
      const remParts = arg.split(/\s+/);
      const remKey = remParts[0];
      const remVal = remParts.slice(1).join(' ');
      memory.remember(remKey, remVal, { project: process.cwd() });
      print(`  {#22c55e-fg}✓{/} remembered: ${remKey}`);
      print('');
      break;

    case 'recall':
      if (!arg) { print('  {gray-fg}pix recall <query>{/}'); break; }
      const recalled = memory.recall(arg);
      divider(); print(`  {bold}recall: "${arg}"${'{/}'} ${gray-fg}(${recalled.length}){/}`); divider();
      recalled.forEach(r => print(`  {gray-fg}[${r.category}]{/} ${r.key}: ${r.value.substring(0, 80)}`));
      if (recalled.length === 0) print('  {gray-fg}nothing found{/}');
      print('');
      break;

    case 'memory': {
      const ms = memory.stats();
      divider(); print('  {bold}memory{/}'); divider();
      print(`  {gray-fg}total facts${'{/}'}     ${ms.totalFacts}`);
      print(`  {gray-fg}conversations${'{/}'}   ${ms.totalConversations}`);
      print(`  {gray-fg}patterns${'{/}'}        ${ms.totalPatterns}`);
      print(`  {gray-fg}errors fixed${'{/}'}    ${ms.totalErrors}`);
      print(`  {gray-fg}user prefs${'{/}'}      ${ms.userPrefs}`);
      print(`  {gray-fg}projects${'{/}'}        ${ms.projects}`);
      print('');
      break;
    }

    case 'snapshot':
      print('  {#eab308-fg}● taking snapshot...{/}');
      const snap = snapshot.snapshotPix('manual');
      print(`  {#22c55e-fg}✓{/} snapshot: ${snap.id} · ${snap.files} files · ${snap.size} bytes`);
      print('');
      break;

    case 'restore-snap':
      if (!arg) { print('  {gray-fg}pix restore-snap <id>{/}'); break; }
      const rs = snapshot.restore(arg);
      print(rs.ok ? `  {#22c55e-fg}✓{/} restored ${rs.restored} files` : `  {#ef4444-fg}✗ ${rs.error}{/}`);
      print('');
      break;

    case 'snapshots': {
      const list = snapshot.list();
      divider(); print(`  {bold}snapshots${'{/}'} ${gray-fg}(${list.length}){/}`); divider();
      list.forEach(s => print(`  {gray-fg}${s.id}{/}  ${s.label}  ${s.files.length} files  ${s.totalSize} bytes  ${s.timestamp?.split('T')[0] || ''}`));
      if (list.length === 0) print('  {gray-fg}none yet{/}');
      print('');
      break;
    }

    case 'sandbox':
      if (arg === 'list') {
        const list = sandbox.list();
        divider(); print(`  {bold}sandboxes${'{/}'} ${gray-fg}(${list.length}){/}`); divider();
        list.forEach(a => print(`  {gray-fg}${a.id}{/}  ${a.status}  ${a.mutations} mutations  ${a.errors} errors`));
        if (list.length === 0) print('  {gray-fg}none active{/}');
      } else if (arg) {
        print(`  {#eab308-fg}● running in sandbox...{/}`);
        const result = sandbox.quickTest(arg);
        const content = outputBox.getContent().split('\n').filter(l => !l.includes('running in sandbox')).join('\n');
        outputBox.setContent(content);
        print(`  ${result.safe ? '{#22c55e-fg}✓ safe{/}' : '{#ef4444-fg}⚠ had errors{/}'}`);
        print(`  {gray-fg}${result.summary}{/}`);
        if (result.mutations.length > 0) { print('  {gray-fg}mutations:{/}'); result.mutations.slice(0,5).forEach(m => print(`    ${m.type}: ${m.cmd || m.file || ''}`)); }
      } else {
        print('  {gray-fg}pix sandbox <task> | pix sandbox list{/}');
      }
      print('');
      break;

    case 'plugins': {
      const sub = arg || 'list';
      if (sub.startsWith('install ')) {
        const pluginId = sub.replace('install ', '');
        const r = plugins.install(pluginId);
        print(r.ok ? `  {#22c55e-fg}✓{/} installed: ${r.name}` : `  {#ef4444-fg}✗ ${r.error}{/}`);
      } else if (sub.startsWith('uninstall ')) {
        plugins.uninstall(sub.replace('uninstall ', ''));
        print(`  {#22c55e-fg}✓{/} uninstalled`);
      } else {
        const list = plugins.list();
        divider(); print('  {bold}plugins{/}'); divider();
        const cats = {};
        list.forEach(p => { if (!cats[p.category]) cats[p.category] = []; cats[p.category].push(p); });
        Object.entries(cats).forEach(([cat, items]) => {
          print(`  {gray-fg}${cat}{/}`);
          items.forEach(p => print(`    ${p.installed ? (p.enabled ? '{#22c55e-fg}●{/}' : '{#eab308-fg}●{/}') : '{gray-fg}○{/}'} ${p.name.padEnd(20)} ${p.description.substring(0, 35)}`));
          print('');
        });
      }
      print('');
      break;
    }

    case 'collab':
      if (arg === 'start') {
        collab.start();
        print(`  {#22c55e-fg}✓{/} collaboration server started on port ${collab.port}`);
      } else if (arg.startsWith('create ')) {
        collab.createSession(arg.replace('create ', ''), 'pix-user').then(r => {
          print(`  {#22c55e-fg}✓{/} session: ${r.id}`);
          print(`  {gray-fg}share link: ${r.shareLink}{/}`);
          print('');
          screen.render();
        });
      } else {
        print('  {gray-fg}pix collab start | pix collab create <name>{/}');
      }
      print('');
      break;

    case 'voice':
      if (arg === 'on') { voice.enabled = true; print('  {#22c55e-fg}✓{/} voice on'); }
      else if (arg === 'off') { voice.enabled = false; print('  {#22c55e-fg}✓{/} voice off'); }
      else { voice.toggle(); print(`  {#22c55e-fg}✓{/} voice ${voice.enabled ? 'on' : 'off'}`); }
      print('');
      break;

    case 'prompt':
      if (arg === 'on') { config.promptTrace = true; saveConfig(config); print('  {#22c55e-fg}✓{/} prompt transparency on'); }
      else if (arg === 'off') { config.promptTrace = false; saveConfig(config); print('  {#22c55e-fg}✓{/} prompt transparency off'); }
      else { config.promptTrace = !config.promptTrace; saveConfig(config); print(`  {#22c55e-fg}✓{/} prompt transparency ${config.promptTrace ? 'on' : 'off'}`); }
      print('');
      break;

    case 'scan':
      if (!arg) { print('  {gray-fg}pix scan <text>{/}'); break; }
      const findings = pii.scan(arg);
      divider(); print(`  {bold}PII scan${'{/}'} ${gray-fg}(${findings.length} findings){/}`); divider();
      findings.forEach(f => print(`  {gray-fg}${f.type.padEnd(12)}{/} ${f.value}`));
      if (findings.length === 0) print('  {#22c55e-fg}✓ no PII detected{/}');
      print('');
      break;

    case 'filter': {
      const prof = contentFilter.getProfile();
      divider(); print('  {bold}content filter{/}'); divider();
      print(`  {gray-fg}model${'{/}'}      ${prof.name}`);
      print(`  {gray-fg}level${'{/}'}      ${prof.level}`);
      print(`  {gray-fg}note${'{/}'}       ${prof.note}`);
      print('');
      print('  {gray-fg}pix config --uncensored on|off{/}');
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
      divider(); print(`  {bold}sessions${'{/}'} ${gray-fg}(${list.length}){/}`); divider();
      list.forEach(s => print(`  {gray-fg}${s.id}{/}  ${s.cwd || '-'}  ${s.messages?.length || 0} msgs`));
      print('');
      break;
    }

    case 'cost': {
      let costs = { sessions: [], total: 0 };
      try { costs = JSON.parse(fs.readFileSync(path.join(PIX_HOME, 'costs.json'), 'utf8')); } catch (e) {}
      const today = new Date().toISOString().split('T')[0];
      const todayCosts = costs.sessions.filter(s => s.time?.startsWith(today));
      const todayTotal = todayCosts.reduce((s, x) => s + (x.cost || 0), 0);
      divider(); print('  {bold}cost{/}'); divider();
      print(`  {gray-fg}total${'{/}'}  $${(costs.total||0).toFixed(4)}`);
      print(`  {gray-fg}today${'{/}'}  $${todayTotal.toFixed(4)}`);
      print(`  {gray-fg}calls${'{/}'}  ${costs.sessions.length}`);
      print('');
      break;
    }

    case 'init': {
      const dir = path.join(process.cwd(), '.pix');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({ project: path.basename(process.cwd()), created: new Date().toISOString(), version: VERSION }, null, 2));
      print(`  {#22c55e-fg}✓{/} initialized in ${process.cwd()}`);
      print('');
      break;
    }

    case 'exit': case 'quit': process.exit(0);

    default:
      if (!cmd) break;
      const sessionId = currentSessionId || newSession();

      // Auto web search if needed
      if (autoSearch.needsSearch(raw)) {
        print(`  {#22d3ee-fg}⟳ searching web...{/}`);
        autoSearch.search(raw, (searchData) => {
          const content = outputBox.getContent().split('\n').filter(l => !l.includes('searching web')).join('\n');
          outputBox.setContent(content);
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
// INPUT
// ══════════════════════════════════════════════

input.on('submit', (val) => {
  const text = val.trim();
  if (!text) return;
  history.push(text);
  historyIdx = history.length;
  print(`  {#22c55e-fg}❯{/} ${text}`);
  input.clearValue();
  handleCommand(text);
});

input.key(['up'], () => { if (historyIdx > 0) { historyIdx--; input.setValue(history[historyIdx]); } });
input.key(['down'], () => { if (historyIdx < history.length - 1) { historyIdx++; input.setValue(history[historyIdx]); } else { historyIdx = history.length; input.clearValue(); } });

screen.key(['C-c', 'q'], () => process.exit(0));
screen.key(['C-l'], () => { outputBox.setContent(''); screen.render(); });
screen.key(['tab'], () => { input.focus(); screen.render(); });

// ══════════════════════════════════════════════
// WELCOME
// ══════════════════════════════════════════════

printLines([
  '',
  `  {bold}{#818cf8-fg}pix{/} {gray-fg}v${VERSION}{/}`,
  `  {gray-fg}${BY}{/}`,
  '',
  `  {gray-fg}19 modules · MoE routing · PII masking · sandbox · split screen{/}`,
  `  {gray-fg}try: {/}{bold}help{/}{gray-fg}, {/}{bold}status{/}{gray-fg}, {/}{bold}models{/}{gray-fg}, {/}{bold}review <file>{/}`,
  ''
]);

input.focus();
screen.render();
