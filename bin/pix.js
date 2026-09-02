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
function git(cmd) { try { return execSync(cmd, { encoding: 'utf8', cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] }).trim(); } catch (e) { return ''; } }

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

  console.log(T.clear);
  console.log('');
  console.log(`  ${T.bold}${T.magenta} pix ${T.reset}${T.gray}v${VERSION}${T.reset}`);
  console.log(`  ${T.gray}${BY}${T.reset}`);
  console.log('');

  if (!config.apiKey) {
    console.log(`  ${T.bold}${T.yellow} set your api key to start:${T.reset}`);
    console.log(`  ${T.gray}pix key <your-openrouter-api-key>${T.reset}`);
    console.log('');
    console.log(`  ${T.gray}get one free at openrouter.ai/keys${T.reset}`);
  } else {
    console.log(`  ${T.gray}project${T.reset}  ${dir}`);
    if (branch) console.log(`  ${T.gray}branch${T.reset}  ${branch}`);
    console.log('');
    console.log(`  ${T.gray}just type and ask anything${T.reset}`);
  }
  console.log('');
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
  if (!config.apiKey) { print(`${T.red}No API key. Run: pix key <your-key>${T.reset}`); cb(); return; }

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
    case 'key':
      if (!arg) { print(`${T.red}usage: pix key <your-api-key>${T.reset}`); break; }
      config.apiKey = arg;
      saveConfig(config);
      print(`${T.green}✓${T.reset} api key saved`);
      print(`${T.gray}now just type and ask anything${T.reset}`);
      print('');
      break;

    case 'help':
      printLines([
        '',
        `  ${T.bold}${T.magenta}pix${T.reset} ${T.gray}v${VERSION}${T.reset}`,
        '',
        `  ${T.bold}key${T.reset}  <api-key>    set your openrouter api key`,
        `  ${T.bold}help${T.reset}              show this`,
        `  ${T.bold}status${T.reset}            system info`,
        `  ${T.bold}clear${T.reset}            clear screen`,
        `  ${T.bold}exit${T.reset}             quit`,
        '',
        `  ${T.gray}that's it. just type to chat.${T.reset}`,
        ''
      ]);
      break;

    case 'clear': console.log(T.clear); break;
    case 'exit': case 'quit': process.exit(0);

    case 'status':
      divider(); print(`${T.bold}pix${T.reset} ${T.gray}v${VERSION}${T.reset}`); divider();
      [
        ['api key', config.apiKey ? '***'+config.apiKey.slice(-4) : `${T.yellow}not set${T.reset}`],
        ['provider', config.provider],
        ['model', config.models?.length ? config.models.join(' → ') : 'auto (MoE)'],
        ['node', process.version],
        ['platform', `${os.platform()} ${os.arch()}`],
        ['session msgs', `${sessionMessages.length}`],
        ['memory', `${memory.stats().totalFacts} facts`],
      ].forEach(([k,v]) => print(`  ${T.gray}${k.padEnd(14)}${T.reset} ${v}`));
      print('');
      break;

    default:
      if (!config.apiKey) { print(`${T.red}Set your API key first: pix key <your-key>${T.reset}\n`); break; }
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
