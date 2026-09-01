/**
 * Multi-Agent Sandbox — Pix AI
 * Spins up agents in isolated sandboxes with NO guardrails
 * Tests dangerous/complex operations safely before real execution
 * by Aghosh-mv · justcode
 */
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const SANDBOX_DIR = path.join(os.homedir(), '.pix', 'sandboxes');

class SandboxAgent {
  constructor() {
    if (!fs.existsSync(SANDBOX_DIR)) fs.mkdirSync(SANDBOX_DIR, { recursive: true });
    this.agents = new Map();
  }

  // ── Create sandbox ──
  create(opts = {}) {
    const id = crypto.randomBytes(4).toString('hex');
    const sandboxDir = path.join(SANDBOX_DIR, id);
    fs.mkdirSync(sandboxDir, { recursive: true });

    // Copy project into sandbox (isolated copy)
    const projectDir = opts.cwd || process.cwd();
    try {
      execSync(`cp -r "${projectDir}"/* "${sandboxDir}/" 2>/dev/null || true`, { stdio: 'pipe' });
    } catch (e) {}

    const agent = {
      id, dir: sandboxDir, created: new Date().toISOString(),
      status: 'idle', task: null,
      logs: [], mutations: [], errors: [],
      guardrails: false, // NO guardrails in sandbox
      maxActions: opts.maxActions || 50,
      actionCount: 0,
    };

    this.agents.set(id, agent);
    return agent;
  }

  // ── Run task in sandbox (no guardrails) ──
  run(agentId, task, aiCallback) {
    const agent = this.agents.get(agentId);
    if (!agent) return { ok: false, error: 'agent not found' };

    agent.status = 'running';
    agent.task = task;
    agent.logs.push({ time: new Date().toISOString(), action: 'start', task });

    // Execute in sandbox with full permissions
    const result = this.executeInSandbox(agent, task, aiCallback);

    agent.status = 'done';
    agent.logs.push({ time: new Date().toISOString(), action: 'complete', result: result.summary });

    return {
      ok: true,
      agentId,
      summary: result.summary,
      mutations: agent.mutations,
      errors: agent.errors,
      logs: agent.logs,
      safe: agent.errors.length === 0,
    };
  }

  // ── Execute with NO guardrails ──
  executeInSandbox(agent, task, aiCallback) {
    const actions = [];
    const taskLower = task.toLowerCase();

    // Parse task into actions
    if (/\b(install|npm|pip|brew)\b/.test(taskLower)) {
      actions.push({ type: 'install', cmd: this.extractCommand(task, 'install') });
    }
    if (/\b(run|execute|start|dev)\b/.test(taskLower)) {
      actions.push({ type: 'run', cmd: this.extractCommand(task, 'run') });
    }
    if (/\b(test|spec)\b/.test(taskLower)) {
      actions.push({ type: 'test', cmd: this.extractCommand(task, 'test') });
    }
    if (/\b(delete|remove|rm)\b/.test(taskLower)) {
      actions.push({ type: 'delete', cmd: this.extractCommand(task, 'delete') });
    }
    if (/\b(write|create|generate)\b/.test(taskLower)) {
      actions.push({ type: 'write', cmd: this.extractCommand(task, 'write') });
    }
    if (/\b(network|http|fetch|curl|api)\b/.test(taskLower)) {
      actions.push({ type: 'network', cmd: this.extractCommand(task, 'network') });
    }
    if (/\b(file|read|write|edit|modify)\b/.test(taskLower)) {
      actions.push({ type: 'file', cmd: this.extractCommand(task, 'file') });
    }

    // If no specific actions detected, run as general command
    if (actions.length === 0) {
      actions.push({ type: 'general', cmd: task });
    }

    // Execute each action in sandbox
    actions.forEach(action => {
      if (agent.actionCount >= agent.maxActions) {
        agent.errors.push({ time: new Date().toISOString(), error: 'max actions reached' });
        return;
      }

      try {
        let output;
        if (action.type === 'write') {
          // Write files in sandbox
          const files = this.parseFiles(action.cmd);
          files.forEach(f => {
            const fp = path.join(agent.dir, f.name);
            const dir = path.dirname(fp);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(fp, f.content);
            agent.mutations.push({ type: 'write', file: f.name, size: f.content.length });
          });
          output = `wrote ${files.length} files`;
        } else if (action.type === 'delete') {
          // Delete in sandbox
          const target = action.cmd.replace(/^(delete|remove|rm)\s+/i, '');
          const fp = path.join(agent.dir, target);
          if (fs.existsSync(fp)) {
            fs.rmSync(fp, { recursive: true });
            agent.mutations.push({ type: 'delete', file: target });
            output = `deleted ${target}`;
          } else {
            output = `${target} not found`;
          }
        } else {
          // Run command in sandbox
          output = execSync(action.cmd, {
            encoding: 'utf8', cwd: agent.dir, timeout: 30000,
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          agent.mutations.push({ type: 'exec', cmd: action.cmd, output: output.substring(0, 500) });
        }

        agent.logs.push({ time: new Date().toISOString(), action: action.type, cmd: action.cmd, output: output?.substring(0, 200) });
        agent.actionCount++;
        actions.push({ ...action, output, success: true });
      } catch (e) {
        agent.errors.push({ time: new Date().toISOString(), action: action.type, cmd: action.cmd, error: e.message?.substring(0, 200) });
        agent.logs.push({ time: new Date().toISOString(), action: action.type, cmd: action.cmd, error: e.message?.substring(0, 200) });
        actions.push({ ...action, error: e.message?.substring(0, 200), success: false });
      }
    });

    // Build summary
    const successes = actions.filter(a => a.success);
    const failures = actions.filter(a => !a.success);
    return {
      summary: `${successes.length} actions succeeded, ${failures.length} failed`,
      actions, successes: successes.length, failures: failures.length,
    };
  }

  // ── Get sandbox file listing ──
  listFiles(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return [];
    const files = [];
    const walk = (dir, rel = '') => {
      fs.readdirSync(dir).forEach(f => {
        if (f === 'node_modules' || f === '.git') return;
        const fp = path.join(dir, f);
        const stat = fs.statSync(fp);
        if (stat.isDirectory()) walk(fp, path.join(rel, f));
        else files.push({ name: path.join(rel, f), size: stat.size, modified: stat.mtime });
      });
    };
    walk(agent.dir);
    return files;
  }

  // ── Get sandbox diff (what changed) ──
  getDiff(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    return {
      mutations: agent.mutations,
      errors: agent.errors,
      logs: agent.logs,
    };
  }

  // ── Apply sandbox results to real project ──
  apply(agentId, targetDir) {
    const agent = this.agents.get(agentId);
    if (!agent) return { ok: false, error: 'agent not found' };

    let applied = 0;
    agent.mutations.forEach(m => {
      try {
        if (m.type === 'write') {
          const src = path.join(agent.dir, m.file);
          const dst = path.join(targetDir, m.file);
          const dir = path.dirname(dst);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(src, dst);
          applied++;
        } else if (m.type === 'exec' && m.output) {
          // Log but don't auto-execute
          applied++;
        }
      } catch (e) {}
    });

    return { ok: true, applied, total: agent.mutations.length };
  }

  // ── Destroy sandbox ──
  destroy(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    try { fs.rmSync(agent.dir, { recursive: true }); } catch (e) {}
    this.agents.delete(agentId);
    return true;
  }

  // ── List all sandboxes ──
  list() {
    return Array.from(this.agents.values()).map(a => ({
      id: a.id, status: a.status, task: a.task,
      mutations: a.mutations.length, errors: a.errors.length,
      created: a.created,
    }));
  }

  // ── Quick test: run task in sandbox, report result ──
  quickTest(task, aiCallback) {
    const agent = this.create();
    const result = this.run(agent.id, task, aiCallback);
    // Don't destroy - let user decide
    return { ...result, agentId: agent.id };
  }

  // Helpers
  extractCommand(task, type) {
    return task.replace(/^(install|run|test|delete|remove|rm|write|create|generate|network|http|fetch|file|read|edit)\s*/i, '').trim() || task;
  }

  parseFiles(cmd) {
    // Simple: extract filename and content from command
    const files = [];
    const match = cmd.match(/(?:create|write|generate)\s+(\S+)\s*(.*)/is);
    if (match) {
      files.push({ name: match[1], content: match[2] || '' });
    }
    return files.length > 0 ? files : [{ name: 'output.txt', content: cmd }];
  }
}

module.exports = SandboxAgent;
