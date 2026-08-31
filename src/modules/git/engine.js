const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');

class GitEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.repositories = new Map();
    this.commits = new Map();
    this.branches = new Map();
    this.stashes = [];
    this.remotes = new Map();
  }

  async initialize() {
    this.logger.info('Initializing Git Engine...');
    this.logger.info('Git Engine initialized');
  }

  async init(repoPath, options = {}) {
    const { bare = false, initialBranch = 'main' } = options;
    const command = `git init${bare ? ' --bare' : ''}${initialBranch ? ` --initial-branch=${initialBranch}` : ''} "${repoPath}"`;

    await this.execCommand(command, repoPath);

    const repo = {
      id: uuidv4(),
      path: repoPath,
      bare,
      initialBranch,
      createdAt: new Date().toISOString()
    };

    this.repositories.set(repoPath, repo);
    return repo;
  }

  async clone(url, destination, options = {}) {
    const { branch = null, depth = null, recursive = false } = options;
    let command = `git clone`;

    if (branch) command += ` -b ${branch}`;
    if (depth) command += ` --depth ${depth}`;
    if (recursive) command += ` --recursive`;

    command += ` "${url}" "${destination}"`;

    await this.execCommand(command);

    return { url, destination, branch, clonedAt: new Date().toISOString() };
  }

  async status(repoPath) {
    const output = await this.execCommand('git status --porcelain', repoPath);
    const lines = output.split('\n').filter(line => line.trim());

    const files = lines.map(line => {
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filePath = line.substring(3);

      return {
        path: filePath,
        indexStatus,
        workTreeStatus,
        staged: indexStatus !== ' ' && indexStatus !== '?',
        modified: workTreeStatus === 'M' || indexStatus === 'M',
        added: indexStatus === 'A',
        deleted: workTreeStatus === 'D' || indexStatus === 'D',
        renamed: workTreeStatus === 'R' || indexStatus === 'R',
        untracked: indexStatus === '?' && workTreeStatus === '?'
      };
    });

    const branchOutput = await this.execCommand('git branch --show-current', repoPath).catch(() => '');
    const currentBranch = branchOutput.trim() || 'HEAD';

    return {
      currentBranch,
      files,
      staged: files.filter(f => f.staged),
      modified: files.filter(f => f.modified),
      untracked: files.filter(f => f.untracked),
      ahead: await this.getAheadCount(repoPath),
      behind: await this.getBehindCount(repoPath)
    };
  }

  async getAheadCount(repoPath) {
    try {
      const output = await this.execCommand('git rev-list --count @{upstream}..HEAD', repoPath);
      return parseInt(output.trim()) || 0;
    } catch (e) {
      return 0;
    }
  }

  async getBehindCount(repoPath) {
    try {
      const output = await this.execCommand('git rev-list --count HEAD..@{upstream}', repoPath);
      return parseInt(output.trim()) || 0;
    } catch (e) {
      return 0;
    }
  }

  async add(repoPath, files = '.') {
    const filesStr = Array.isArray(files) ? files.join(' ') : files;
    await this.execCommand(`git add ${filesStr}`, repoPath);
    return { success: true, files: filesStr };
  }

  async commit(repoPath, message, options = {}) {
    const { author = null, allowEmpty = false } = options;
    let command = 'git commit';

    if (author) command += ` --author="${author}"`;
    if (allowEmpty) command += ' --allow-empty';

    command += ` -m "${message}"`;

    const output = await this.execCommand(command, repoPath);
    const hashMatch = output.match(/\[[\w\s]+\s+([a-f0-9]+)\]/);

    return {
      success: true,
      hash: hashMatch ? hashMatch[1] : null,
      message,
      output
    };
  }

  async push(repoPath, remote = 'origin', branch = null, options = {}) {
    const { force = false, setUpstream = false, tags = false } = options;
    let command = 'git push';

    if (force) command += ' --force';
    if (setUpstream) command += ` -u ${remote}`;
    if (tags) command += ' --tags';

    command += ` ${remote}`;
    if (branch) command += ` ${branch}`;

    const output = await this.execCommand(command, repoPath);
    return { success: true, remote, branch, output };
  }

  async pull(repoPath, remote = 'origin', branch = null, options = {}) {
    const { rebase = false, ffOnly = false } = options;
    let command = 'git pull';

    if (rebase) command += ' --rebase';
    if (ffOnly) command += '--ff-only';

    command += ` ${remote}`;
    if (branch) command += ` ${branch}`;

    const output = await this.execCommand(command, repoPath);
    return { success: true, remote, branch, output };
  }

  async fetch(repoPath, remote = 'origin', options = {}) {
    const { all = false, tags = false } = options;
    let command = 'git fetch';

    if (all) command += ' --all';
    if (tags) command += ' --tags';

    command += ` ${remote}`;

    const output = await this.execCommand(command, repoPath);
    return { success: true, remote, output };
  }

  async branch(repoPath, name = null, options = {}) {
    if (name) {
      const { startPoint = null, force = false } = options;
      let command = `git branch${force ? ' -f' : ''} ${name}`;
      if (startPoint) command += ` ${startPoint}`;
      await this.execCommand(command, repoPath);
      return { success: true, name, created: true };
    }

    const output = await this.execCommand('git branch', repoPath);
    const branches = output.split('\n')
      .filter(line => line.trim())
      .map(line => ({
        name: line.replace('* ', '').trim(),
        current: line.startsWith('* ')
      }));

    return branches;
  }

  async checkout(repoPath, target, options = {}) {
    const { create = false, force = false, detach = false } = options;
    let command = 'git checkout';

    if (create) command += ' -b';
    if (force) command += ' -f';
    if (detach) command += ' --detach';

    command += ` ${target}`;

    const output = await this.execCommand(command, repoPath);
    return { success: true, target, output };
  }

  async merge(repoPath, branch, options = {}) {
    const { noEdit = false, squash = false, strategy = null } = options;
    let command = 'git merge';

    if (noEdit) command += ' --no-edit';
    if (squash) command += ' --squash';
    if (strategy) command += ` -s ${strategy}`;

    command += ` ${branch}`;

    const output = await this.execCommand(command, repoPath);
    return { success: true, branch, output };
  }

  async rebase(repoPath, upstream, options = {}) {
    const { interactive = false, onto = null, preserveMerges = false } = options;
    let command = 'git rebase';

    if (interactive) command += ' -i';
    if (onto) command += ` --onto ${onto}`;
    if (preserveMerges) command += ' --preserve-merges';

    command += ` ${upstream}`;

    const output = await this.execCommand(command, repoPath);
    return { success: true, upstream, output };
  }

  async stash(repoPath, message = null) {
    let command = 'git stash';
    if (message) command += ` push -m "${message}"`;

    const output = await this.execCommand(command, repoPath);
    return { success: true, message, output };
  }

  async stashPop(repoPath, stashRef = 'stash@{0}') {
    const output = await this.execCommand(`git stash pop ${stashRef}`, repoPath);
    return { success: true, stashRef, output };
  }

  async log(repoPath, options = {}) {
    const { limit = 10, oneline = false, graph = false, format = null } = options;
    let command = 'git log';

    if (limit) command += ` -n ${limit}`;
    if (oneline) command += ' --oneline';
    if (graph) command += ' --graph';
    if (format) command += ` --format="${format}"`;

    const output = await this.execCommand(command, repoPath);
    const lines = output.split('\n').filter(line => line.trim());

    return lines.map(line => {
      const hashMatch = line.match(/^[\s\*\/\\|]*([a-f0-9]{7,40})/);
      const messageMatch = line.match(/(?:\)\s*|\s)(.+)$/);

      return {
        hash: hashMatch ? hashMatch[1] : null,
        message: messageMatch ? messageMatch[1].trim() : line.trim(),
        raw: line
      };
    });
  }

  async diff(repoPath, options = {}) {
    const { staged = false, commit = null, stat = false } = options;
    let command = 'git diff';

    if (staged) command += ' --staged';
    if (commit) command += ` ${commit}`;
    if (stat) command += ' --stat';

    const output = await this.execCommand(command, repoPath);
    return output;
  }

  async tag(repoPath, name = null, message = null) {
    if (name) {
      let command = `git tag`;
      if (message) command += ` -a ${name} -m "${message}"`;
      else command += ` ${name}`;

      await this.execCommand(command, repoPath);
      return { success: true, name, created: true };
    }

    const output = await this.execCommand('git tag', repoPath);
    return output.split('\n').filter(t => t.trim());
  }

  async remote(repoPath, name = null, url = null) {
    if (name && url) {
      await this.execCommand(`git remote add ${name} "${url}"`, repoPath);
      return { success: true, name, url, action: 'added' };
    }

    if (name) {
      await this.execCommand(`git remote remove ${name}`, repoPath);
      return { success: true, name, action: 'removed' };
    }

    const output = await this.execCommand('git remote -v', repoPath);
    const remotes = {};
    const lines = output.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const [name, url, type] = line.split(/\s+/);
      if (!remotes[name]) remotes[name] = {};
      remotes[name][type === '(push)' ? 'push' : 'fetch'] = url;
    }

    return remotes;
  }

  async blame(repoPath, filePath) {
    const output = await this.execCommand(`git blame "${filePath}"`, repoPath);
    const lines = output.split('\n').filter(l => l.trim());

    return lines.map(line => {
      const match = line.match(/^([a-f0-9]+)\s+\((.+?)\s+(\d{4}-\d{2}-\d{2})\s+(.+?)\)\s+(.+)$/);
      if (match) {
        return {
          hash: match[1],
          author: match[2],
          date: match[3],
          lineNumber: match[4],
          content: match[5]
        };
      }
      return { raw: line };
    });
  }

  async bisect(repoPath, good, bad) {
    await this.execCommand(`git bisect start`, repoPath);
    await this.execCommand(`git bisect good ${good}`, repoPath);
    await this.execCommand(`git bisect bad ${bad}`, repoPath);
    return { success: true, started: true };
  }

  async cherryPick(repoPath, commitHash) {
    const output = await this.execCommand(`git cherry-pick ${commitHash}`, repoPath);
    return { success: true, commit: commitHash, output };
  }

  async revert(repoPath, commitHash) {
    const output = await this.execCommand(`git revert ${commitHash}`, repoPath);
    return { success: true, commit: commitHash, output };
  }

  async reset(repoPath, mode = 'soft', commit = 'HEAD') {
    const output = await this.execCommand(`git reset --${mode} ${commit}`, repoPath);
    return { success: true, mode, commit, output };
  }

  async clean(repoPath, options = {}) {
    const { force = false, dryRun = false, directories = false } = options;
    let command = 'git clean';

    if (force) command += ' -f';
    if (dryRun) command += ' -n';
    if (directories) command += ' -d';

    const output = await this.execCommand(command, repoPath);
    return { success: true, output };
  }

  async config(repoPath, key = null, value = null) {
    if (key && value) {
      await this.execCommand(`git config ${key} "${value}"`, repoPath);
      return { success: true, key, value };
    }

    if (key) {
      const output = await this.execCommand(`git config ${key}`, repoPath);
      return { key, value: output.trim() };
    }

    const output = await this.execCommand('git config --list', repoPath);
    const configs = {};
    const lines = output.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      configs[key] = valueParts.join('=');
    }

    return configs;
  }

  async getGitignore(repoPath) {
    const gitignorePath = path.join(repoPath, '.gitignore');
    if (await fs.pathExists(gitignorePath)) {
      return await fs.readFile(gitignorePath, 'utf8');
    }
    return null;
  }

  async setGitignore(repoPath, patterns) {
    const content = Array.isArray(patterns) ? patterns.join('\n') : patterns;
    await fs.writeFile(path.join(repoPath, '.gitignore'), content);
    return { success: true };
  }

  async getCommit(repoPath, hash = 'HEAD') {
    const format = JSON.stringify({
      hash: '%H',
      shortHash: '%h',
      author: '%an',
      email: '%ae',
      date: '%ai',
      subject: '%s',
      body: '%b'
    });

    const output = await this.execCommand(`git log -1 --format=${format} ${hash}`, repoPath);
    return JSON.parse(output);
  }

  async getBranches(repoPath) {
    const output = await this.execCommand('git branch -a', repoPath);
    return output.split('\n')
      .filter(line => line.trim())
      .map(line => ({
        name: line.replace('* ', '').replace('remotes/', '').trim(),
        current: line.startsWith('* '),
        remote: line.includes('remotes/')
      }));
  }

  async getObjectCount(repoPath) {
    const output = await this.execCommand('git rev-list --all --count', repoPath);
    return parseInt(output.trim()) || 0;
  }

  async getRepoSize(repoPath) {
    const output = await this.execCommand('git count-objects -vH', repoPath);
    const lines = output.split('\n');
    const size = {};

    for (const line of lines) {
      const [key, value] = line.split(': ');
      if (key && value) {
        size[key.trim()] = value.trim();
      }
    }

    return size;
  }

  async execCommand(command, cwd = process.cwd()) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve(stdout);
        }
      });
    });
  }
}

module.exports = GitEngine;
