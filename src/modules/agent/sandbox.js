const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn, exec, execSync } = require('child_process');

class SandboxEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.instances = new Map();
    this.executions = new Map();
    this.sandboxDir = path.join(os.homedir(), '.pix/sandbox');
    this.templates = new Map();
    this.loadTemplates();
  }

  async initialize() {
    this.logger.info('Initializing Sandbox Engine...');
    await fs.ensureDir(this.sandboxDir);
    await this.loadInstances();
    this.logger.info('Sandbox Engine initialized');
  }

  async loadInstances() {
    try {
      const files = await fs.readdir(this.sandboxDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.sandboxDir, file));
          if (data.type === 'instance') this.instances.set(data.id, data);
          else if (data.type === 'execution') this.executions.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadTemplates() {
    const langs = [
      { id: 'javascript', name: 'JavaScript', icon: '📜', ext: '.js', template: '// JavaScript Sandbox\nconsole.log("Hello from JavaScript!");\n', run: 'node {file}' },
      { id: 'python', name: 'Python', icon: '🐍', ext: '.py', template: '# Python Sandbox\nprint("Hello from Python!")\n', run: 'python3 {file}' },
      { id: 'typescript', name: 'TypeScript', icon: '🔷', ext: '.ts', template: '// TypeScript Sandbox\nconst msg: string = "Hello from TypeScript!";\nconsole.log(msg);\n', run: 'npx ts-node {file}' },
      { id: 'bash', name: 'Bash', icon: '🐚', ext: '.sh', template: '#!/bin/bash\necho "Hello from Bash!"\n', run: 'bash {file}' },
      { id: 'ruby', name: 'Ruby', icon: '💎', ext: '.rb', template: '# Ruby Sandbox\nputs "Hello from Ruby!"\n', run: 'ruby {file}' },
      { id: 'go', name: 'Go', icon: '🔵', ext: '.go', template: 'package main\nimport "fmt"\nfunc main() {\n\tfmt.Println("Hello from Go!")\n}\n', run: 'go run {file}' },
      { id: 'rust', name: 'Rust', icon: '🦀', ext: '.rs', template: 'fn main() {\n\tprintln!("Hello from Rust!");\n}\n', run: 'rustc {file} -o {output} && {output}' },
      { id: 'java', name: 'Java', icon: '☕', ext: '.java', template: 'public class Main {\n\tpublic static void main(String[] args) {\n\t\tSystem.out.println("Hello from Java!");\n\t}\n}\n', run: 'javac {file} -d {outdir} && java -cp {outdir} Main' },
      { id: 'c', name: 'C', icon: '🔧', ext: '.c', template: '#include <stdio.h>\nint main() {\n\tprintf("Hello from C!\\n");\n\treturn 0;\n}\n', run: 'gcc {file} -o {output} && {output}' },
      { id: 'cpp', name: 'C++', icon: '⚙️', ext: '.cpp', template: '#include <iostream>\nint main() {\n\tstd::cout << "Hello from C++!" << std::endl;\n\treturn 0;\n}\n', run: 'g++ {file} -o {output} && {output}' },
      { id: 'php', name: 'PHP', icon: '🐘', ext: '.php', template: '<?php\necho "Hello from PHP!";\n', run: 'php {file}' },
      { id: 'perl', name: 'Perl', icon: '🐪', ext: '.pl', template: '#!/usr/bin/perl\nprint "Hello from Perl!\\n";\n', run: 'perl {file}' },
      { id: 'r', name: 'R', icon: '📊', ext: '.R', template: 'cat("Hello from R!\\n")\n', run: 'Rscript {file}' },
      { id: 'swift', name: 'Swift', icon: '🦅', ext: '.swift', template: 'print("Hello from Swift!")\n', run: 'swift {file}' },
      { id: 'kotlin', name: 'Kotlin', icon: '🇰', ext: '.kt', template: 'fun main() {\n\tprintln("Hello from Kotlin!")\n}\n', run: 'kotlinc {file} -include-runtime -d {output}.jar && java -jar {output}.jar' },
      { id: 'scala', name: 'Scala', icon: '🔴', ext: '.scala', template: 'object Main extends App {\n\tprintln("Hello from Scala!")\n}\n', run: 'scala {file}' },
      { id: 'lua', name: 'Lua', icon: '🌙', ext: '.lua', template: 'print("Hello from Lua!")\n', run: 'lua {file}' },
      { id: 'haskell', name: 'Haskell', icon: 'λ', ext: '.hs', template: 'main :: IO ()\nmain = putStrLn "Hello from Haskell!"\n', run: 'runhaskell {file}' },
      { id: 'elixir', name: 'Elixir', icon: '💧', ext: '.exs', template: 'IO.puts("Hello from Elixir!")\n', run: 'elixir {file}' },
      { id: 'powershell', name: 'PowerShell', icon: '🔷', ext: '.ps1', template: 'Write-Host "Hello from PowerShell!"\n', run: 'pwsh {file}' }
    ];

    langs.forEach(lang => {
      this.templates.set(lang.id, { ...lang, type: 'template' });
    });
  }

  async createInstance(params) {
    const {
      name,
      language = 'javascript',
      description = '',
      memoryLimit = 256,
      cpuLimit = 50,
      timeout = 30000,
      networkEnabled = false,
      env = {}
    } = params;

    const id = uuidv4();
    const instanceDir = path.join(this.sandboxDir, id);

    await fs.ensureDir(instanceDir);
    await fs.ensureDir(path.join(instanceDir, 'src'));
    await fs.ensureDir(path.join(instanceDir, 'output'));
    await fs.ensureDir(path.join(instanceDir, 'temp'));

    const template = this.templates.get(language);
    if (!template) throw new Error(`Language not supported: ${language}`);

    const mainFile = path.join(instanceDir, 'src', `main${template.ext}`);
    await fs.writeFile(mainFile, template.template);

    const instance = {
      id,
      name: name || `Sandbox ${id.slice(0, 8)}`,
      language,
      description,
      memoryLimit,
      cpuLimit,
      timeout,
      networkEnabled,
      env,
      directory: instanceDir,
      mainFile,
      status: 'ready',
      executions: 0,
      lastExecuted: null,
      files: ['src/main' + template.ext],
      type: 'instance',
      createdAt: new Date().toISOString()
    };

    this.instances.set(id, instance);
    await this.saveInstance(instance);
    return instance;
  }

  async deleteInstance(id) {
    const instance = this.instances.get(id);
    if (!instance) throw new Error(`Instance not found: ${id}`);

    await fs.remove(instance.directory).catch(() => {});
    this.instances.delete(id);
    return { success: true };
  }

  async getInstance(id) {
    return this.instances.get(id);
  }

  listInstances() {
    return Array.from(this.instances.values());
  }

  async writeFile(instanceId, filePath, content) {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error(`Instance not found: ${instanceId}`);

    const fullPath = path.join(instance.directory, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);

    if (!instance.files.includes(filePath)) {
      instance.files.push(filePath);
      this.instances.set(instanceId, instance);
    }

    return { success: true, path: fullPath };
  }

  async readFile(instanceId, filePath) {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error(`Instance not found: ${instanceId}`);

    const fullPath = path.join(instance.directory, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async listFiles(instanceId, dir = '') {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error(`Instance not found: ${instanceId}`);

    const fullPath = path.join(instance.directory, dir);
    const items = await fs.readdir(fullPath);

    return items.map(item => ({
      name: item,
      path: dir ? `${dir}/${item}` : item,
      isDirectory: fs.statSync(path.join(fullPath, item)).isDirectory()
    }));
  }

  async execute(instanceId, params = {}) {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error(`Instance not found: ${instanceId}`);

    const template = this.templates.get(instance.language);
    if (!template) throw new Error(`Language not supported: ${instance.language}`);

    const executionId = uuidv4();
    const startTime = Date.now();

    const execution = {
      id: executionId,
      instanceId,
      status: 'running',
      input: params.input || '',
      output: '',
      error: '',
      exitCode: null,
      duration: 0,
      type: 'execution',
      startedAt: new Date().toISOString()
    };

    this.executions.set(executionId, execution);

    try {
      const result = await this.runCode(instance, template, params);

      execution.status = 'completed';
      execution.output = result.stdout || '';
      execution.error = result.stderr || '';
      execution.exitCode = result.exitCode || 0;
      execution.duration = Date.now() - startTime;

      instance.executions++;
      instance.lastExecuted = new Date().toISOString();
      this.instances.set(instanceId, instance);
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.duration = Date.now() - startTime;
    }

    this.executions.set(executionId, execution);
    return execution;
  }

  async runCode(instance, template, params) {
    return new Promise((resolve, reject) => {
      const timeout = instance.timeout || 30000;
      const outputDir = path.join(instance.directory, 'output');
      const tempDir = path.join(instance.directory, 'temp');
      const timestamp = Date.now();

      let runCmd = template.run;
      const ext = template.ext;

      const srcFile = path.join(instance.directory, 'src', `main${ext}`);
      const outputFile = path.join(outputDir, `main_${timestamp}`);
      const outDir = path.join(tempDir, `build_${timestamp}`);

      runCmd = runCmd.replace('{file}', srcFile);
      runCmd = runCmd.replace('{output}', outputFile);
      runCmd = runCmd.replace('{outdir}', outDir);
      runCmd = runCmd.replace('{output}.jar', `${outputFile}.jar`);

      if (params.code) {
        runCmd = `echo '${params.code.replace(/'/g, "\\'")}' > ${srcFile} && ${runCmd}`;
      }

      if (params.input) {
        runCmd = `echo '${params.input.replace(/'/g, "\\'")}' | ${runCmd}`;
      }

      const options = {
        cwd: instance.directory,
        timeout,
        maxBuffer: 1024 * 1024 * 10,
        env: {
          ...process.env,
          ...instance.env,
          SANDBOX_ID: instance.id,
          SANDBOX_DIR: instance.directory
        }
      };

      exec(runCmd, options, (error, stdout, stderr) => {
        if (error && error.killed) {
          reject(new Error(`Execution timed out after ${timeout}ms`));
        } else {
          resolve({
            stdout: stdout || '',
            stderr: stderr || (error ? error.message : ''),
            exitCode: error ? error.code || 1 : 0
          });
        }
      });
    });
  }

  async getExecution(id) {
    return this.executions.get(id);
  }

  listExecutions(instanceId = null) {
    let executions = Array.from(this.executions.values());
    if (instanceId) {
      executions = executions.filter(e => e.instanceId === instanceId);
    }
    return executions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  async installPackage(instanceId, packageName) {
    const instance = this.instances.get(instanceId);
    if (!instance) throw new Error(`Instance not found: ${instanceId}`);

    const template = this.templates.get(instance.language);
    if (!template) throw new Error(`Language not supported: ${instance.language}`);

    const installCommands = {
      javascript: `npm install ${packageName}`,
      python: `pip3 install ${packageName}`,
      ruby: `gem install ${packageName}`,
      go: `go get ${packageName}`,
      rust: `cargo add ${packageName}`,
      java: `# Manual JAR management for Java`,
      php: `composer require ${packageName}`,
      r: `Rscript -e "install.packages('${packageName}')"`,
      swift: `# Swift Package Manager requires Package.swift`,
      kotlin: `# Kotlin uses Gradle/Maven`,
      scala: `# Scala uses sbt`,
      lua: `luarocks install ${packageName}`,
      haskell: `cabal install ${packageName}`,
      elixir: `mix deps.get`,
      powershell: `Install-Module -Name ${packageName}`
    };

    const cmd = installCommands[instance.language];
    if (!cmd || cmd.startsWith('#')) {
      return { success: false, message: `Package management not automated for ${instance.language}` };
    }

    try {
      execSync(cmd, { cwd: instance.directory, timeout: 60000 });
      return { success: true, message: `Installed ${packageName}` };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async cloneInstance(sourceId, newName) {
    const source = this.instances.get(sourceId);
    if (!source) throw new Error(`Source instance not found: ${sourceId}`);

    const newId = uuidv4();
    const newDir = path.join(this.sandboxDir, newId);

    await fs.copy(source.directory, newDir);

    const clone = {
      ...source,
      id: newId,
      name: newName || `Clone of ${source.name}`,
      directory: newDir,
      executions: 0,
      lastExecuted: null,
      createdAt: new Date().toISOString()
    };

    this.instances.set(newId, clone);
    await this.saveInstance(clone);
    return clone;
  }

  async getStats() {
    const instances = Array.from(this.instances.values());
    const executions = Array.from(this.executions.values());

    return {
      instances: instances.length,
      languages: this.templates.size,
      totalExecutions: executions.length,
      successfulExecutions: executions.filter(e => e.status === 'completed').length,
      failedExecutions: executions.filter(e => e.status === 'failed').length,
      runningExecutions: executions.filter(e => e.status === 'running').length,
      averageDuration: executions.length > 0
        ? Math.round(executions.reduce((sum, e) => sum + e.duration, 0) / executions.length)
        : 0
    };
  }

  getTemplates() {
    return Array.from(this.templates.values());
  }

  async saveInstance(instance) {
    const filePath = path.join(this.sandboxDir, `${instance.id}.json`);
    await fs.writeJson(filePath, instance, { spaces: 2 });
  }

  async exportSandbox(format = 'json') {
    const data = {
      instances: Array.from(this.instances.values()),
      templates: Array.from(this.templates.values()),
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = SandboxEngine;
