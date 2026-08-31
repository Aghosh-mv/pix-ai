const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class Logger {
  constructor(module) {
    this.module = module;
    this.logDir = path.join(os.homedir(), '.pix/logs');
    this.ensureLogDir();
  }

  async ensureLogDir() {
    await fs.ensureDir(this.logDir);
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, ...args) {
    const timestamp = this.getTimestamp();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.module}]`;
    return `${prefix} ${message}`;
  }

  info(message, ...args) {
    const formatted = this.formatMessage('info', message, ...args);
    console.log('\x1b[36m%s\x1b[0m', formatted);
    this.writeLog('info', message, args);
  }

  warn(message, ...args) {
    const formatted = this.formatMessage('warn', message, ...args);
    console.log('\x1b[33m%s\x1b[0m', formatted);
    this.writeLog('warn', message, args);
  }

  error(message, ...args) {
    const formatted = this.formatMessage('error', message, ...args);
    console.error('\x1b[31m%s\x1b[0m', formatted);
    this.writeLog('error', message, args);
  }

  debug(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage('debug', message, ...args);
      console.log('\x1b[90m%s\x1b[0m', formatted);
    }
    this.writeLog('debug', message, args);
  }

  async writeLog(level, message, args) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `${date}.log`);
      const timestamp = this.getTimestamp();
      const argsStr = args.length > 0 ? ' ' + JSON.stringify(args) : '';
      const logEntry = `[${timestamp}] [${level.toUpperCase()}] [${this.module}] ${message}${argsStr}\n`;

      await fs.appendFile(logFile, logEntry);
    } catch (e) {}
  }
}

module.exports = Logger;
