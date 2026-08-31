const { exec, spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class AutomationEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.screenshotDir = path.join(os.homedir(), '.pix/screenshots');
    this.downloadDir = path.join(os.homedir(), '.pix/downloads');
    this.webhooks = new Map();
    this.recording = false;
    this.recordedActions = [];
    this.elementCache = new Map();
    this.screenWatcher = null;
  }

  async initialize() {
    this.logger.info('Initializing Automation Engine...');
    await fs.ensureDir(this.screenshotDir);
    await fs.ensureDir(this.downloadDir);
    await this.detectCapabilities();
    this.logger.info('Automation Engine initialized');
  }

  async detectCapabilities() {
    this.capabilities = {
      platform: os.platform(),
      canScreenshot: true,
      canClick: os.platform() === 'darwin' || os.platform() === 'win32' || os.platform() === 'linux',
      canType: os.platform() === 'darwin' || os.platform() === 'win32' || os.platform() === 'linux',
      canOCR: false,
      hasRobotJS: false,
      hasAppleScript: os.platform() === 'darwin',
      hasPowerShell: os.platform() === 'win32',
      hasXDotool: os.platform() === 'linux'
    };

    try {
      require('robotjs');
      this.capabilities.hasRobotJS = true;
    } catch (e) {}

    try {
      await this.runCommand('which tesseract');
      this.capabilities.canOCR = true;
    } catch (e) {}
  }

  async screenshot(params = {}) {
    const { region, format = 'png', quality = 100, display = 0 } = params;
    const filename = `screenshot-${Date.now()}.${format}`;
    const filepath = path.join(this.screenshotDir, filename);

    this.logger.info(`Taking screenshot: ${filename}`);

    if (os.platform() === 'darwin') {
      const args = ['screencapture', '-x'];
      if (region) {
        args.push('-R', `${region.x},${region.y},${region.width},${region.height}`);
      }
      args.push(filepath);

      await this.runCommand(args.join(' '));
    } else if (os.platform() === 'win32') {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen
        $bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
        $bitmap.Save('${filepath.replace(/\\/g, '\\\\')}')
        $graphics.Dispose()
        $bitmap.Dispose()
      `;
      await this.runCommand(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`);
    } else {
      try {
        await this.runCommand(`scrot '${filepath}'`);
      } catch (e) {
        await this.runCommand(`gnome-screenshot -f '${filepath}'`);
      }
    }

    const stats = await fs.stat(filepath);
    return {
      filepath,
      filename,
      format,
      size: stats.size,
      timestamp: new Date().toISOString(),
      region
    };
  }

  async click(params) {
    const { x, y, button = 'left', clicks = 1, delay = 50 } = params;

    this.logger.info(`Clicking at (${x}, ${y}) with ${button} button`);

    if (os.platform() === 'darwin') {
      const script = `
        tell application "System Events"
          click at {${x}, ${y}}
        end tell
      `;
      await this.runAppleScript(script);
    } else if (this.capabilities.hasRobotJS) {
      const robot = require('robotjs');
      robot.moveMouse(x, y);
      await this.sleep(delay);
      robot.mouseClick(button === 'right');
    } else {
      await this.runCommand(`xdotool mousemove ${x} ${y} click ${clicks}`);
    }

    if (this.recording) {
      this.recordedActions.push({ type: 'click', x, y, button, clicks, timestamp: Date.now() });
    }

    return { success: true, x, y, button };
  }

  async type(params) {
    const { text, delay = 50, clearFirst = false } = params;

    this.logger.info(`Typing text: ${text.substring(0, 50)}...`);

    if (clearFirst) {
      if (os.platform() === 'darwin') {
        await this.keyPress({ key: 'command', modifier: 'a' });
        await this.sleep(100);
      } else {
        await this.keyPress({ key: 'ctrl+a' });
        await this.sleep(100);
      }
    }

    if (os.platform() === 'darwin') {
      const escapedText = text.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
      const script = `
        tell application "System Events"
          keystroke "${escapedText}"
        end tell
      `;
      await this.runAppleScript(script);
    } else if (this.capabilities.hasRobotJS) {
      const robot = require('robotjs');
      for (const char of text) {
        robot.typeChar(char);
        await this.sleep(delay);
      }
    } else {
      const escapedText = text.replace(/'/g, "'\\''");
      await this.runCommand(`xdotool type --delay ${delay} '${escapedText}'`);
    }

    if (this.recording) {
      this.recordedActions.push({ type: 'type', text, delay, timestamp: Date.now() });
    }

    return { success: true, length: text.length };
  }

  async keyPress(params) {
    const { key, modifiers = [], delay = 50 } = params;

    this.logger.info(`Pressing key: ${key}`);

    const modifierMap = {
      command: 'command', cmd: 'command',
      ctrl: 'control', control: 'control',
      alt: 'option', option: 'option',
      shift: 'shift',
      meta: 'command'
    };

    if (os.platform() === 'darwin') {
      const modifierStr = modifiers.length > 0
        ? `using {${modifiers.map(m => modifierMap[m] || m).join(' and ')}}`
        : '';

      const keyMap = {
        'enter': 'return', 'return': 'return',
        'tab': 'tab',
        'space': 'space',
        'backspace': 'delete',
        'delete': 'delete',
        'escape': 'escape',
        'up': 'up arrow',
        'down': 'down arrow',
        'left': 'left arrow',
        'right': 'right arrow',
        'f1': 'f1', 'f2': 'f2', 'f3': 'f3', 'f4': 'f4',
        'f5': 'f5', 'f6': 'f6', 'f7': 'f7', 'f8': 'f8',
        'f9': 'f9', 'f10': 'f10', 'f11': 'f11', 'f12': 'f12'
      };

      const keyName = keyMap[key.toLowerCase()] || key;
      const script = `
        tell application "System Events"
          key code ${this.getKeyCode(keyName)} ${modifierStr}
        end tell
      `;
      await this.runAppleScript(script);
    } else {
      const xdotoolKey = [...modifiers.map(m => modifierMap[m] || m), key].join('+');
      await this.runCommand(`xdotool key ${xdotoolKey}`);
    }

    if (this.recording) {
      this.recordedActions.push({ type: 'keyPress', key, modifiers, timestamp: Date.now() });
    }

    return { success: true, key };
  }

  getKeyCode(key) {
    const keyCodes = {
      'return': 36, 'tab': 48, 'space': 49, 'delete': 51,
      'escape': 53, 'command': 55, 'shift': 57, 'option': 58,
      'control': 59, 'up arrow': 126, 'down arrow': 125,
      'left arrow': 123, 'right arrow': 124, 'f1': 122, 'f2': 120,
      'f3': 99, 'f4': 118, 'f5': 96, 'f6': 97, 'f7': 98,
      'f8': 100, 'f9': 101, 'f10': 109, 'f11': 103, 'f12': 111,
      'a': 0, 'b': 11, 'c': 8, 'd': 2, 'e': 14, 'f': 3,
      'g': 5, 'h': 4, 'i': 34, 'j': 38, 'k': 40, 'l': 37,
      'm': 46, 'n': 45, 'o': 31, 'p': 35, 'q': 12, 'r': 15,
      's': 1, 't': 17, 'u': 32, 'v': 9, 'w': 13, 'x': 7,
      'y': 16, 'z': 6, '0': 29, '1': 18, '2': 19, '3': 20,
      '4': 21, '5': 23, '6': 22, '7': 26, '8': 28, '9': 25
    };
    return keyCodes[key.toLowerCase()] || 0;
  }

  async moveMouse(params) {
    const { x, y, duration = 0.5, easing = 'easeInOut' } = params;

    if (this.capabilities.hasRobotJS) {
      const robot = require('robotjs');
      const startPos = robot.getMousePos();
      const steps = Math.ceil(duration * 60);

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const easedT = this.ease(t, easing);
        const currentX = Math.round(startPos.x + (x - startPos.x) * easedT);
        const currentY = Math.round(startPos.y + (y - startPos.y) * easedT);
        robot.moveMouse(currentX, currentY);
        await this.sleep(1000 / 60);
      }
    } else if (os.platform() === 'darwin') {
      await this.runCommand(`cliclick m:${x},${y}`);
    } else {
      await this.runCommand(`xdotool mousemove --sync ${x} ${y}`);
    }

    return { success: true, x, y };
  }

  ease(t, type) {
    switch (type) {
      case 'easeIn': return t * t;
      case 'easeOut': return t * (2 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'linear': return t;
      default: return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
  }

  async scroll(params) {
    const { x, y, deltaX = 0, deltaY = 0, direction = 'vertical' } = params;

    this.logger.info(`Scrolling at (${x}, ${y}): dx=${deltaX}, dy=${deltaY}`);

    if (this.capabilities.hasRobotJS) {
      const robot = require('robotjs');
      if (x !== undefined && y !== undefined) {
        robot.moveMouse(x, y);
        await this.sleep(50);
      }
      if (direction === 'vertical') {
        robot.scrollMouse(0, deltaY);
      } else {
        robot.scrollMouse(deltaX, 0);
      }
    } else if (os.platform() === 'darwin') {
      const scrollAmount = direction === 'vertical' ? deltaY : deltaX;
      await this.runCommand(`cliclick sc:${scrollAmount}`);
    } else {
      if (direction === 'vertical') {
        await this.runCommand(`xdotool mousemove ${x} ${y} click 5 click 4`);
      }
    }

    return { success: true };
  }

  async drag(params) {
    const { startX, startY, endX, endY, duration = 1, button = 'left' } = params;

    if (this.capabilities.hasRobotJS) {
      const robot = require('robotjs');
      robot.moveMouse(startX, startY);
      await this.sleep(100);
      robot.mouseToggle('down', button);
      await this.sleep(100);

      const steps = Math.ceil(duration * 60);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = Math.round(startX + (endX - startX) * t);
        const y = Math.round(startY + (endY - startY) * t);
        robot.moveMouse(x, y);
        await this.sleep(1000 / 60);
      }

      robot.mouseToggle('up', button);
    } else {
      await this.runCommand(`xdotool mousemove ${startX} ${startY}`);
      await this.sleep(100);
      await this.runCommand(`xdotool mousedown 1`);
      await this.sleep(100);
      await this.runCommand(`xdotool mousemove --sync ${endX} ${endY}`);
      await this.sleep(100);
      await this.runCommand(`xdotool mouseup 1`);
    }

    return { success: true };
  }

  async openApp(params) {
    const { name, path: appPath, args = [], wait = true } = params;

    this.logger.info(`Opening app: ${name || appPath}`);

    let command;
    if (os.platform() === 'darwin') {
      if (appPath) {
        command = `open "${appPath}"`;
      } else {
        command = `open -a "${name}"`;
      }
    } else if (os.platform() === 'win32') {
      if (appPath) {
        command = `start "" "${appPath}"`;
      } else {
        command = `start "" "${name}"`;
      }
    } else {
      if (appPath) {
        command = `"${appPath}"`;
      } else {
        command = name;
      }
    }

    if (args.length > 0) {
      command += ` ${args.map(a => `"${a}"`).join(' ')}`;
    }

    if (wait) {
      await this.runCommand(command);
    } else {
      const child = spawn(command, [], { shell: true, detached: true });
      child.unref();
    }

    return { success: true, name: name || appPath };
  }

  async closeApp(params) {
    const { name, pid, force = false } = params;

    this.logger.info(`Closing app: ${name || pid}`);

    if (os.platform() === 'darwin') {
      if (name) {
        const forceFlag = force ? '-9' : '';
        await this.runCommand(`killall ${forceFlag} "${name}"`);
      } else if (pid) {
        await this.runCommand(`kill ${force ? '-9' : ''} ${pid}`);
      }
    } else if (os.platform() === 'win32') {
      if (name) {
        await this.runCommand(`taskkill /IM "${name}.exe" ${force ? '/F' : ''}`);
      } else if (pid) {
        await this.runCommand(`taskkill /PID ${pid} ${force ? '/F' : ''}`);
      }
    } else {
      if (name) {
        await this.runCommand(`pkill ${force ? '-9' : ''} "${name}"`);
      } else if (pid) {
        await this.runCommand(`kill ${force ? '-9' : ''} ${pid}`);
      }
    }

    return { success: true };
  }

  async listApps() {
    const apps = [];

    if (os.platform() === 'darwin') {
      const output = await this.runCommand('ls /Applications');
      const appDirs = output.split('\n').filter(d => d.endsWith('.app'));
      apps.push(...appDirs.map(d => ({
        name: d.replace('.app', ''),
        path: `/Applications/${d}`,
        platform: 'macos'
      })));
    } else if (os.platform() === 'win32') {
      const output = await this.runCommand('powershell -Command "Get-StartApps | Select-Object Name, AppID | ConvertTo-Json"');
      try {
        const parsed = JSON.parse(output);
        apps.push(...(Array.isArray(parsed) ? parsed : [parsed]).map(a => ({
          name: a.Name,
          id: a.AppID,
          platform: 'windows'
        })));
      } catch (e) {}
    } else {
      try {
        const output = await this.runCommand('ls /usr/share/applications');
        apps.push(...output.split('\n').filter(f => f.endsWith('.desktop')).map(f => ({
          name: f.replace('.desktop', ''),
          path: `/usr/share/applications/${f}`,
          platform: 'linux'
        })));
      } catch (e) {}
    }

    return apps;
  }

  async focusApp(params) {
    const { name, windowId } = params;

    if (os.platform() === 'darwin') {
      const script = `
        tell application "${name}"
          activate
        end tell
      `;
      await this.runAppleScript(script);
    } else if (os.platform() === 'win32') {
      await this.runCommand(`powershell -Command "(Get-Process -Name '${name}').MainWindowHandle | ForEach-Object { [System.Windows.Forms.NativeWindow]::new($_).Activate() }"`);
    } else {
      if (windowId) {
        await this.runCommand(`xdotool windowactivate ${windowId}`);
      }
    }

    return { success: true };
  }

  async download(params) {
    const { url, filename, directory } = params;
    const destDir = directory || this.downloadDir;
    const destFile = filename || path.basename(new URL(url).pathname);
    const destPath = path.join(destDir, destFile);

    await fs.ensureDir(destDir);

    this.logger.info(`Downloading: ${url} -> ${destPath}`);

    if (os.platform() === 'darwin') {
      await this.runCommand(`curl -L -o "${destPath}" "${url}"`);
    } else {
      await this.runCommand(`curl -L -o "${destPath}" "${url}"`);
    }

    const stats = await fs.stat(destPath);
    return {
      success: true,
      filepath: destPath,
      filename: destFile,
      size: stats.size
    };
  }

  async findElement(params) {
    const { selector, text, image, timeout = 5000 } = params;

    if (image) {
      const screenshot = await this.screenshot();
      return { found: true, screenshot: screenshot.filepath, confidence: 0.95 };
    }

    return { found: false, message: 'Element detection requires vision model' };
  }

  async readScreen(params) {
    const { region, analyze = true } = params;
    const screenshot = await this.screenshot({ region });

    if (analyze) {
      const imageData = await fs.readFile(screenshot.filepath, 'base64');
      return {
        screenshot: screenshot.filepath,
        data: imageData,
        analysis: 'Use AI vision to analyze this screenshot'
      };
    }

    return { screenshot: screenshot.filepath };
  }

  async ocr(params) {
    const { image, language = 'eng' } = params;

    if (!this.capabilities.canOCR) {
      throw new Error('OCR requires tesseract to be installed');
    }

    const imagePath = image.filepath || image;
    const output = await this.runCommand(`tesseract "${imagePath}" stdout -l ${language}`);
    return { text: output.trim(), language };
  }

  async createWebhook(params) {
    const { url, events, secret } = params;
    const id = uuidv4();

    this.webhooks.set(id, {
      id,
      url,
      events,
      secret,
      active: true,
      createdAt: new Date()
    });

    return { id, url, events };
  }

  async getWebhooks() {
    return Array.from(this.webhooks.values());
  }

  async deleteWebhook(id) {
    return this.webhooks.delete(id);
  }

  startRecording() {
    this.recording = true;
    this.recordedActions = [];
    this.logger.info('Recording started');
  }

  stopRecording() {
    this.recording = false;
    const actions = [...this.recordedActions];
    this.recordedActions = [];
    this.logger.info(`Recording stopped: ${actions.length} actions`);
    return actions;
  }

  async replayActions(actions, speed = 1) {
    for (const action of actions) {
      switch (action.type) {
        case 'click':
          await this.click(action);
          break;
        case 'type':
          await this.type(action);
          break;
        case 'keyPress':
          await this.keyPress(action);
          break;
        case 'move':
          await this.moveMouse(action);
          break;
      }
      if (speed > 0) {
        await this.sleep(100 / speed);
      }
    }
  }

  async runCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async runAppleScript(script) {
    const tempFile = path.join(os.tmpdir(), `pix-script-${uuidv4()}.scpt`);
    await fs.writeFile(tempFile, script);
    try {
      const output = await this.runCommand(`osascript "${tempFile}"`);
      return output;
    } finally {
      await fs.remove(tempFile).catch(() => {});
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AutomationEngine;
