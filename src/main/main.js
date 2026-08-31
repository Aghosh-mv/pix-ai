const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, screen, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const Store = require('electron-store');
const { spawn, exec, execSync } = require('child_process');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

const AIEngine = require('./modules/ai/engine');
const AutomationEngine = require('./modules/automation/engine');
const SandboxEngine = require('./modules/sandbox/engine');
const StorageEngine = require('./modules/storage/engine');
const LearningEngine = require('./modules/learning/engine');
const KnowledgeEngine = require('./modules/knowledge/engine');
const PluginManager = require('./modules/plugins/manager');
const TaskScheduler = require('./modules/tasks/scheduler');
const Logger = require('./utils/logger');
const ConfigManager = require('./config/manager');

class PixApp {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.store = new Store({ name: 'pix-config' });
    this.logger = new Logger('pix');
    this.config = new ConfigManager(this.store);
    this.eventBus = new EventEmitter();
    this.eventBus.setMaxListeners(100);

    this.aiEngine = null;
    this.automationEngine = null;
    this.sandboxEngine = null;
    this.storageEngine = null;
    this.learningEngine = null;
    this.knowledgeEngine = null;
    this.pluginManager = null;
    this.taskScheduler = null;

    this.activeSessions = new Map();
    this.windowPool = [];
    this.backgroundWorkers = [];
  }

  async initialize() {
    this.logger.info('Initializing Pix AI Harness v1.0.0...');
    this.logger.info('By the creators of Lux and Vokk');

    await this.config.initialize();
    await this.initializeEngines();
    await this.createMainWindow();
    await this.createTray();
    this.registerIPCHandlers();
    this.setupAutoUpdater();
    this.setupPermissionHandlers();

    this.logger.info('Pix initialized successfully');
  }

  async initializeEngines() {
    this.logger.info('Initializing AI engines...');

    this.aiEngine = new AIEngine(this.config, this.logger);
    await this.aiEngine.initialize();

    this.automationEngine = new AutomationEngine(this.config, this.logger);
    await this.automationEngine.initialize();

    this.sandboxEngine = new SandboxEngine(this.config, this.logger);
    await this.sandboxEngine.initialize();

    this.storageEngine = new StorageEngine(this.config, this.logger);
    await this.storageEngine.initialize();

    this.learningEngine = new LearningEngine(this.config, this.logger, this.automationEngine);
    await this.learningEngine.initialize();

    this.knowledgeEngine = new KnowledgeEngine(this.config, this.logger);
    await this.knowledgeEngine.initialize();

    this.pluginManager = new PluginManager(this.config, this.logger);
    await this.pluginManager.initialize();

    this.taskScheduler = new TaskScheduler(this.config, this.logger);
    await this.taskScheduler.initialize();

    this.logger.info('All engines initialized');
  }

  async createMainWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    this.mainWindow = new BrowserWindow({
      width: Math.min(1920, width),
      height: Math.min(1080, height),
      minWidth: 1200,
      minHeight: 800,
      title: 'Pix - AI Harness',
      icon: path.join(__dirname, '../assets/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        preload: path.join(__dirname, 'preload.js'),
        webviewTag: true,
        enableRemoteModule: false,
        backgroundThrottling: false
      },
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#0a0a0f',
      show: false,
      trafficLightPosition: { x: 16, y: 16 }
    });

    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }

  async createTray() {
    const iconPath = path.join(__dirname, '../assets/icon.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    this.tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Pix', click: () => this.mainWindow?.show() },
      { type: 'separator' },
      { label: 'New Session', click: () => this.createNewSession() },
      { label: 'Sandbox', click: () => this.openSandbox() },
      { type: 'separator' },
      { label: 'Settings', click: () => this.openSettings() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]);

    this.tray.setToolTip('Pix AI Harness');
    this.tray.setContextMenu(contextMenu);
    this.tray.on('click', () => this.mainWindow?.show());
  }

  registerIPCHandlers() {
    ipcMain.handle('pix:get-config', () => this.config.getAll());
    ipcMain.handle('pix:set-config', (_, key, value) => this.config.set(key, value));
    ipcMain.handle('pix:get-api-keys', () => this.config.getApiKeys());
    ipcMain.handle('pix:set-api-keys', (_, keys) => this.config.setApiKeys(keys));

    ipcMain.handle('pix:ai:complete', async (_, params) => {
      return this.aiEngine.complete(params);
    });

    ipcMain.handle('pix:ai:stream', async (_, params) => {
      const sessionId = uuidv4();
      const stream = this.aiEngine.stream(params);
      stream.on('data', (chunk) => {
        this.mainWindow?.webContents.send('pix:ai:stream:data', { sessionId, chunk });
      });
      stream.on('end', () => {
        this.mainWindow?.webContents.send('pix:ai:stream:end', { sessionId });
      });
      stream.on('error', (err) => {
        this.mainWindow?.webContents.send('pix:ai:stream:error', { sessionId, error: err.message });
      });
      return { sessionId };
    });

    ipcMain.handle('pix:ai:vision', async (_, params) => {
      return this.aiEngine.vision(params);
    });

    ipcMain.handle('pix:automation:screenshot', async (_, params) => {
      return this.automationEngine.screenshot(params);
    });

    ipcMain.handle('pix:automation:click', async (_, params) => {
      return this.automationEngine.click(params);
    });

    ipcMain.handle('pix:automation:type', async (_, params) => {
      return this.automationEngine.type(params);
    });

    ipcMain.handle('pix:automation:key', async (_, params) => {
      return this.automationEngine.keyPress(params);
    });

    ipcMain.handle('pix:automation:move', async (_, params) => {
      return this.automationEngine.moveMouse(params);
    });

    ipcMain.handle('pix:automation:scroll', async (_, params) => {
      return this.automationEngine.scroll(params);
    });

    ipcMain.handle('pix:automation:drag', async (_, params) => {
      return this.automationEngine.drag(params);
    });

    ipcMain.handle('pix:automation:app:open', async (_, params) => {
      return this.automationEngine.openApp(params);
    });

    ipcMain.handle('pix:automation:app:close', async (_, params) => {
      return this.automationEngine.closeApp(params);
    });

    ipcMain.handle('pix:automation:app:list', async () => {
      return this.automationEngine.listApps();
    });

    ipcMain.handle('pix:automation:app:focus', async (_, params) => {
      return this.automationEngine.focusApp(params);
    });

    ipcMain.handle('pix:automation:download', async (_, params) => {
      return this.automationEngine.download(params);
    });

    ipcMain.handle('pix:automation:find', async (_, params) => {
      return this.automationEngine.findElement(params);
    });

    ipcMain.handle('pix:automation:readScreen', async (_, params) => {
      return this.automationEngine.readScreen(params);
    });

    ipcMain.handle('pix:automation:ocr', async (_, params) => {
      return this.automationEngine.ocr(params);
    });

    ipcMain.handle('pix:automation:webhook', async (_, params) => {
      return this.automationEngine.createWebhook(params);
    });

    ipcMain.handle('pix:sandbox:create', async (_, params) => {
      return this.sandboxEngine.create(params);
    });

    ipcMain.handle('pix:sandbox:execute', async (_, params) => {
      return this.sandboxEngine.execute(params);
    });

    ipcMain.handle('pix:sandbox:destroy', async (_, params) => {
      return this.sandboxEngine.destroy(params);
    });

    ipcMain.handle('pix:sandbox:list', async () => {
      return this.sandboxEngine.list();
    });

    ipcMain.handle('pix:sandbox:status', async (_, params) => {
      return this.sandboxEngine.status(params);
    });

    ipcMain.handle('pix:sandbox:install', async (_, params) => {
      return this.sandboxEngine.installPackage(params);
    });

    ipcMain.handle('pix:sandbox:fs', async (_, params) => {
      return this.sandboxEngine.fileSystemOp(params);
    });

    ipcMain.handle('pix:storage:save', async (_, params) => {
      return this.storageEngine.save(params);
    });

    ipcMain.handle('pix:storage:load', async (_, params) => {
      return this.storageEngine.load(params);
    });

    ipcMain.handle('pix:storage:list', async (_, params) => {
      return this.storageEngine.list(params);
    });

    ipcMain.handle('pix:storage:delete', async (_, params) => {
      return this.storageEngine.delete(params);
    });

    ipcMain.handle('pix:storage:search', async (_, params) => {
      return this.storageEngine.search(params);
    });

    ipcMain.handle('pix:storage:stats', async () => {
      return this.storageEngine.stats();
    });

    ipcMain.handle('pix:storage:export', async (_, params) => {
      return this.storageEngine.export(params);
    });

    ipcMain.handle('pix:storage:import', async (_, params) => {
      return this.storageEngine.import(params);
    });

    ipcMain.handle('pix:learning:observe', async (_, params) => {
      return this.learningEngine.observe(params);
    });

    ipcMain.handle('pix:learning:analyze', async (_, params) => {
      return this.learningEngine.analyze(params);
    });

    ipcMain.handle('pix:learning:teach', async (_, params) => {
      return this.learningEngine.teach(params);
    });

    ipcMain.handle('pix:learning:recall', async (_, params) => {
      return this.learningEngine.recall(params);
    });

    ipcMain.handle('pix:learning:patterns', async () => {
      return this.learningEngine.getPatterns();
    });

    ipcMain.handle('pix:knowledge:search', async (_, params) => {
      return this.knowledgeEngine.search(params);
    });

    ipcMain.handle('pix:knowledge:news', async (_, params) => {
      return this.knowledgeEngine.getNews(params);
    });

    ipcMain.handle('pix:knowledge:wiki', async (_, params) => {
      return this.knowledgeEngine.getWikipedia(params);
    });

    ipcMain.handle('pix:knowledge:trends', async (_, params) => {
      return this.knowledgeEngine.getTrends(params);
    });

    ipcMain.handle('pix:knowledge:weather', async (_, params) => {
      return this.knowledgeEngine.getWeather(params);
    });

    ipcMain.handle('pix:knowledge:stocks', async (_, params) => {
      return this.knowledgeEngine.getStocks(params);
    });

    ipcMain.handle('pix:plugins:list', async () => {
      return this.pluginManager.list();
    });

    ipcMain.handle('pix:plugins:install', async (_, params) => {
      return this.pluginManager.install(params);
    });

    ipcMain.handle('pix:plugins:uninstall', async (_, params) => {
      return this.pluginManager.uninstall(params);
    });

    ipcMain.handle('pix:plugins:enable', async (_, params) => {
      return this.pluginManager.enable(params);
    });

    ipcMain.handle('pix:plugins:disable', async (_, params) => {
      return this.pluginManager.disable(params);
    });

    ipcMain.handle('pix:tasks:schedule', async (_, params) => {
      return this.taskScheduler.schedule(params);
    });

    ipcMain.handle('pix:tasks:cancel', async (_, params) => {
      return this.taskScheduler.cancel(params);
    });

    ipcMain.handle('pix:tasks:list', async () => {
      return this.taskScheduler.list();
    });

    ipcMain.handle('pix:system:info', () => {
      return {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: os.uptime(),
        hostname: os.hostname(),
        userInfo: os.userInfo()
      };
    });

    ipcMain.handle('pix:system:open-folder', async (_, folderPath) => {
      shell.openPath(folderPath);
    });

    ipcMain.handle('pix:system:show-save-dialog', async (_, options) => {
      return dialog.showSaveDialog(this.mainWindow, options);
    });

    ipcMain.handle('pix:system:show-open-dialog', async (_, options) => {
      return dialog.showOpenDialog(this.mainWindow, options);
    });

    ipcMain.handle('pix:system:show-message-box', async (_, options) => {
      return dialog.showMessageBox(this.mainWindow, options);
    });

    ipcMain.handle('pix:session:create', async (_, params) => {
      const sessionId = uuidv4();
      this.activeSessions.set(sessionId, {
        id: sessionId,
        createdAt: new Date(),
        ...params
      });
      return { sessionId };
    });

    ipcMain.handle('pix:session:get', async (_, sessionId) => {
      return this.activeSessions.get(sessionId);
    });

    ipcMain.handle('pix:session:list', async () => {
      return Array.from(this.activeSessions.values());
    });

    ipcMain.handle('pix:session:close', async (_, sessionId) => {
      this.activeSessions.delete(sessionId);
      return { success: true };
    });

    ipcMain.handle('pix:execute:code', async (_, params) => {
      const { code, language, sandboxId } = params;
      if (sandboxId) {
        return this.sandboxEngine.execute({ sandboxId, code, language });
      }
      return this.executeCode(code, language);
    });

    ipcMain.handle('pix:execute:command', async (_, params) => {
      const { command, cwd } = params;
      return new Promise((resolve, reject) => {
        exec(command, { cwd: cwd || process.cwd(), maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) {
            reject({ error: error.message, stderr });
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
    });
  }

  async executeCode(code, language) {
    const tempDir = path.join(os.tmpdir(), 'pix-exec', uuidv4());
    await fs.ensureDir(tempDir);

    const extensions = {
      javascript: '.js',
      python: '.py',
      typescript: '.ts',
      bash: '.sh',
      ruby: '.rb',
      go: '.go',
      rust: '.rs'
    };

    const commands = {
      javascript: `node`,
      python: `python3`,
      bash: `bash`,
      ruby: `ruby`,
      typescript: `npx ts-node`
    };

    const ext = extensions[language] || '.txt';
    const filePath = path.join(tempDir, `exec${ext}`);
    await fs.writeFile(filePath, code);

    const command = commands[language] || 'cat';

    return new Promise((resolve, reject) => {
      exec(`${command} ${filePath}`, { cwd: tempDir, maxBuffer: 10 * 1024 * 1024 }, async (error, stdout, stderr) => {
        await fs.remove(tempDir).catch(() => {});
        if (error) {
          reject({ error: error.message, stderr });
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  setupAutoUpdater() {
    // Auto-updater logic here
  }

  setupPermissionHandlers() {
    this.mainWindow?.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['media', 'geolocation', 'notifications'];
      if (allowedPermissions.includes(permission)) {
        callback(true);
      } else {
        callback(false);
      }
    });
  }
}

const pix = new PixApp();

app.whenReady().then(() => pix.initialize());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    pix.createMainWindow();
  }
});

app.on('before-quit', async () => {
  pix.logger.info('Shutting down Pix...');
  await pix.sandboxEngine?.cleanup();
  await pix.storageEngine?.cleanup();
  pix.taskScheduler?.stop();
});

process.on('uncaughtException', (error) => {
  pix.logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  pix.logger.error('Unhandled Rejection:', reason);
});
