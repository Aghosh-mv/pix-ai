/**
 * Plugin Marketplace — Pix AI
 * Install, publish, manage community plugins
 * by Aghosh-mv · justcode
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const crypto = require('crypto');

const PLUGINS_DIR = path.join(os.homedir(), '.pix', 'plugins');
const MARKET_INDEX = path.join(PLUGINS_DIR, 'market.json');
const INSTALLED_FILE = path.join(PLUGINS_DIR, 'installed.json');

class PluginMarketplace {
  constructor() {
    if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    this.market = this.loadMarket();
    this.installed = this.loadInstalled();
  }

  loadMarket() {
    try { return JSON.parse(fs.readFileSync(MARKET_INDEX, 'utf8')); } catch (e) {
      return { plugins: [
        { id: 'git-smart-commit', name: 'Smart Commit', author: 'pix', description: 'AI-powered commit messages', version: '1.0.0', category: 'git', downloads: 0, stars: 0, safe: true },
        { id: 'auto-test', name: 'Auto Test', author: 'pix', description: 'Auto-generate and run tests', version: '1.0.0', category: 'testing', downloads: 0, stars: 0, safe: true },
        { id: 'docker-gen', name: 'Docker Generator', author: 'pix', description: 'Generate Dockerfiles automatically', version: '1.0.0', category: 'devops', downloads: 0, stars: 0, safe: true },
        { id: 'db-connector', name: 'DB Connector', author: 'pix', description: 'Query databases directly', version: '1.0.0', category: 'data', downloads: 0, stars: 0, safe: true },
        { id: 'ui-builder', name: 'UI Builder', author: 'pix', description: 'Generate UI components from descriptions', version: '1.0.0', category: 'frontend', downloads: 0, stars: 0, safe: true },
        { id: 'api-tester', name: 'API Tester', author: 'pix', description: 'Test API endpoints from terminal', version: '1.0.0', category: 'backend', downloads: 0, stars: 0, safe: true },
        { id: 'code-translator', name: 'Code Translator', author: 'pix', description: 'Translate code between languages', version: '1.0.0', category: 'utility', downloads: 0, stars: 0, safe: true },
        { id: 'security-scanner', name: 'Security Scanner', author: 'pix', description: 'Scan code for vulnerabilities', version: '1.0.0', category: 'security', downloads: 0, stars: 0, safe: true },
        { id: 'perf-analyzer', name: 'Performance Analyzer', author: 'pix', description: 'Analyze and optimize performance', version: '1.0.0', category: 'utility', downloads: 0, stars: 0, safe: true },
        { id: 'doc-gen', name: 'Doc Generator', author: 'pix', description: 'Auto-generate documentation', version: '1.0.0', category: 'utility', downloads: 0, stars: 0, safe: true },
      ]};
    }
  }

  loadMarket() { try { return JSON.parse(fs.readFileSync(MARKET_INDEX, 'utf8')); } catch (e) { return this.loadMarket; } }
  saveMarket() { fs.writeFileSync(MARKET_INDEX, JSON.stringify(this.market, null, 2)); }

  loadInstalled() {
    try { return JSON.parse(fs.readFileSync(INSTALLED_FILE, 'utf8')); } catch (e) { return { plugins: [] }; }
  }
  saveInstalled() { fs.writeFileSync(INSTALLED_FILE, JSON.stringify(this.installed, null, 2)); }

  // ── Install plugin ──
  install(pluginId) {
    const plugin = this.market.plugins.find(p => p.id === pluginId);
    if (!plugin) return { ok: false, error: 'plugin not found' };
    if (!plugin.safe) return { ok: false, error: 'plugin not marked safe' };
    if (this.installed.plugins.find(p => p.id === pluginId)) return { ok: false, error: 'already installed' };

    // Create plugin directory
    const pluginDir = path.join(PLUGINS_DIR, pluginId);
    if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir, { recursive: true });

    // Generate plugin code
    const code = this.generatePlugin(plugin);
    fs.writeFileSync(path.join(pluginDir, 'index.js'), code);
    fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify({ name: pluginId, version: plugin.version, main: 'index.js' }, null, 2));

    plugin.downloads++;
    this.installed.plugins.push({ id: pluginId, installed: new Date().toISOString(), enabled: true });
    this.saveMarket();
    this.saveInstalled();
    return { ok: true, name: plugin.name };
  }

  // ── Uninstall plugin ──
  uninstall(pluginId) {
    const pluginDir = path.join(PLUGINS_DIR, pluginId);
    if (fs.existsSync(pluginDir)) fs.rmSync(pluginDir, { recursive: true });
    this.installed.plugins = this.installed.plugins.filter(p => p.id !== pluginId);
    this.saveInstalled();
    return { ok: true };
  }

  // ── Enable / disable ──
  enable(pluginId) {
    const p = this.installed.plugins.find(p => p.id === pluginId);
    if (p) { p.enabled = true; this.saveInstalled(); return true; }
    return false;
  }

  disable(pluginId) {
    const p = this.installed.plugins.find(p => p.id === pluginId);
    if (p) { p.enabled = false; this.saveInstalled(); return true; }
    return false;
  }

  // ── Search ──
  search(query) {
    const q = query.toLowerCase();
    return this.market.plugins.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  // ── List all ──
  list(category) {
    let plugins = this.market.plugins;
    if (category) plugins = plugins.filter(p => p.category === category);
    return plugins.map(p => ({
      ...p,
      installed: !!this.installed.plugins.find(i => i.id === p.id),
      enabled: this.installed.plugins.find(i => i.id === p.id)?.enabled || false,
    }));
  }

  // ── List installed ──
  listInstalled() {
    return this.installed.plugins;
  }

  // ── Get plugin info ──
  info(pluginId) {
    return this.market.plugins.find(p => p.id === pluginId) || null;
  }

  // ── Star ──
  star(pluginId) {
    const p = this.market.plugins.find(p => p.id === pluginId);
    if (p) { p.stars++; this.saveMarket(); return true; }
    return false;
  }

  // ── Generate plugin code ──
  generatePlugin(plugin) {
    return `/**
 * ${plugin.name} — Pix Plugin
 * ${plugin.description}
 * by ${plugin.author}
 */
module.exports = {
  name: '${plugin.name}',
  id: '${plugin.id}',
  version: '${plugin.version}',
  init(context) {
    context.registerCommand('${plugin.id}', {
      description: '${plugin.description}',
      handler: (args) => {
        return { plugin: '${plugin.name}', result: 'executed' };
      }
    });
  }
};`;
  }
}

module.exports = PluginMarketplace;
