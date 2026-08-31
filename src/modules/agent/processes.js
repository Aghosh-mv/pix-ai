const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn, exec, execSync } = require('child_process');

class ProcessManagerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.processes = new Map();
    this.processGroups = new Map();
    this.processDir = path.join(os.homedir(), '.pix/processes');
    this.monitoring = new Map();
  }

  async initialize() {
    this.logger.info('Initializing Process Manager Engine...');
    await fs.ensureDir(this.processDir);
    await this.loadProcesses();
    this.loadTemplates();
    this.logger.info('Process Manager Engine initialized');
  }

  async loadProcesses() {
    try {
      const files = await fs.readdir(this.processDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.processDir, file));
          if (data.type === 'process') this.processes.set(data.id, data);
          else if (data.type === 'group') this.processGroups.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadTemplates() {
    this.templates = [
      { id: 'webserver', name: 'Web Server', icon: '🌐', command: 'npm start', description: 'Start web server' },
      { id: 'devserver', name: 'Dev Server', icon: '🔥', command: 'npm run dev', description: 'Start development server' },
      { id: 'build', name: 'Build', icon: '📦', command: 'npm run build', description: 'Build project' },
      { id: 'test', name: 'Test', icon: '🧪', command: 'npm test', description: 'Run tests' },
      { id: 'lint', name: 'Lint', icon: '🔍', command: 'npm run lint', description: 'Run linter' },
      { id: 'docker', name: 'Docker', icon: '🐳', command: 'docker-compose up', description: 'Start Docker containers' },
      { id: 'database', name: 'Database', icon: '🗄️', command: 'mongod', description: 'Start database server' },
      { id: 'worker', name: 'Worker', icon: '⚙️', command: 'npm run worker', description: 'Start background worker' },
      { id: 'scheduler', name: 'Scheduler', icon: '📅', command: 'npm run scheduler', description: 'Start task scheduler' },
      { id: 'monitor', name: 'Monitor', icon: '📊', command: 'npm run monitor', description: 'Start monitoring service' }
    ];
  }

  async spawnProcess(params) {
    const {
      name,
      command,
      args = [],
      cwd = os.homedir(),
      env = {},
      shell = true,
      detached = false,
      stdio = 'pipe',
      timeout = null,
      maxBuffer = 1024 * 1024 * 10,
      gid = null,
      uid = null,
      group = null,
      tags = [],
      description = '',
      restartOnCrash = false,
      maxRestarts = 3
    } = params;

    const id = uuidv4();

    const processInfo = {
      id,
      name: name || `Process ${id.slice(0, 8)}`,
      command,
      args,
      cwd,
      env: { ...process.env, ...env },
      shell,
      detached,
      stdio,
      timeout,
      maxBuffer,
      gid,
      uid,
      group,
      tags,
      description,
      restartOnCrash,
      maxRestarts,
      status: 'starting',
      pid: null,
      exitCode: null,
      signal: null,
      output: [],
      error: [],
      startTime: null,
      endTime: null,
      restarts: 0,
      cpu: 0,
      memory: 0,
      type: 'process',
      createdAt: new Date().toISOString()
    };

    this.processes.set(id, processInfo);
    await this.saveProcess(processInfo);

    try {
      const child = spawn(command, args, {
        cwd,
        env: processInfo.env,
        shell,
        detached,
        stdio: stdio === 'inherit' ? 'inherit' : 'pipe',
        gid: gid || undefined,
        uid: uid || undefined
      });

      processInfo.pid = child.pid;
      processInfo.status = 'running';
      processInfo.startTime = new Date().toISOString();
      processInfo.child = child;

      if (stdio === 'pipe') {
        child.stdout.on('data', (data) => {
          const output = data.toString();
          processInfo.output.push({
            type: 'stdout',
            data: output,
            timestamp: new Date().toISOString()
          });

          if (processInfo.output.length > 1000) {
            processInfo.output = processInfo.output.slice(-500);
          }
        });

        child.stderr.on('data', (data) => {
          const error = data.toString();
          processInfo.error.push({
            type: 'stderr',
            data: error,
            timestamp: new Date().toISOString()
          });

          if (processInfo.error.length > 1000) {
            processInfo.error = processInfo.error.slice(-500);
          }
        });
      }

      child.on('exit', (code, signal) => {
        processInfo.status = 'stopped';
        processInfo.exitCode = code;
        processInfo.signal = signal;
        processInfo.endTime = new Date().toISOString();
        processInfo.child = null;

        this.processes.set(id, processInfo);
        this.saveProcess(processInfo);

        if (processInfo.restartOnCrash && code !== 0 && processInfo.restarts < processInfo.maxRestarts) {
          processInfo.restarts++;
          processInfo.status = 'restarting';
          this.processes.set(id, processInfo);

          setTimeout(() => {
            this.spawnProcess(params);
          }, 1000 * processInfo.restarts);
        }
      });

      child.on('error', (err) => {
        processInfo.status = 'error';
        processInfo.error.push({
          type: 'error',
          data: err.message,
          timestamp: new Date().toISOString()
        });

        this.processes.set(id, processInfo);
        this.saveProcess(processInfo);
      });

      if (timeout) {
        setTimeout(() => {
          if (processInfo.status === 'running') {
            this.killProcess(id, 'SIGTERM');
          }
        }, timeout);
      }

      this.processes.set(id, processInfo);
      return processInfo;
    } catch (error) {
      processInfo.status = 'error';
      processInfo.error.push({
        type: 'error',
        data: error.message,
        timestamp: new Date().toISOString()
      });

      this.processes.set(id, processInfo);
      await this.saveProcess(processInfo);
      throw error;
    }
  }

  async killProcess(id, signal = 'SIGTERM') {
    const processInfo = this.processes.get(id);
    if (!processInfo) throw new Error(`Process not found: ${id}`);

    if (processInfo.child) {
      processInfo.child.kill(signal);
    } else if (processInfo.pid) {
      try {
        process.kill(processInfo.pid, signal);
      } catch (e) {}
    }

    processInfo.status = 'killed';
    processInfo.endTime = new Date().toISOString();
    this.processes.set(id, processInfo);
    await this.saveProcess(processInfo);

    return processInfo;
  }

  async pauseProcess(id) {
    const processInfo = this.processes.get(id);
    if (!processInfo) throw new Error(`Process not found: ${id}`);

    if (processInfo.child) {
      processInfo.child.kill('SIGSTOP');
    }

    processInfo.status = 'paused';
    this.processes.set(id, processInfo);
    await this.saveProcess(processInfo);

    return processInfo;
  }

  async resumeProcess(id) {
    const processInfo = this.processes.get(id);
    if (!processInfo) throw new Error(`Process not found: ${id}`);

    if (processInfo.child) {
      processInfo.child.kill('SIGCONT');
    }

    processInfo.status = 'running';
    this.processes.set(id, processInfo);
    await this.saveProcess(processInfo);

    return processInfo;
  }

  async restartProcess(id) {
    const processInfo = this.processes.get(id);
    if (!processInfo) throw new Error(`Process not found: ${id}`);

    await this.killProcess(id, 'SIGTERM');

    await new Promise(resolve => setTimeout(resolve, 1000));

    const newProcess = await this.spawnProcess({
      name: processInfo.name,
      command: processInfo.command,
      args: processInfo.args,
      cwd: processInfo.cwd,
      env: processInfo.env,
      shell: processInfo.shell,
      detached: processInfo.detached,
      stdio: processInfo.stdio,
      timeout: processInfo.timeout,
      maxBuffer: processInfo.maxBuffer,
      group: processInfo.group,
      tags: processInfo.tags,
      description: processInfo.description,
      restartOnCrash: processInfo.restartOnCrash,
      maxRestarts: processInfo.maxRestarts
    });

    this.processes.delete(id);

    return newProcess;
  }

  async getProcess(id) {
    const processInfo = this.processes.get(id);
    if (!processInfo) throw new Error(`Process not found: ${id}`);

    if (processInfo.pid && processInfo.status === 'running') {
      try {
        const processInfo2 = process.kill ? process : null;
        if (processInfo2) {
          processInfo.status = 'running';
        }
      } catch (e) {
        processInfo.status = 'zombie';
      }
    }

    return processInfo;
  }

  listProcesses(options = {}) {
    const { status, group, search } = options;
    let processes = Array.from(this.processes.values());

    if (status) processes = processes.filter(p => p.status === status);
    if (group) processes = processes.filter(p => p.group === group);
    if (search) {
      const searchLower = search.toLowerCase();
      processes = processes.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.command.toLowerCase().includes(searchLower)
      );
    }

    return processes;
  }

  async getProcessOutput(id, options = {}) {
    const { type = 'all', limit = 100 } = options;
    const processInfo = this.processes.get(id);
    if (!processInfo) throw new Error(`Process not found: ${id}`);

    let output = [];

    if (type === 'stdout' || type === 'all') {
      output = [...output, ...processInfo.output];
    }
    if (type === 'stderr' || type === 'all') {
      output = [...output, ...processInfo.error];
    }

    return output
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-limit);
  }

  async clearProcessOutput(id) {
    const processInfo = this.processes.get(id);
    if (!processInfo) throw new Error(`Process not found: ${id}`);

    processInfo.output = [];
    processInfo.error = [];
    this.processes.set(id, processInfo);

    return { success: true };
  }

  async createGroup(params) {
    const { name, description = '', processes = [], tags = [] } = params;

    const id = uuidv4();
    const group = {
      id,
      name,
      description,
      processes,
      tags,
      status: 'active',
      type: 'group',
      createdAt: new Date().toISOString()
    };

    this.processGroups.set(id, group);
    await this.saveGroup(group);

    return group;
  }

  async addToGroup(groupId, processId) {
    const group = this.processGroups.get(groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);

    const processInfo = this.processes.get(processId);
    if (!processInfo) throw new Error(`Process not found: ${processId}`);

    if (!group.processes.includes(processId)) {
      group.processes.push(processId);
      processInfo.group = groupId;

      this.processGroups.set(groupId, group);
      this.processes.set(processId, processInfo);

      await this.saveGroup(group);
      await this.saveProcess(processInfo);
    }

    return group;
  }

  async removeFromGroup(groupId, processId) {
    const group = this.processGroups.get(groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);

    group.processes = group.processes.filter(p => p !== processId);

    const processInfo = this.processes.get(processId);
    if (processInfo) {
      processInfo.group = null;
      this.processes.set(processId, processInfo);
      await this.saveProcess(processInfo);
    }

    this.processGroups.set(groupId, group);
    await this.saveGroup(group);

    return group;
  }

  async startGroup(groupId) {
    const group = this.processGroups.get(groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);

    const results = [];

    for (const processId of group.processes) {
      try {
        await this.resumeProcess(processId);
        results.push({ processId, success: true });
      } catch (error) {
        results.push({ processId, success: false, error: error.message });
      }
    }

    group.status = 'running';
    this.processGroups.set(groupId, group);
    await this.saveGroup(group);

    return { group, results };
  }

  async stopGroup(groupId) {
    const group = this.processGroups.get(groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);

    const results = [];

    for (const processId of group.processes) {
      try {
        await this.killProcess(processId, 'SIGTERM');
        results.push({ processId, success: true });
      } catch (error) {
        results.push({ processId, success: false, error: error.message });
      }
    }

    group.status = 'stopped';
    this.processGroups.set(groupId, group);
    await this.saveGroup(group);

    return { group, results };
  }

  async deleteGroup(groupId) {
    const group = this.processGroups.get(groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);

    for (const processId of group.processes) {
      const processInfo = this.processes.get(processId);
      if (processInfo) {
        processInfo.group = null;
        this.processes.set(processId, processInfo);
      }
    }

    this.processGroups.delete(groupId);
    await fs.remove(path.join(this.processDir, `group-${groupId}.json`)).catch(() => {});

    return { success: true };
  }

  async monitorProcess(id, options = {}) {
    const { interval = 5000, duration = 60000 } = options;
    const processInfo = this.processes.get(id);
    if (!processInfo) throw new Error(`Process not found: ${id}`);

    const monitorId = uuidv4();
    const startTime = Date.now();
    const samples = [];

    const monitor = setInterval(() => {
      if (Date.now() - startTime > duration) {
        clearInterval(monitor);
        this.monitoring.delete(monitorId);
        return;
      }

      const sample = {
        timestamp: new Date().toISOString(),
        cpu: Math.random() * 100,
        memory: processInfo.memory + Math.random() * 10,
        output: processInfo.output.length,
        errors: processInfo.error.length
      };

      samples.push(sample);
    }, interval);

    this.monitoring.set(monitorId, { id: monitorId, processId: id, monitor, samples });

    return { monitorId, samples };
  }

  async getSystemProcesses() {
    try {
      const output = execSync('ps aux --sort=-%cpu | head -20').toString();
      const lines = output.split('\n').filter(l => l.trim());

      return lines.slice(1).map(line => {
        const parts = line.split(/\s+/);
        return {
          user: parts[0],
          pid: parseInt(parts[1]),
          cpu: parseFloat(parts[2]),
          memory: parseFloat(parts[3]),
          vsz: parseInt(parts[4]),
          rss: parseInt(parts[5]),
          command: parts.slice(10).join(' ')
        };
      });
    } catch (e) {
      return [];
    }
  }

  async getTemplates() {
    return this.templates;
  }

  async getStats() {
    const processes = Array.from(this.processes.values());
    const groups = Array.from(this.processGroups.values());

    return {
      processes: processes.length,
      running: processes.filter(p => p.status === 'running').length,
      stopped: processes.filter(p => p.status === 'stopped').length,
      paused: processes.filter(p => p.status === 'paused').length,
      error: processes.filter(p => p.status === 'error').length,
      groups: groups.length,
      monitoring: this.monitoring.size
    };
  }

  async saveProcess(process) {
    const filePath = path.join(this.processDir, `${process.id}.json`);
    const saveData = { ...process };
    delete saveData.child;
    await fs.writeJson(filePath, saveData, { spaces: 2 });
  }

  async saveGroup(group) {
    const filePath = path.join(this.processDir, `group-${group.id}.json`);
    await fs.writeJson(filePath, group, { spaces: 2 });
  }

  async exportProcesses(format = 'json') {
    const data = {
      processes: Array.from(this.processes.values()).map(p => {
        const saveData = { ...p };
        delete saveData.child;
        return saveData;
      }),
      groups: Array.from(this.processGroups.values()),
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = ProcessManagerEngine;
