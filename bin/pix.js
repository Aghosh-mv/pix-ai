#!/usr/bin/env node
const blessed = require('blessed');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const VERSION = '2.3.0';
const BY = 'by Aghosh-mv · justcode';
const PIX_HOME = path.join(os.homedir(), '.pix');
const CONFIG_FILE = path.join(PIX_HOME, 'config.json');
const SESSIONS_DIR = path.join(PIX_HOME, 'sessions');

function ensureDirs() { [PIX_HOME, SESSIONS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }); }
function loadConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) { return { apiKey: '', provider: 'openrouter' }; } }
function saveConfig(c) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2)); }
function git(cmd) { try { return execSync(cmd, { encoding: 'utf8', cwd: process.cwd() }).trim(); } catch (e) { return ''; } }

ensureDirs();
const config = loadConfig();

// ── Screen ──
const screen = blessed.screen({ smartCSR: true, title: 'pix', dockBorders: true, fullUnicode: true });

// ── Status Bar (bottom) ──
const statusBar = blessed.box({
  parent: screen, bottom: 0, left: 0, right: 0, height: 1,
  tags: true, style: { fg: '#18181b', bg: '#a1a1aa' },
  content: ` {bold}pix{/bold} {gray-fg}v${VERSION}{/gray-fg} │ {white-fg}${config.provider}{/white-fg} │ ${git('git branch --show-current') || 'detached'} │ ${path.basename(process.cwd())} `
});

// ── Output Area ──
const outputBox = blessed.box({
  parent: screen, top: 0, left: 0, right: 0, bottom: 2,
  tags: true, scrollable: true, alwaysScroll: true,
  scrollbar: { style: { bg: '#3f3f46' } },
  style: { fg: '#d4d4d8', bg: '#09090b' },
  padding: { left: 1, right: 1 }
});

// ── Input Box ──
const inputBox = blessed.box({
  parent: screen, bottom: 1, left: 0, right: 0, height: 3,
  tags: true, style: { fg: '#d4d4d8', bg: '#18181b', border: { fg: '#27272a' } },
  border: { type: 'line' }, padding: { left: 1 }
});

const inputLine = blessed.text({
  parent: inputBox, left: 0, top: 0, width: '100%', height: 1,
  tags: true, content: '{#22c55e-fg}{bold}❯{/bold}{/bold}{/} '
});

const input = blessed.textarea({
  parent: inputBox, left: 3, top: 0, right: 0, height: 1,
  inputOnFocus: true, style: { fg: '#fafafa', bg: '#18181b', focus: { bg: '#18181b' } },
  keys: true, vi: true
});

// ── History ──
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

// ── Session ──
function newSession() {
  const id = crypto.randomBytes(4).toString('hex');
  const s = { id, cwd: process.cwd(), created: new Date().toISOString(), messages: [] };
  fs.writeFileSync(path.join(SESSIONS_DIR, `${id}.json`), JSON.stringify(s));
  return id;
}

function saveMsg(sessionId, role, content) {
  const f = path.join(SESSIONS_DIR, `${sessionId}.json`);
  try {
    const s = JSON.parse(fs.readFileSync(f, 'utf8'));
    s.messages.push({ role, content, t: Date.now() });
    fs.writeFileSync(f, JSON.stringify(s));
  } catch (e) {}
}

// ── AI Request ──
function askAI(messages, cb) {
  if (!config.apiKey) { cb('{red-fg}No API key. Run: pix config --set-key <key>{/}'); return; }

  const models = { openrouter: 'gpt-4o-mini', groq: 'llama3-8b-8192', openai: 'gpt-4o-mini', gemini: 'gemini-2.0-flash' };
  const hosts = { openrouter: 'openrouter.ai', groq: 'api.groq.com', openai: 'api.openai.com', gemini: 'generativelanguage.googleapis.com' };
  const paths = { openrouter: '/api/v1/chat/completions', groq: '/v1/chat/completions', openai: '/v1/chat/completions', gemini: '/v1beta/models/gemini-2.0-flash:generateContent' };

  const provider = config.provider;
  const host = hosts[provider] || 'openrouter.ai';
  const reqPath = paths[provider] || '/api/v1/chat/completions';

  let postData;
  if (provider === 'gemini') {
    const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    postData = JSON.stringify({ contents, generationConfig: { maxOutputTokens: 2048 } });
  } else {
    postData = JSON.stringify({ model: models[provider] || 'gpt-4o-mini', messages, max_tokens: 2048 });
  }

  const req = https.request({
    hostname: host, port: 443, path: reqPath, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), 'Authorization': `Bearer ${config.apiKey}` }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        let reply;
        if (provider === 'gemini') { reply = json.candidates?.[0]?.content?.parts?.[0]?.text; }
        else { reply = json.choices?.[0]?.message?.content || json.error?.message; }
        cb(reply || 'no response');
      } catch (e) { cb('parse error'); }
    });
  });
  req.on('error', () => cb('{red-fg}connection failed{/}'));
  req.write(postData);
  req.end();
}

// ── Commands ──
function handleCommand(raw) {
  const parts = raw.trim().split(/\s+/);
  const cmd = parts[0];
  const arg = parts.slice(1).join(' ');

  switch (cmd) {
    case 'help':
      printLines([
        '',
        `  {bold}{#818cf8-fg}pix{/} {gray-fg}v${VERSION}{/} {gray-fg}${BY}{/}`,
        '',
        `  {gray-fg}─────────────────────────────────{/}`,
        '',
        `  {bold}chat{/}              Start interactive session`,
        `  {bold}ask{/}  <question>   Ask a question`,
        `  {bold}review{/} <file>     Review a file`,
        `  {bold}git{/}  <sub>        Git status / commit / diff`,
        `  {bold}plugins{/}           List plugins`,
        `  {bold}sessions{/}          Session history`,
        `  {bold}cost{/}              Cost tracker`,
        `  {bold}config{/}            Configure provider / key`,
        `  {bold}status{/}            System info`,
        `  {bold}doctor{/}            Diagnostics`,
        `  {bold}init{/}              Initialize project`,
        `  {bold}version{/}           Version`,
        `  {bold}clear{/}             Clear screen`,
        `  {bold}exit{/}              Quit`,
        ''
      ]);
      break;

    case 'clear':
      outputBox.setContent('');
      screen.render();
      break;

    case 'version':
      print(`  pix v${VERSION} ${BY}`);
      break;

    case 'doctor':
      divider();
      print('  {bold}diagnostics{/}');
      divider();
      const checks = [
        [`node`, process.version],
        [`pix home`, fs.existsSync(PIX_HOME) ? '{#22c55e-fg}✓{/}' : '{#ef4444-fg}✗{/}'],
        [`config`, fs.existsSync(CONFIG_FILE) ? '{#22c55e-fg}✓{/}' : '{#ef4444-fg}✗{/}'],
        [`api key`, config.apiKey ? '***' + config.apiKey.slice(-4) : '{#eab308-fg}not set{/}'],
        [`platform`, `${os.platform()} ${os.arch()}`],
        [`cpus`, `${os.cpus().length}`],
      ];
      checks.forEach(([k, v]) => print(`  {gray-fg}${k.padEnd(12)}{/} ${v}`));
      print('');
      break;

    case 'status':
      divider();
      print('  {bold}pix{/} {gray-fg}v' + VERSION + '{/}');
      divider();
      const total = os.totalmem(), free = os.freemem();
      const fmt = b => { const u = ['B','KB','MB','GB']; let i = 0; while (b >= 1024 && i < u.length-1) { b /= 1024; i++; } return b.toFixed(1)+u[i]; };
      let disk = '';
      try { const o = execSync('df -h /', { encoding: 'utf8' }); const p = o.split('\n')[1]?.split(/\s+/); if (p) disk = p[2]+'/'+p[3]; } catch (e) {}
      const info = [
        ['provider', config.provider],
        ['api key', config.apiKey ? '***'+config.apiKey.slice(-4) : 'not set'],
        ['node', process.version],
        ['load', os.loadavg()[0].toFixed(2)],
        ['memory', fmt(total-free)+'/'+fmt(total)],
      ];
      if (disk) info.push(['disk', disk]);
      info.forEach(([k,v]) => print(`  {gray-fg}${k.padEnd(12)}{/} ${v}`));
      print('');
      break;

    case 'config':
      if (arg.startsWith('--set-key ')) {
        config.apiKey = arg.replace('--set-key ', '');
        saveConfig(config);
        print('  {#22c55e-fg}✓{/} api key saved');
      } else if (arg.startsWith('--set-provider ')) {
        config.provider = arg.replace('--set-provider ', '');
        saveConfig(config);
        print(`  {#22c55e-fg}✓{/} provider: ${config.provider}`);
        statusBar.setContent(` {bold}pix{/bold} {gray-fg}v${VERSION}{/gray-fg} │ {white-fg}${config.provider}{/white-fg} │ ${git('git branch --show-current') || 'detached'} │ ${path.basename(process.cwd())} `);
      } else {
        divider();
        print('  {bold}config{/}');
        divider();
        print(`  {gray-fg}provider${'{/}'}  ${config.provider}`);
        print(`  {gray-fg}api key${'{/}'}   ${config.apiKey ? '***'+config.apiKey.slice(-4) : '{#eab308-fg}not set{/}'}`);
        print('');
        print('  {gray-fg}pix config --set-key <key>{/}');
        print('  {gray-fg}pix config --set-provider <provider>{/}');
      }
      print('');
      break;

    case 'review':
      if (!arg) { print('  {gray-fg}pix review <file>{/}'); break; }
      const fp = path.resolve(arg);
      if (!fs.existsSync(fp)) { print(`  {#ef4444-fg}✗${'{/}'} ${arg} not found`); break; }
      const content = fs.readFileSync(fp, 'utf8');
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
      const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
      divider();
      print(`  {bold}${path.basename(fp)}{/} {gray-fg}${lines.length} lines · score {/}{#${scoreColor}-fg}${score}/100{/}`);
      divider();
      if (issues.length === 0) {
        print('  {#22c55e-fg}✓ no issues{/}');
      } else {
        issues.forEach(i => {
          const sev = i.s === 'e' ? '{#ef4444-fg}error{/}' : i.s === 'w' ? '{#eab308-fg}warn{/}' : '{#60a5fa-fg}info{/}';
          print(`  {gray-fg}L${i.l}{/}  ${sev}  ${i.m}`);
        });
      }
      print('');
      break;

    case 'git': {
      const sub = arg || 'status';
      if (sub === 'status' || sub === '') {
        const branch = git('git branch --show-current');
        const changes = git('git status --porcelain').split('\n').filter(Boolean);
        const recent = git('git log --oneline -5').split('\n');
        divider();
        print('  {bold}git{/}');
        divider();
        print(`  {gray-fg}branch${'{/}'}  ${branch || '{#ef4444-fg}none{/}'}`);
        print(`  {gray-fg}changes${'{/}'} ${changes.length} files`);
        if (changes.length > 0) { print(''); changes.slice(0,5).forEach(f => print(`    {#22d3ee-fg}·{/} ${f}`)); }
        print('');
        print('  {gray-fg}recent:{/}');
        recent.forEach(c => print(`    ${c}`));
      } else if (sub.startsWith('commit ')) {
        const msg = sub.replace('commit ', '');
        git('git add -A');
        const r = git(`git commit -m "${msg}"`);
        print(r.includes('nothing to commit') ? '  {gray-fg}nothing to commit{/}' : `  {#22c55e-fg}✓{/} committed: ${msg}`);
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

    case 'plugins': {
      const all = [
        { id: 'git-auto', name: 'Git Auto', cat: 'workflow' },
        { id: 'code-review', name: 'Code Review', cat: 'quality' },
        { id: 'test-gen', name: 'Test Gen', cat: 'quality' },
        { id: 'dep-audit', name: 'Dep Audit', cat: 'security' },
        { id: 'docker-gen', name: 'Docker Gen', cat: 'devops' },
        { id: 'ci-gen', name: 'CI/CD Gen', cat: 'devops' },
      ];
      let enabled = [];
      try { enabled = JSON.parse(fs.readFileSync(path.join(PIX_HOME, 'enabled.json'), 'utf8')); } catch (e) {}
      divider();
      print('  {bold}plugins{/}');
      divider();
      const cats = {};
      all.forEach(p => { if (!cats[p.cat]) cats[p.cat] = []; cats[p.cat].push(p); });
      Object.entries(cats).forEach(([cat, items]) => {
        print(`  {gray-fg}${cat}{/}`);
        items.forEach(p => {
          const on = enabled.includes(p.id);
          print(`    ${on ? '{#22c55e-fg}●{/}' : '{gray-fg}○{/}'} ${p.name}`);
        });
        print('');
      });
      print('  {gray-fg}pix plugins enable <id>{/}');
      print('  {gray-fg}pix plugins disable <id>{/}');
      print('');
      break;
    }

    case 'sessions': {
      let list = [];
      try {
        list = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json')).map(f => {
          try { const s = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8')); return s; } catch (e) { return null; }
        }).filter(Boolean);
      } catch (e) {}
      divider();
      print(`  {bold}sessions${'{/}'} ${gray-fg}(${list.length}){/}`);
      divider();
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
      divider();
      print('  {bold}cost{/}');
      divider();
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

    case 'exit':
    case 'quit':
      process.exit(0);

    default:
      if (!cmd) break;
      // Treat as a question — send to AI
      const sessionId = newSession();
      print(`  {gray-fg}thinking...{/}`);
      const msgs = [{ role: 'user', content: raw }];
      askAI(msgs, (reply) => {
        // Remove the thinking line
        const lines = outputBox.getContent().split('\n');
        const thinkIdx = lines.findIndex(l => l.includes('thinking...'));
        if (thinkIdx > -1) { lines.splice(thinkIdx, 1); outputBox.setContent(lines.join('\n')); }
        reply.split('\n').forEach(l => print(`  ${l}`));
        print('');
        saveMsg(sessionId, 'user', raw);
        saveMsg(sessionId, 'assistant', reply);
        screen.render();
      });
      break;
  }
}

// ── Input handling ──
input.on('submit', (val) => {
  const text = val.trim();
  if (!text) return;
  history.push(text);
  historyIdx = history.length;
  print(`  {#22c55e-fg}❯{/} ${text}`);
  input.clearValue();
  handleCommand(text);
});

input.key(['up'], () => {
  if (historyIdx > 0) { historyIdx--; input.setValue(history[historyIdx]); }
});
input.key(['down'], () => {
  if (historyIdx < history.length - 1) { historyIdx++; input.setValue(history[historyIdx]); } else { historyIdx = history.length; input.clearValue(); }
});

// ── Keybinds ──
screen.key(['C-c', 'q'], () => process.exit(0));
screen.key(['C-l'], () => { outputBox.setContent(''); screen.render(); });
screen.key(['tab'], () => { input.focus(); screen.render(); });

// ── Welcome ──
printLines([
  '',
  `  {bold}{#818cf8-fg}pix{/} {gray-fg}v${VERSION}{/}`,
  `  {gray-fg}${BY}{/}`,
  '',
  `  {gray-fg}type a command or ask anything{/}`,
  `  {gray-fg}try: {/}{bold}help{/}{gray-fg}, {/}{bold}status{/}{gray-fg}, {/}{bold}review <file>{/}`,
  ''
]);

input.focus();
screen.render();
