const fs = require('fs');
const path = require('path');
const https = require('https');

class PluginMarketplace {
  constructor(pixHome) {
    this.pixHome = pixHome;
    this.pluginsDir = path.join(pixHome, 'plugins');
    this.registryFile = path.join(pixHome, 'plugin-registry.json');
    this.enabledFile = path.join(pixHome, 'enabled-plugins.json');
    if (!fs.existsSync(this.pluginsDir)) fs.mkdirSync(this.pluginsDir, { recursive: true });
  }

  getRegistry() {
    try {
      if (fs.existsSync(this.registryFile)) return JSON.parse(fs.readFileSync(this.registryFile, 'utf8'));
    } catch (e) {}
    return { plugins: this.getBuiltInPlugins() };
  }

  getBuiltInPlugins() {
    return [
      { id: 'git-auto', name: 'Git Auto', desc: 'Auto-commit, branch, PR', version: '1.0.0', builtin: true, enabled: false, category: 'workflow' },
      { id: 'code-review', name: 'Code Review', desc: 'AI-powered PR review', version: '1.0.0', builtin: true, enabled: false, category: 'quality' },
      { id: 'test-gen', name: 'Test Generator', desc: 'Auto-generate tests', version: '1.0.0', builtin: true, enabled: false, category: 'quality' },
      { id: 'dep-audit', name: 'Dependency Audit', desc: 'Check for vulnerable deps', version: '1.0.0', builtin: true, enabled: false, category: 'security' },
      { id: 'doc-gen', name: 'Doc Generator', desc: 'Auto-generate documentation', version: '1.0.0', builtin: true, enabled: false, category: 'docs' },
      { id: 'perf-profiler', name: 'Performance Profiler', desc: 'Profile and optimize code', version: '1.0.0', builtin: true, enabled: false, category: 'performance' },
      { id: 'i18n', name: 'Internationalization', desc: 'Multi-language support', version: '1.0.0', builtin: true, enabled: false, category: 'i18n' },
      { id: 'db-manager', name: 'Database Manager', desc: 'SQL/NoSQL operations', version: '1.0.0', builtin: true, enabled: false, category: 'data' },
      { id: 'api-scaffold', name: 'API Scaffold', desc: 'Generate REST/GraphQL APIs', version: '1.0.0', builtin: true, enabled: false, category: 'workflow' },
      { id: 'docker-gen', name: 'Docker Generator', desc: 'Auto-create Dockerfiles', version: '1.0.0', builtin: true, enabled: false, category: 'devops' },
      { id: 'ci-gen', name: 'CI/CD Generator', desc: 'Generate GitHub Actions/GitLab CI', version: '1.0.0', builtin: true, enabled: false, category: 'devops' },
      { id: 'env-mgr', name: 'Environment Manager', desc: '.env file management', version: '1.0.0', builtin: true, enabled: false, category: 'devops' }
    ];
  }

  getEnabled() {
    try {
      if (fs.existsSync(this.enabledFile)) return JSON.parse(fs.readFileSync(this.enabledFile, 'utf8'));
    } catch (e) {}
    return [];
  }

  enable(pluginId) {
    const enabled = this.getEnabled();
    if (!enabled.includes(pluginId)) {
      enabled.push(pluginId);
      fs.writeFileSync(this.enabledFile, JSON.stringify(enabled, null, 2));
    }
    return true;
  }

  disable(pluginId) {
    let enabled = this.getEnabled();
    enabled = enabled.filter(id => id !== pluginId);
    fs.writeFileSync(this.enabledFile, JSON.stringify(enabled, null, 2));
    return true;
  }

  isEnabled(pluginId) {
    return this.getEnabled().includes(pluginId);
  }

  install(pluginId) {
    const registry = this.getRegistry();
    const plugin = registry.plugins.find(p => p.id === pluginId);
    if (!plugin) return { success: false, error: 'Plugin not found' };
    this.enable(pluginId);
    return { success: true, plugin };
  }

  uninstall(pluginId) {
    this.disable(pluginId);
    return { success: true };
  }

  list() {
    const registry = this.getRegistry();
    const enabled = this.getEnabled();
    return registry.plugins.map(p => ({ ...p, enabled: enabled.includes(p.id) }));
  }

  search(query) {
    const plugins = this.list();
    return plugins.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.desc.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase())
    );
  }

  getCategories() {
    const plugins = this.list();
    const cats = {};
    plugins.forEach(p => {
      if (!cats[p.category]) cats[p.category] = [];
      cats[p.category].push(p);
    });
    return cats;
  }
}

module.exports = PluginMarketplace;
