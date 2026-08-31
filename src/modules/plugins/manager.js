const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');

class PluginManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.plugins = new Map();
    this.pluginsDir = path.join(os.homedir(), '.pix/plugins');
    this.pluginsFile = path.join(this.pluginsDir, 'plugins.json');
  }

  async initialize() {
    this.logger.info('Initializing Plugin Manager...');
    await fs.ensureDir(this.pluginsDir);
    await this.loadPlugins();
    this.logger.info('Plugin Manager initialized');
  }

  async loadPlugins() {
    try {
      if (await fs.pathExists(this.pluginsFile)) {
        const data = await fs.readJson(this.pluginsFile);
        this.plugins = new Map(Object.entries(data));
      }
    } catch (e) {
      this.plugins = new Map();
    }
  }

  async savePlugins() {
    await fs.writeJson(this.pluginsFile, Object.fromEntries(this.plugins), { spaces: 2 });
  }

  async install(params) {
    const { name, source, type = 'npm', config = {} } = params;

    this.logger.info(`Installing plugin: ${name}`);

    const id = uuidv4();
    const pluginDir = path.join(this.pluginsDir, id);

    await fs.ensureDir(pluginDir);

    let installCommand;
    switch (type) {
      case 'npm':
        installCommand = `npm install ${source || name}`;
        break;
      case 'git':
        installCommand = `git clone ${source} "${pluginDir}/repo"`;
        break;
      case 'local':
        installCommand = `cp -r "${source}" "${pluginDir}/plugin"`;
        break;
      default:
        throw new Error(`Unknown plugin type: ${type}`);
    }

    try {
      await new Promise((resolve, reject) => {
        exec(installCommand, { cwd: pluginDir, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
    } catch (error) {
      await fs.remove(pluginDir).catch(() => {});
      throw new Error(`Plugin installation failed: ${error.message}`);
    }

    const plugin = {
      id,
      name,
      source,
      type,
      config,
      enabled: true,
      installedAt: new Date().toISOString(),
      dir: pluginDir
    };

    this.plugins.set(id, plugin);
    await this.savePlugins();

    this.logger.info(`Plugin installed: ${name}`);
    return plugin;
  }

  async uninstall(params) {
    const { pluginId } = params;
    const plugin = this.plugins.get(pluginId);

    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

    this.logger.info(`Uninstalling plugin: ${plugin.name}`);

    await fs.remove(plugin.dir).catch(() => {});
    this.plugins.delete(pluginId);
    await this.savePlugins();

    return { success: true };
  }

  async enable(params) {
    const { pluginId } = params;
    const plugin = this.plugins.get(pluginId);

    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

    plugin.enabled = true;
    this.plugins.set(pluginId, plugin);
    await this.savePlugins();

    return plugin;
  }

  async disable(params) {
    const { pluginId } = params;
    const plugin = this.plugins.get(pluginId);

    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

    plugin.enabled = false;
    this.plugins.set(pluginId, plugin);
    await this.savePlugins();

    return plugin;
  }

  list() {
    return Array.from(this.plugins.values());
  }

  getPlugin(id) {
    return this.plugins.get(id);
  }
}

module.exports = PluginManager;
