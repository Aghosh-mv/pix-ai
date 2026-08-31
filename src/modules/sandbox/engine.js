const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const treeKill = require('tree-kill');

class SandboxEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sandboxes = new Map();
    this.baseDir = path.join(os.homedir(), '.pix/sandboxes');
    this.tempDir = path.join(os.tmpdir(), 'pix-sandbox');
    this.eventEmitter = new EventEmitter();
  }

  async initialize() {
    this.logger.info('Initializing Sandbox Engine...');
    await fs.ensureDir(this.baseDir);
    await fs.ensureDir(this.tempDir);
    this.logger.info('Sandbox Engine initialized');
  }

  async create(params) {
    const {
      name = `sandbox-${Date.now()}`,
      language = 'javascript',
      template = null,
      packages = [],
      env = {},
      timeout = 300000,
      memoryLimit = 512 * 1024 * 1024,
      cpuLimit = 1,
      networkAccess = false,
      filesystemAccess = 'read-write'
    } = params;

    const id = uuidv4();
    const sandboxDir = path.join(this.baseDir, id);

    this.logger.info(`Creating sandbox: ${name} (${language})`);

    await fs.ensureDir(sandboxDir);
    await fs.ensureDir(path.join(sandboxDir, 'workspace'));
    await fs.ensureDir(path.join(sandboxDir, 'temp'));
    await fs.ensureDir(path.join(sandboxDir, 'logs'));

    const config = {
      id,
      name,
      language,
      template,
      packages,
      env,
      timeout,
      memoryLimit,
      cpuLimit,
      networkAccess,
      filesystemAccess,
      createdAt: new Date(),
      status: 'created',
      pid: null
    };

    await fs.writeFile(
      path.join(sandboxDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    const packageJson = this.getPackageJson(language, packages);
    await fs.writeFile(
      path.join(sandboxDir, 'workspace/package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    if (template) {
      await this.applyTemplate(sandboxDir, template, language);
    }

    if (packages.length > 0) {
      await this.installPackages(id, packages);
    }

    this.sandboxes.set(id, {
      ...config,
      dir: sandboxDir,
      processes: []
    });

    this.logger.info(`Sandbox created: ${id}`);
    return { id, name, language, dir: sandboxDir };
  }

  async execute(params) {
    const { sandboxId, code, language, file, args = [], env = {}, timeout = 60000 } = params;

    let sandbox;
    if (sandboxId) {
      sandbox = this.sandboxes.get(sandboxId);
      if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);
    }

    const execId = uuidv4();
    const workDir = sandbox ? path.join(sandbox.dir, 'workspace') : this.tempDir;

    this.logger.info(`Executing code in sandbox: ${sandboxId || 'temp'}`);

    await fs.ensureDir(workDir);

    let command;
    let execFile;

    switch (language) {
      case 'javascript':
      case 'js':
        execFile = file || path.join(workDir, `exec-${execId}.js`);
        await fs.writeFile(execFile, code);
        command = `node "${execFile}"`;
        break;

      case 'typescript':
      case 'ts':
        execFile = file || path.join(workDir, `exec-${execId}.ts`);
        await fs.writeFile(execFile, code);
        command = `npx ts-node "${execFile}"`;
        break;

      case 'python':
      case 'py':
        execFile = file || path.join(workDir, `exec-${execId}.py`);
        await fs.writeFile(execFile, code);
        command = `python3 "${execFile}"`;
        break;

      case 'ruby':
      case 'rb':
        execFile = file || path.join(workDir, `exec-${execId}.rb`);
        await fs.writeFile(execFile, code);
        command = `ruby "${execFile}"`;
        break;

      case 'go':
        execFile = file || path.join(workDir, `exec-${execId}.go`);
        await fs.writeFile(execFile, code);
        command = `go run "${execFile}"`;
        break;

      case 'rust':
        execFile = file || path.join(workDir, `exec-${execId}.rs`);
        await fs.writeFile(execFile, code);
        const rsFile = path.join(workDir, `exec-${execId}`);
        await this.compileRust(execFile, rsFile);
        command = rsFile;
        break;

      case 'bash':
      case 'sh':
        execFile = file || path.join(workDir, `exec-${execId}.sh`);
        await fs.writeFile(execFile, code);
        await fs.chmod(execFile, '755');
        command = `bash "${execFile}"`;
        break;

      case 'html':
        execFile = file || path.join(workDir, `exec-${execId}.html`);
        await fs.writeFile(execFile, code);
        command = `open "${execFile}"`;
        break;

      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    if (args.length > 0) {
      command += ` ${args.map(a => `"${a}"`).join(' ')}`;
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let killed = false;

      const proc = spawn(command, [], {
        cwd: workDir,
        shell: true,
        env: {
          ...process.env,
          ...env,
          PIX_SANDBOX_ID: sandboxId || 'temp',
          PIX_EXEC_ID: execId
        },
        timeout
      });

      if (sandbox) {
        sandbox.processes.push(proc.pid);
      }

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        this.eventEmitter.emit('output', {
          sandboxId,
          execId,
          type: 'stdout',
          data: data.toString()
        });
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        this.eventEmitter.emit('output', {
          sandboxId,
          execId,
          type: 'stderr',
          data: data.toString()
        });
      });

      proc.on('close', (exitCode) => {
        const duration = Date.now() - startTime;
        if (sandbox) {
          sandbox.processes = sandbox.processes.filter(p => p !== proc.pid);
        }

        if (killed) {
          resolve({
            execId,
            exitCode: -1,
            stdout,
            stderr: stderr || 'Process killed due to timeout',
            duration,
            timedOut: true
          });
        } else {
          resolve({
            execId,
            exitCode,
            stdout,
            stderr,
            duration,
            timedOut: false
          });
        }
      });

      proc.on('error', (error) => {
        reject({
          execId,
          error: error.message,
          stderr,
          duration: Date.now() - startTime
        });
      });

      setTimeout(() => {
        if (proc.pid && !proc.killed) {
          killed = true;
          treeKill(proc.pid, 'SIGTERM');
          setTimeout(() => {
            if (!proc.killed) {
              treeKill(proc.pid, 'SIGKILL');
            }
          }, 5000);
        }
      }, timeout);
    });
  }

  async compileRust(sourceFile, outputFile) {
    await new Promise((resolve, reject) => {
      exec(`rustc "${sourceFile}" -o "${outputFile}"`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async destroy(params) {
    const { sandboxId } = params;
    const sandbox = this.sandboxes.get(sandboxId);

    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    this.logger.info(`Destroying sandbox: ${sandboxId}`);

    for (const pid of sandbox.processes) {
      try {
        treeKill(pid, 'SIGKILL');
      } catch (e) {}
    }

    await fs.remove(sandbox.dir).catch(() => {});
    this.sandboxes.delete(sandboxId);

    return { success: true };
  }

  async list() {
    return Array.from(this.sandboxes.values()).map(s => ({
      id: s.id,
      name: s.name,
      language: s.language,
      status: s.status,
      createdAt: s.createdAt,
      processes: s.processes.length
    }));
  }

  async status(params) {
    const { sandboxId } = params;
    const sandbox = this.sandboxes.get(sandboxId);

    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    let diskUsage = 0;
    try {
      const output = await new Promise((resolve, reject) => {
        exec(`du -sh "${sandbox.dir}"`, (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
      const match = output.match(/^(\d+(?:\.\d+)?[kmgt]?)\s/i);
      diskUsage = match ? match[1] : '0';
    } catch (e) {}

    return {
      id: sandbox.id,
      name: sandbox.name,
      language: sandbox.language,
      status: sandbox.status,
      processes: sandbox.processes.length,
      diskUsage,
      createdAt: sandbox.createdAt
    };
  }

  async installPackage(params) {
    const { sandboxId, packages } = params;
    const sandbox = this.sandboxes.get(sandboxId);

    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    return this.installPackages(sandboxId, Array.isArray(packages) ? packages : [packages]);
  }

  async installPackages(sandboxId, packages) {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const workDir = path.join(sandbox.dir, 'workspace');

    this.logger.info(`Installing packages in sandbox ${sandboxId}: ${packages.join(', ')}`);

    let command;
    switch (sandbox.language) {
      case 'javascript':
      case 'typescript':
        command = `npm install ${packages.join(' ')}`;
        break;
      case 'python':
        command = `pip3 install ${packages.join(' ')}`;
        break;
      case 'ruby':
        command = `gem install ${packages.join(' ')}`;
        break;
      case 'go':
        command = `go get ${packages.join(' ')}`;
        break;
      case 'rust':
        command = `cargo add ${packages.join(' ')}`;
        break;
      default:
        throw new Error(`Package installation not supported for ${sandbox.language}`);
    }

    return new Promise((resolve, reject) => {
      exec(command, { cwd: workDir, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject({ error: error.message, stderr });
        } else {
          sandbox.packages = [...new Set([...sandbox.packages, ...packages])];
          resolve({ success: true, output: stdout });
        }
      });
    });
  }

  async fileSystemOp(params) {
    const { sandboxId, operation, path: filePath, content, options = {} } = params;
    const sandbox = this.sandboxes.get(sandboxId);

    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const fullPath = path.join(sandbox.dir, 'workspace', filePath || '');

    switch (operation) {
      case 'read':
        return await fs.readFile(fullPath, options.encoding || 'utf8');

      case 'write':
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content);
        return { success: true, path: filePath };

      case 'append':
        await fs.appendFile(fullPath, content);
        return { success: true };

      case 'delete':
        await fs.remove(fullPath);
        return { success: true };

      case 'exists':
        return await fs.pathExists(fullPath);

      case 'list':
        const items = await fs.readdir(fullPath, { withFileTypes: true });
        return items.map(item => ({
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          path: path.join(filePath || '', item.name)
        }));

      case 'stat':
        return await fs.stat(fullPath);

      case 'mkdir':
        await fs.ensureDir(fullPath);
        return { success: true };

      case 'move':
        await fs.move(fullPath, path.join(sandbox.dir, 'workspace', options.destination));
        return { success: true };

      case 'copy':
        await fs.copy(fullPath, path.join(sandbox.dir, 'workspace', options.destination));
        return { success: true };

      case 'search':
        const results = [];
        const walkDir = async (dir) => {
          const items = await fs.readdir(dir, { withFileTypes: true });
          for (const item of items) {
            const itemPath = path.join(dir, item.name);
            if (item.isDirectory()) {
              await walkDir(itemPath);
            } else if (item.name.includes(options.pattern || '')) {
              results.push({
                path: path.relative(path.join(sandbox.dir, 'workspace'), itemPath),
                name: item.name
              });
            }
          }
        };
        await walkDir(fullPath);
        return results;

      default:
        throw new Error(`Unknown filesystem operation: ${operation}`);
    }
  }

  getPackageJson(language, packages) {
    const base = {
      name: 'pix-sandbox-workspace',
      version: '1.0.0',
      private: true,
      description: 'Pix AI Harness Sandbox Workspace'
    };

    if (language === 'javascript' || language === 'typescript') {
      return {
        ...base,
        dependencies: {},
        devDependencies: {}
      };
    }

    return base;
  }

  async applyTemplate(sandboxDir, template, language) {
    const templates = {
      'express': {
        'app.js': `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Pix Sandbox - Express Template' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`
      },
      'react': {
        'src/App.jsx': `import React from 'react';

function App() {
  return (
    <div>
      <h1>Pix Sandbox - React Template</h1>
    </div>
  );
}

export default App;`
      },
      'flask': {
        'app.py': `from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return jsonify({'message': 'Pix Sandbox - Flask Template'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)`
      },
      'fastapi': {
        'main.py': `from fastapi import FastAPI

app = FastAPI()

@app.get('/')
def read_root():
    return {'message': 'Pix Sandbox - FastAPI Template'}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)`
      },
      'node-ts': {
        'src/index.ts': `import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Pix Sandbox - TypeScript Template' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`
      }
    };

    const templateFiles = templates[template];
    if (templateFiles) {
      for (const [file, content] of Object.entries(templateFiles)) {
        const filePath = path.join(sandboxDir, 'workspace', file);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content);
      }
    }
  }

  async cleanup() {
    this.logger.info('Cleaning up all sandboxes...');

    for (const [id, sandbox] of this.sandboxes) {
      for (const pid of sandbox.processes) {
        try {
          treeKill(pid, 'SIGKILL');
        } catch (e) {}
      }
      await fs.remove(sandbox.dir).catch(() => {});
    }

    this.sandboxes.clear();
    await fs.remove(this.tempDir).catch(() => {});

    this.logger.info('Sandbox cleanup complete');
  }
}

module.exports = SandboxEngine;
