#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const boxen = require('boxen');
const figlet = require('figlet');
const gradient = require('gradient-string');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const AIAgentCore = require('./modules/agent/core');
const SandboxEngine = require('./modules/agent/sandbox');
const WebAutomationEngine = require('./modules/agent/web');
const TaskPlannerEngine = require('./modules/agent/planner');
const CustomTerminalEngine = require('./modules/agent/terminal');
const FileSystemOpsEngine = require('./modules/agent/filesystem');
const ProcessManagerEngine = require('./modules/agent/processes');
const MemoryContextEngine = require('./modules/agent/memory');
const StrategyEngine = require('./modules/agent/strategy');
const AIOrchestrator = require('./modules/agent/orchestrator');
const AdvancedThinkingEngine = require('./modules/agent/thinking');
const PrivateModesEngine = require('./modules/agent/modes');
const GoOnEngine = require('./modules/agent/goon');
const SessionHistoryEngine = require('./modules/agent/history');
const VisionEngine = require('./modules/agent/vision');
const ClarificationEngine = require('./modules/agent/clarification');
const PreTaskResearchEngine = require('./modules/agent/research');
const SmartAPIKeyManager = require('./modules/agent/apikeys');
const MarkdownObsidianEngine = require('./modules/agent/markdown');
const VSCodeSpacesConnector = require('./modules/agent/vscode');
const LocalModelDetector = require('./modules/agent/localmodels');
const PlatformBotEngine = require('./modules/agent/bots');
const PixBaseEditorEngine = require('./modules/agent/editor');

const version = '1.0.0';

const pixGradient = gradient(['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']);
const warmGradient = gradient(['#FF9A9E', '#FAD0C4', '#FAD0C4']);
const coolGradient = gradient(['#A1C4FD', '#C2E9FB', '#D4FC79']);

const headerStyle = {
  padding: 1,
  margin: 1,
  borderStyle: 'double',
  borderColor: '#4ECDC4',
  backgroundColor: '#1a1b26'
};

function printBanner() {
  console.log('');
  console.log(pixGradient(figlet.textSync('PIX', { font: 'ANSI Shadow', horizontalLayout: 'fitted' })));
  console.log(chalk.gray('  Your AI-Powered Development Companion'));
  console.log(chalk.dim(`  Version ${version} | Built with ${chalk.cyan('love')}`));
  console.log('');
}

function printBox(content, options = {}) {
  console.log(boxen(content, {
    padding: 1,
    margin: 1,
    borderStyle: options.borderStyle || 'round',
    borderColor: options.borderColor || '#4ECDC4',
    title: options.title,
    titleAlignment: options.titleAlignment || 'left',
    ...options
  }));
}

function printStatus(label, value, color = 'cyan') {
  console.log(`  ${chalk.gray(label + ':')} ${chalk[color](value)}`);
}

function printSuccess(msg) {
  console.log(chalk.green('  ✓ ') + msg);
}

function printError(msg) {
  console.log(chalk.red('  ✗ ') + msg);
}

function printInfo(msg) {
  console.log(chalk.blue('  ℹ ') + msg);
}

function printWarning(msg) {
  console.log(chalk.yellow('  ⚠ ') + msg);
}

function printThinking(msg) {
  console.log(chalk.magenta('  🧠 ') + msg);
}

function printStep(step, total, msg) {
  const progress = `[${step}/${total}]`;
  console.log(chalk.cyan(`  ${progress} `) + msg);
}

async function showHelp() {
  printBanner();

  printBox(`${chalk.bold.cyan('Available Commands:')}

${chalk.yellow('  pix chat')}        Start interactive AI chat
${chalk.yellow('  pix ask')}         Ask a single question
${chalk.yellow('  pix think')}       Deep thinking mode
${chalk.yellow('  pix plan')}        Create a plan
${chalk.yellow('  pix build')}       Build something
${chalk.yellow('  pix research')}    Research a topic
${chalk.yellow('  pix code')}        Code assistance
${chalk.yellow('  pix debug')}       Debug issues
${chalk.yellow('  pix test')}        Run tests
${chalk.yellow('  pix deploy')}      Deploy project
${chalk.yellow('  pix monitor')}     Monitor systems
${chalk.yellow('  pix web')}         Web automation
${chalk.yellow('  pix files')}       File operations
${chalk.yellow('  pix terminal')}    Terminal assistance
${chalk.yellow('  pix process')}     Process management
${chalk.yellow('  pix memory')}      Memory management
${chalk.yellow('  pix vision')}      Image analysis
${chalk.yellow('  pix model')}       Local model management
${chalk.yellow('  pix api')}         API key management
${chalk.yellow('  pix bot')}         Bot integrations
${chalk.yellow('  pix editor')}      PixBase editor
${chalk.yellow('  pix markdown')}    Markdown/Obsidian
${chalk.yellow('  pix vscode')}      VS Code integration
${chalk.yellow('  pix settings')}    Configure settings
${chalk.yellow('  pix stats')}       View statistics
${chalk.yellow('  pix help')}        Show this help

${chalk.dim('  Use --help with any command for more info')}`, {
    title: chalk.bold('PIX Commands'),
    titleAlignment: 'center'
  });
}

async function showStats() {
  printBanner();

  const spinner = ora({ text: 'Loading statistics...', spinner: 'dots' }).start();

  try {
    const config = {};
    const logger = { info: () => {}, warn: () => {}, error: () => {} };

    const orchestrator = new AIOrchestrator(config, logger);
    await orchestrator.initialize();

    spinner.succeed('Statistics loaded!');

    const stats = await orchestrator.getOrchestratorStats();

    printBox(`
${chalk.bold.cyan('Agent Statistics:')}
  ${chalk.gray('Active Sessions:')} ${chalk.green(stats.agentStats.activeAgents)}
  ${chalk.gray('Total Plans:')} ${chalk.yellow(stats.agentStats.plans)}
  ${chalk.gray('Memories:')} ${chalk.magenta(stats.agentStats.memories)}

${chalk.bold.cyan('Sandbox Statistics:')}
  ${chalk.gray('Instances:')} ${chalk.green(stats.sandboxStats.instances)}
  ${chalk.gray('Total Executions:')} ${chalk.yellow(stats.sandboxStats.totalExecutions)}
  ${chalk.gray('Languages:')} ${chalk.magenta(stats.sandboxStats.languages)}

${chalk.bold.cyan('Terminal Statistics:')}
  ${chalk.gray('Sessions:')} ${chalk.green(stats.terminalStats.sessions)}
  ${chalk.gray('Commands Executed:')} ${chalk.yellow(stats.terminalStats.commands)}
  ${chalk.gray('Aliases:')} ${chalk.magenta(stats.terminalStats.aliases)}

${chalk.bold.cyan('Memory Statistics:')}
  ${chalk.gray('Total Memories:')} ${chalk.green(stats.memoryStats.memories)}
  ${chalk.gray('Conversations:')} ${chalk.yellow(stats.memoryStats.conversations)}
  ${chalk.gray('Knowledge:')} ${chalk.magenta(stats.memoryStats.knowledge)}`, {
      title: chalk.bold('PIX Statistics'),
      titleAlignment: 'center'
    });

  } catch (error) {
    spinner.fail('Failed to load statistics');
    printError(error.message);
  }
}

async function startChat() {
  printBanner();

  const config = {};
  const logger = { info: () => {}, warn: () => {}, error: () => {} };

  const orchestrator = new AIOrchestrator(config, logger);
  await orchestrator.initialize();

  const history = new SessionHistoryEngine(config, logger);
  await history.initialize();

  const session = await history.createSession({
    type: 'chat',
    context: { source: 'cli' }
  });

  printBox(`Starting chat session: ${chalk.cyan(session.title)}
${chalk.dim('Type your message and press Enter. Use /help for commands.')}
${chalk.dim('Press Ctrl+C to exit.')}`, {
    title: chalk.bold('PIX Chat'),
    titleAlignment: 'center'
  });

  const thinking = new AdvancedThinkingEngine(config, logger);
  await thinking.initialize();

  let continueChatting = true;

  while (continueChatting) {
    try {
      const { message } = await inquirer.prompt([
        {
          type: 'input',
          name: 'message',
          message: chalk.cyan('You:'),
          prefix: ''
        }
      ]);

      if (!message.trim()) continue;

      if (message.toLowerCase() === '/exit' || message.toLowerCase() === '/quit') {
        continueChatting = false;
        break;
      }

      if (message.toLowerCase() === '/help') {
        printBox(`
${chalk.yellow('/help')}     Show commands
${chalk.yellow('/stats')}    Show session stats
${chalk.yellow('/clear')}    Clear screen
${chalk.yellow('/think')}    Toggle thinking display
${chalk.yellow('/mode')}     Switch mode (plan/build/private)
${chalk.yellow('/exit')}     Exit chat`, {
          title: chalk.bold('Chat Commands'),
          titleAlignment: 'center'
        });
        continue;
      }

      if (message.toLowerCase() === '/clear') {
        console.clear();
        printBanner();
        continue;
      }

      if (message.toLowerCase() === '/stats') {
        const sessionStats = await history.getSession(session.id);
        printBox(`
${chalk.gray('Messages:')} ${chalk.cyan(sessionStats.metrics.messageCount)}
${chalk.gray('Duration:')} ${chalk.cyan(new Date() - new Date(session.createdAt))}ms`, {
          title: chalk.bold('Session Stats'),
          titleAlignment: 'center'
        });
        continue;
      }

      await history.addMessage(session.id, {
        role: 'user',
        content: message
      });

      const spinner = ora({
        text: 'Thinking...',
        spinner: {
          interval: 80,
          frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
        }
      }).start();

      const shouldResearch = await orchestrator.getSubEngine('research').shouldResearch(message);
      if (shouldResearch.shouldResearch) {
        spinner.text = `Researching: ${message.substring(0, 30)}...`;
        const research = await orchestrator.getSubEngine('research').startResearch({
          topic: message,
          mode: 'quick'
        });
      }

      const thinkingSession = await thinking.createThinkingSession({
        name: `Chat ${message.substring(0, 20)}`,
        problem: message,
        level: 2,
        mode: 'divergent'
      });

      spinner.text = 'Processing your request...';

      const result = await orchestrator.processRequest({
        input: message,
        context: { sessionId: session.id },
        sessionId: session.id
      });

      spinner.succeed('Done!');

      if (result && result.result && result.result.summary) {
        printBox(result.result.summary, {
          title: chalk.bold('PIX Response'),
          titleAlignment: 'center',
          borderColor: '#4CAF50'
        });
      } else {
        printBox(`I've processed your request about: "${message.substring(0, 50)}..."

Here's what I found:
${result.result ? JSON.stringify(result.result, null, 2).substring(0, 500) : 'Processing complete.'}`, {
          title: chalk.bold('PIX Response'),
          titleAlignment: 'center',
          borderColor: '#4CAF50'
        });
      }

      await history.addMessage(session.id, {
        role: 'assistant',
        content: result.result ? JSON.stringify(result.result) : 'Response generated'
      });

    } catch (error) {
      if (error.name === 'ExitPromptError') {
        continueChatting = false;
      } else {
        printError(`Error: ${error.message}`);
      }
    }
  }

  await history.generateSummary(session.id);
  printBox(chalk.dim('Chat session ended. Summary saved.'), {
    borderColor: '#666'
  });
}

async function askQuestion(question) {
  printBanner();

  const config = {};
  const logger = { info: () => {}, warn: () => {}, error: () => {} };

  const orchestrator = new AIOrchestrator(config, logger);
  await orchestrator.initialize();

  const spinner = ora({
    text: 'Processing...',
    spinner: {
      interval: 80,
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    }
  }).start();

  try {
    const result = await orchestrator.processRequest({
      input: question
    });

    spinner.succeed('Done!');

    printBox(result.result ? JSON.stringify(result.result, null, 2) : 'Response generated.', {
      title: chalk.bold('PIX Answer'),
      titleAlignment: 'center',
      borderColor: '#4CAF50'
    });

  } catch (error) {
    spinner.fail('Failed');
    printError(error.message);
  }
}

async function startInteractive() {
  printBanner();

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '💬 Chat with Pix', value: 'chat' },
        { name: '❓ Ask a question', value: 'ask' },
        { name: '🧠 Think deeply about something', value: 'think' },
        { name: '📋 Create a plan', value: 'plan' },
        { name: '🔨 Build something', value: 'build' },
        { name: '🔬 Research a topic', value: 'research' },
        { name: '💻 Code assistance', value: 'code' },
        { name: '🐛 Debug an issue', value: 'debug' },
        { name: '🌐 Web automation', value: 'web' },
        { name: '📁 File operations', value: 'files' },
        { name: '🖥️ Terminal assistance', value: 'terminal' },
        { name: '🧠 Manage memories', value: 'memory' },
        { name: '📸 Analyze images', value: 'vision' },
        { name: '🤖 Local models', value: 'models' },
        { name: '🔑 API keys', value: 'api' },
        { name: '🤖 Bot integrations', value: 'bots' },
        { name: '📝 PixBase editor', value: 'editor' },
        { name: '📖 Markdown/Obsidian', value: 'markdown' },
        { name: '📊 View statistics', value: 'stats' },
        { name: '⚙️ Settings', value: 'settings' },
        { name: '❌ Exit', value: 'exit' }
      ]
    }
  ]);

  switch (action) {
    case 'chat': await startChat(); break;
    case 'ask':
      const { question } = await inquirer.prompt([{
        type: 'input',
        name: 'question',
        message: 'What is your question?'
      }]);
      await askQuestion(question);
      break;
    case 'stats': await showStats(); break;
    case 'settings': await showSettings(); break;
    case 'exit':
      printBox(chalk.dim('Thanks for using PIX! Goodbye!'), {
        borderColor: '#FF6B6B'
      });
      process.exit(0);
    default:
      printInfo(`${action} - Feature coming soon!`);
      break;
  }
}

async function showSettings() {
  printBanner();

  printBox(`
${chalk.bold.cyan('Current Settings:')}

${chalk.gray('AI Model:')} ${chalk.cyan('Auto-detect')}
${chalk.gray('Thinking Level:')} ${chalk.cyan('Medium')}
${chalk.gray('Ask Mode:')} ${chalk.cyan('Queue')}
${chalk.gray('Research Before Task:')} ${chalk.cyan('Enabled')}
${chalk.gray('Work Mode:')} ${chalk.cyan('Disabled')}
${chalk.gray('Quality Mode:')} ${chalk.cyan('Perfect')}`, {
    title: chalk.bold('PIX Settings'),
    titleAlignment: 'center'
  });
}

program
  .name('pix')
  .description('PIX - Your AI-Powered Development Companion')
  .version(version);

program
  .command('chat')
  .description('Start interactive AI chat')
  .action(startChat);

program
  .command('ask <question>')
  .description('Ask a single question')
  .action(askQuestion);

program
  .command('stats')
  .description('View statistics')
  .action(showStats);

program
  .command('help')
  .description('Show help')
  .action(showHelp);

program
  .command('settings')
  .description('View settings')
  .action(showSettings);

program
  .command('ui')
  .description('Start interactive UI')
  .action(startInteractive);

program.parse(process.argv);

if (process.argv.length <= 2) {
  startInteractive();
}
