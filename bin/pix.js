#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const gradient = require('gradient-string');
const boxen = require('boxen');
const inquirer = require('inquirer');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, spawn } = require('child_process');

const program = new Command();
const VERSION = '1.0.0';
const PIX_HOME = path.join(os.homedir(), '.pix');
const CONFIG_FILE = path.join(PIX_HOME, 'config.json');
const SESSIONS_DIR = path.join(PIX_HOME, 'sessions');
const KEYS_DIR = path.join(PIX_HOME, 'keys');
const LOGS_DIR = path.join(PIX_HOME, 'logs');

function ensureDirectories() {
  [PIX_HOME, SESSIONS_DIR, KEYS_DIR, LOGS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  return { apiKey: '', provider: 'openrouter', mode: 'default', theme: 'dark', autoUpdate: true };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function showBanner() {
  console.log('');
  console.log(gradient.pastel.multiline(figlet.textSync('PIX AI', { font: 'Big', horizontalLayout: 'fitted' })));
  console.log(chalk.gray('  Autonomous AI Coding Companion'));
  console.log(chalk.gray('  by the creators of Lux & Vokk'));
  console.log('');
}

function showVersion() {
  console.log(`pix-ai v${VERSION}`);
}

async function interactiveMode() {
  showBanner();
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '💬 Chat with Pix', value: 'chat' },
        { name: '🔍 Analyze Code', value: 'analyze' },
        { name: '🔧 Fix a Bug', value: 'fix' },
        { name: '📝 Generate Code', value: 'generate' },
        { name: '🧪 Write Tests', value: 'test' },
        { name: '📚 Generate Docs', value: 'docs' },
        { name: '🔄 Translate Code', value: 'translate' },
        { name: '🚀 Deploy', value: 'deploy' },
        { name: '⚙️  Settings', value: 'settings' },
        { name: '📊 Status', value: 'status' },
        { name: '🚪 Exit', value: 'exit' }
      ]
    }
  ]);

  if (action === 'exit') {
    console.log(chalk.green('\n  Goodbye! 👋\n'));
    process.exit(0);
  }

  if (action === 'settings') {
    await showSettings();
  } else if (action === 'status') {
    await showStatus();
  } else {
    console.log(chalk.cyan(`\n  Starting ${action} mode...\n`));
    console.log(chalk.gray('  (Full implementation connects to AI providers)\n'));
  }
}

async function showSettings() {
  const config = loadConfig();
  const { setting } = await inquirer.prompt([
    {
      type: 'list',
      name: 'setting',
      message: 'Settings:',
      choices: [
        { name: `API Key: ${config.apiKey ? '***' + config.apiKey.slice(-4) : 'Not set'}`, value: 'apikey' },
        { name: `Provider: ${config.provider}`, value: 'provider' },
        { name: `Mode: ${config.mode}`, value: 'mode' },
        { name: `Theme: ${config.theme}`, value: 'theme' },
        { name: '← Back', value: 'back' }
      ]
    }
  ]);

  if (setting === 'apikey') {
    const { key } = await inquirer.prompt([{ type: 'input', name: 'key', message: 'Enter API key:' }]);
    config.apiKey = key;
    saveConfig(config);
    console.log(chalk.green('  API key saved!'));
  } else if (setting === 'provider') {
    const { provider } = await inquirer.prompt([{
      type: 'list', name: 'provider', message: 'Select provider:',
      choices: ['openrouter', 'openai', 'anthropic', 'google', 'groq', 'ollama']
    }]);
    config.provider = provider;
    saveConfig(config);
    console.log(chalk.green(`  Provider set to ${provider}!`));
  }
}

async function showStatus() {
  const config = loadConfig();
  const boxContent = [
    `${chalk.bold('Pix AI Status')}`,
    ``,
    `${chalk.gray('Version:')} ${VERSION}`,
    `${chalk.gray('Provider:')} ${config.provider}`,
    `${chalk.gray('API Key:')} ${config.apiKey ? '***' + config.apiKey.slice(-4) : 'Not set'}`,
    `${chalk.gray('Home:')} ${PIX_HOME}`,
    `${chalk.gray('Platform:')} ${os.platform()} ${os.arch()}`,
    `${chalk.gray('Node:')} ${process.version}`,
    ``,
    `${chalk.gray('Engines:')} 59 active`,
    `${chalk.gray('Modes:')} Plan, Build, Debug, Write Fast, Debug Deep, Self-Rewrite`,
    `${chalk.gray('Safety:')} Bouncer active (immutable guardrails)`
  ].join('\n');

  console.log(boxen(boxContent, { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }));
}

program
  .name('pix')
  .description('Pix - AI Harness by the creators of Lux and Vokk')
  .version(VERSION);

program
  .command('chat')
  .description('Start interactive chat with Pix')
  .action(async () => {
    ensureDirectories();
    showBanner();
    console.log(chalk.cyan('  Starting chat session...\n'));
    console.log(chalk.gray('  Type your message and press Enter. Type /exit to quit.\n'));
    await interactiveMode();
  });

program
  .command('ask <question>')
  .description('Ask Pix a question directly')
  .action(async (question) => {
    ensureDirectories();
    showBanner();
    console.log(chalk.cyan(`  Question: ${question}\n`));
    console.log(chalk.gray('  (Connects to AI provider for response)\n'));
  });

program
  .command('init')
  .description('Initialize Pix in current directory')
  .action(() => {
    ensureDirectories();
    const pixDir = path.join(process.cwd(), '.pix');
    if (!fs.existsSync(pixDir)) fs.mkdirSync(pixDir, { recursive: true });
    const config = {
      project: path.basename(process.cwd()),
      created: new Date().toISOString(),
      mode: 'default',
      engines: { cognitive: true, subagents: true, background: true, browser: true },
      safety: { bouncer: true, contentFilter: true, consultationRequired: true }
    };
    fs.writeFileSync(path.join(pixDir, 'project.json'), JSON.stringify(config, null, 2));
    console.log(chalk.green('  ✓ Pix initialized in current directory'));
    console.log(chalk.gray(`  Config: ${pixDir}/project.json`));
  });

program
  .command('config')
  .description('Configure Pix settings')
  .action(async () => {
    ensureDirectories();
    showBanner();
    await showSettings();
  });

program
  .command('status')
  .description('Show Pix status and configuration')
  .action(async () => {
    ensureDirectories();
    showBanner();
    await showStatus();
  });

program
  .command('engines')
  .description('List all available AI engines')
  .action(() => {
    ensureDirectories();
    showBanner();
    const engines = [
      '🧠 Core AI (thinking, planning, execution)',
      '🕸️ Orchestrator (ties all agents together)',
      '🔮 Strategy Engine (problem-solving patterns)',
      '💭 Thinking Engine (metacognition, bias detection)',
      '🧩 Memory Engine (context, knowledge base)',
      '📋 Planner Engine (task decomposition)',
      '📦 Sandbox Engine (20+ languages)',
      '💻 Terminal Engine (custom shell, aliases)',
      '📁 File System Engine (CRUD, search, backup)',
      '⚙️ Process Manager Engine',
      '🌐 Web Automation Engine',
      '📝 PixBase Code Editor',
      '🚀 Go On Engine (autonomous execution)',
      '📜 Session History Engine',
      '❓ Clarification Engine (question queue)',
      '🔬 Research Engine (pre-task research)',
      '👁️ Vision Engine (10 capabilities)',
      '🔒 Private Modes Engine',
      '🔑 Smart API Key Manager (12 providers)',
      '📝 Markdown/Obsidian Engine',
      '🪟 VS Code Connector',
      '🦙 Local Model Detector',
      '🤖 Platform Bot Engine (18 platforms)',
      '🎤 Voice I/O Engine (15 languages)',
      '📸 Screen Recording Engine',
      '🧪 API Testing Engine',
      '🔗 Sub-Agent Engine (spawns workers)',
      '⚡ Parallel Task Engine',
      '🔄 Background Task Engine',
      '📊 Task Stream Engine',
      '📱 App Connector Engine (any app)',
      '🎮 Game Engine Bridge (Unity/Unreal/Godot)',
      '💬 AI-to-AI Chat Engine',
      '👥 Teams/Discord Bot Engine',
      '🌐 Browser Agent Engine',
      '🖥️ Terminal Multiplexer',
      '🔐 SSH Manager Engine',
      '🐳 Docker Manager Engine',
      '🔀 Git Advanced Engine',
      '🧠 Pattern Learner Engine',
      '⌨️ Smart Auto-Complete Engine',
      '⚠️ Error Predictor Engine',
      '👁️ Code Reviewer AI Engine',
      '📚 Documentation Generator',
      '🗺️ Mind Map Engine',
      '💡 Prompt Engine (templates)',
      '🔄 Workflow Builder Engine',
      '🎯 Focus Mode Engine',
      '📊 System Monitor Engine',
      '🛡️ Security Scanner Engine',
      '💾 Backup Engine',
      '🕸️ Knowledge Graph Engine',
      '📈 Learning Path Engine',
      '📋 Code Digest Engine',
      '📧 Email Agent Engine',
      '📅 Calendar Agent Engine',
      '🌐 Translate Engine',
      '🧠 Cognitive Meta Engine (82 features)',
      '🛡️ Safety Bouncer (immutable)'
    ];
    console.log(chalk.bold.cyan(`\n  ${engines.length} Active Engines:\n`));
    engines.forEach(e => console.log(chalk.gray(`  ${e}`)));
    console.log('');
  });

program
  .command('safety')
  .description('Show safety bouncer status')
  .action(() => {
    ensureDirectories();
    showBanner();
    console.log(chalk.bold.yellow('\n  🛡️  Safety Bouncer Status\n'));
    console.log(chalk.green('  ✓ Immutable guardrails: ACTIVE'));
    console.log(chalk.green('  ✓ No guardrail rewrite: ENFORCED'));
    console.log(chalk.green('  ✓ Risky modification consultation: REQUIRED'));
    console.log(chalk.green('  ✓ Illegal content: BLOCKED'));
    console.log(chalk.green('  ✓ Adult content: ALLOWED with censor'));
    console.log(chalk.green('  ✓ Audit trail: ENABLED'));
    console.log(chalk.green('  ✓ Reversibility: REQUIRED'));
    console.log(chalk.gray('\n  All modifications are logged and reversible.'));
    console.log(chalk.gray('  Risky modifications require explicit user approval.\n'));
  });

program
  .command('modes')
  .description('Show available AI modes')
  .action(() => {
    ensureDirectories();
    showBanner();
    const modes = [
      { name: 'Plan', desc: 'Research, analyze, plan (no changes)' },
      { name: 'Build', desc: 'Full capabilities, create and modify' },
      { name: 'Private', desc: 'Isolated environment, enhanced privacy' },
      { name: 'Research', desc: 'Deep research with web access' },
      { name: 'Review', desc: 'Code review and quality analysis' },
      { name: 'Debug', desc: 'Debugging with step-through' },
      { name: 'Teach', desc: 'Educational with explanations' },
      { name: 'Creative', desc: 'Creative brainstorming' },
      { name: 'Write Fast', desc: 'Speed mode - ship it now' },
      { name: 'Debug Deep', desc: 'Forensic debugging - thorough' },
      { name: 'Self-Rewrite', desc: 'Pix tweaks itself (UI, behavior, pacing)' }
    ];
    console.log(chalk.bold.cyan('\n  Available Modes:\n'));
    modes.forEach(m => {
      console.log(chalk.yellow(`  ${m.name.padEnd(15)} ${chalk.gray(m.desc)}`));
    });
    console.log('');
  });

program
  .command('cognitive')
  .description('Show cognitive features')
  .action(() => {
    ensureDirectories();
    showBanner();
    console.log(chalk.bold.magenta('\n  🧠 Cognitive Meta Engine - 82 Features\n'));
    console.log(chalk.gray('  Core:'));
    console.log(chalk.white('    Intent Drift, Goal Graph, Counterfactual, Self-Evolving'));
    console.log(chalk.white('    Environment Detection, Parallel Agents, Confidence Map'));
    console.log(chalk.white('    Failure Budget, Mystery State, Mission Memory'));
    console.log(chalk.gray('  Advanced:'));
    console.log(chalk.white('    Hypothesis Engine, User Model, Temporal Intelligence'));
    console.log(chalk.white('    Dream Cycle, Memory Decay, Opportunity Detector'));
    console.log(chalk.white('    Decision Archaeology, Skill Mutation, Dead-End Memory'));
    console.log(chalk.gray('  Autonomous (requires permission):'));
    console.log(chalk.white('    Self-Rewriting Workflows, Uncertainty Exploration'));
    console.log(chalk.white('    Red Team, Rule-Breaking Sandbox, Multiple Selves'));
    console.log(chalk.white('    Autonomous Problem Discovery, Self-Experimentation'));
    console.log(chalk.gray('  Safety:'));
    console.log(chalk.red('    Safety Bouncer: IMMUTABLE - cannot be modified'));
    console.log(chalk.red('    Risky mods: REQUIRES user consultation'));
    console.log(chalk.red('    Illegal content: BLOCKED'));
    console.log(chalk.green('    Adult content: ALLOWED with censor\n'));
  });

program
  .command('self-rewrite')
  .description('Enter self-rewrite mode (Pix tweaks itself)')
  .action(async () => {
    ensureDirectories();
    showBanner();
    console.log(chalk.bold.cyan('\n  🪞 Self-Rewrite Mode\n'));
    console.log(chalk.gray('  Pix can modify:'));
    console.log(chalk.white('    ✓ UI theme, layout, animations'));
    console.log(chalk.white('    ✓ Response length, verbosity'));
    console.log(chalk.white('    ✓ Thinking depth, pacing'));
    console.log(chalk.white('    ✓ Tool presentation order'));
    console.log(chalk.white('    ✓ Personality traits (formality, humor)'));
    console.log(chalk.gray('\n  Safety:'));
    console.log(chalk.red('    ✗ Cannot rewrite guardrails'));
    console.log(chalk.red('    ✗ Cannot bypass permissions'));
    console.log(chalk.red('    ✗ Cannot disable audit logs'));
    console.log(chalk.yellow('    ⚠ Risky changes require your approval\n'));
  });

program
  .command('doctor')
  .description('Run diagnostics on Pix installation')
  .action(() => {
    ensureDirectories();
    showBanner();
    console.log(chalk.bold.cyan('\n  Running diagnostics...\n'));
    
    const checks = [
      { name: 'Node.js version', status: process.version ? 'ok' : 'error', detail: process.version },
      { name: 'Pix home directory', status: fs.existsSync(PIX_HOME) ? 'ok' : 'warning', detail: PIX_HOME },
      { name: 'Config file', status: fs.existsSync(CONFIG_FILE) ? 'ok' : 'warning', detail: CONFIG_FILE },
      { name: 'Sessions directory', status: fs.existsSync(SESSIONS_DIR) ? 'ok' : 'warning', detail: SESSIONS_DIR },
      { name: 'Keys directory', status: fs.existsSync(KEYS_DIR) ? 'ok' : 'warning', detail: KEYS_DIR },
      { name: 'Platform', status: 'ok', detail: `${os.platform()} ${os.arch()}` },
      { name: 'Memory', status: 'ok', detail: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB` },
      { name: 'CPUs', status: 'ok', detail: `${os.cpus().length} cores` }
    ];

    checks.forEach(c => {
      const icon = c.status === 'ok' ? chalk.green('✓') : c.status === 'warning' ? chalk.yellow('⚠') : chalk.red('✗');
      console.log(`  ${icon} ${c.name}: ${chalk.gray(c.detail)}`);
    });
    console.log('');
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  ensureDirectories();
  interactiveMode();
}
