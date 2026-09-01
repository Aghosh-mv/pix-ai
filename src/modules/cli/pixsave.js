/**
 * PixSave — Internal Package Registry
 * GitHub/npm-like registry inside Pix
 * by Aghosh-mv · justcode
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const REGISTRY_DIR = path.join(os.homedir(), '.pix', 'registry');
const INDEX_FILE = path.join(REGISTRY_DIR, 'index.json');

class PixSave {
  constructor() {
    if (!fs.existsSync(REGISTRY_DIR)) fs.mkdirSync(REGISTRY_DIR, { recursive: true });
    this.index = this.loadIndex();
  }

  loadIndex() {
    try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); } catch (e) { return { packages: [] }; }
  }

  saveIndex() { fs.writeFileSync(INDEX_FILE, JSON.stringify(this.index, null, 2)); }

  // ── Publish a package ──
  publish(name, opts = {}) {
    const id = crypto.randomBytes(4).toString('hex');
    const pkg = {
      id, name,
      version: opts.version || '1.0.0',
      description: opts.description || '',
      author: opts.author || 'anonymous',
      files: opts.files || [],
      tags: opts.tags || [],
      code: opts.code || '',
      created: new Date().toISOString(),
      downloads: 0,
      stars: 0,
    };

    // Save package data
    const pkgDir = path.join(REGISTRY_DIR, name);
    if (!fs.existsSync(pkgDir)) fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, `${pkg.version}.json`)), JSON.stringify(pkg, null, 2);

    // Update index
    const existing = this.index.packages.find(p => p.name === name);
    if (existing) {
      existing.versions = existing.versions || [];
      existing.versions.push(pkg.version);
      existing.latest = pkg.version;
      existing.updated = pkg.created;
    } else {
      this.index.packages.push({
        id, name, description: pkg.description, author: pkg.author,
        versions: [pkg.version], latest: pkg.version, tags: pkg.tags,
        created: pkg.created, updated: pkg.created, downloads: 0, stars: 0,
      });
    }
    this.saveIndex();
    return { ok: true, id, name, version: pkg.version };
  }

  // ── Install a package ──
  install(name, targetDir) {
    const meta = this.index.packages.find(p => p.name === name);
    if (!meta) return { ok: false, error: 'package not found' };

    const pkgPath = path.join(REGISTRY_DIR, name, `${meta.latest}.json`);
    if (!fs.existsSync(pkgPath)) return { ok: false, error: 'version not found' };

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    meta.downloads++;
    this.saveIndex();

    // Write files to target
    if (targetDir && pkg.files?.length > 0) {
      pkg.files.forEach(f => {
        const fp = path.join(targetDir, f.path || f.name);
        const dir = path.dirname(fp);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fp, f.content || '');
      });
    } else if (targetDir && pkg.code) {
      const ext = pkg.language === 'python' ? '.py' : pkg.language === 'rust' ? '.rs' : '.js';
      fs.writeFileSync(path.join(targetDir, name + ext), pkg.code);
    }

    return { ok: true, name, version: meta.latest, files: pkg.files?.length || (pkg.code ? 1 : 0) };
  }

  // ── Search packages ──
  search(query) {
    const q = query.toLowerCase();
    return this.index.packages.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // ── List packages ──
  list(opts = {}) {
    let pkgs = this.index.packages;
    if (opts.tag) pkgs = pkgs.filter(p => p.tags.includes(opts.tag));
    if (opts.author) pkgs = pkgs.filter(p => p.author === opts.author);
    return pkgs.sort((a, b) => b.downloads - a.downloads);
  }

  // ── Star / unstar ──
  star(name) {
    const p = this.index.packages.find(p => p.name === name);
    if (p) { p.stars++; this.saveIndex(); return true; }
    return false;
  }

  // ── Get package info ──
  info(name) {
    return this.index.packages.find(p => p.name === name) || null;
  }

  // ── Delete package ──
  delete(name) {
    this.index.packages = this.index.packages.filter(p => p.name !== name);
    this.saveIndex();
    const pkgDir = path.join(REGISTRY_DIR, name);
    if (fs.existsSync(pkgDir)) fs.rmSync(pkgDir, { recursive: true });
    return true;
  }

  // ── Save code snippet (quick publish) ──
  saveSnippet(name, code, tags = []) {
    return this.publish(name, { description: `snippet: ${name}`, code, tags, author: 'pix' });
  }

  // ── Save file as package ──
  saveFile(filePath, opts = {}) {
    const content = fs.readFileSync(filePath, 'utf8');
    const name = opts.name || path.basename(filePath);
    return this.publish(name, {
      description: opts.description || `file: ${filePath}`,
      files: [{ name: path.basename(filePath), content }],
      tags: opts.tags || [],
      ...opts,
    });
  }
}

module.exports = PixSave;
