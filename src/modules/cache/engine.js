const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class CacheEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.caches = new Map();
    this.defaultTTL = 300;
    this.maxEntries = 10000;
    this.cacheDir = path.join(os.homedir(), '.pix/cache');
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  async initialize() {
    this.logger.info('Initializing Cache Engine...');
    await fs.ensureDir(this.cacheDir);
    await this.loadCaches();
    this.startCleanupInterval();
    this.logger.info('Cache Engine initialized');
  }

  async loadCaches() {
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const cache = await fs.readJson(path.join(this.cacheDir, file));
          this.caches.set(cache.name, {
            ...cache,
            entries: new Map(Object.entries(cache.entries || {}))
          });
        }
      }
    } catch (e) {}
  }

  startCleanupInterval() {
    setInterval(() => this.cleanup(), 60000);
  }

  async cleanup() {
    const now = Date.now();
    for (const [name, cache] of this.caches) {
      let cleaned = 0;
      for (const [key, entry] of cache.entries) {
        if (entry.expiresAt && now > entry.expiresAt) {
          cache.entries.delete(key);
          cleaned++;
        }
      }

      if (cache.maxEntries && cache.entries.size > cache.maxEntries) {
        const entries = Array.from(cache.entries.entries())
          .sort((a, b) => (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0));

        const toRemove = entries.slice(0, entries.length - cache.maxEntries);
        for (const [key] of toRemove) {
          cache.entries.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        await this.saveCache(name);
      }
    }
  }

  createCache(name, options = {}) {
    if (this.caches.has(name)) {
      return this.caches.get(name);
    }

    const cache = {
      name,
      entries: new Map(),
      ttl: options.ttl || this.defaultTTL,
      maxEntries: options.maxEntries || this.maxEntries,
      persistent: options.persistent || false,
      createdAt: new Date().toISOString()
    };

    this.caches.set(name, cache);
    this.logger.info(`Cache created: ${name}`);
    return cache;
  }

  async set(name, key, value, ttl = null) {
    const cache = this.caches.get(name);
    if (!cache) throw new Error(`Cache not found: ${name}`);

    const entry = {
      value,
      createdAt: Date.now(),
      expiresAt: ttl ? Date.now() + (ttl * 1000) : (cache.ttl ? Date.now() + (cache.ttl * 1000) : null),
      lastAccessed: Date.now(),
      accessCount: 0
    };

    cache.entries.set(key, entry);
    this.stats.sets++;

    if (cache.persistent) {
      await this.saveCache(name);
    }

    return { success: true };
  }

  async get(name, key) {
    const cache = this.caches.get(name);
    if (!cache) throw new Error(`Cache not found: ${name}`);

    const entry = cache.entries.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      cache.entries.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.stats.hits++;

    return entry.value;
  }

  async has(name, key) {
    const cache = this.caches.get(name);
    if (!cache) return false;

    const entry = cache.entries.get(key);
    if (!entry) return false;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      cache.entries.delete(key);
      return false;
    }

    return true;
  }

  async delete(name, key) {
    const cache = this.caches.get(name);
    if (!cache) throw new Error(`Cache not found: ${name}`);

    const deleted = cache.entries.delete(key);
    this.stats.deletes++;

    if (cache.persistent && deleted) {
      await this.saveCache(name);
    }

    return { success: deleted };
  }

  async clear(name) {
    const cache = this.caches.get(name);
    if (!cache) throw new Error(`Cache not found: ${name}`);

    cache.entries.clear();
    await this.saveCache(name);

    return { success: true };
  }

  async deleteCache(name) {
    this.caches.delete(name);
    await fs.remove(path.join(this.cacheDir, `${name}.json`)).catch(() => {});

    return { success: true };
  }

  async getOrSet(name, key, factory, ttl = null) {
    let value = await this.get(name, key);
    if (value !== null) return value;

    value = await factory();
    await this.set(name, key, value, ttl);
    return value;
  }

  async mget(name, keys) {
    const results = {};
    for (const key of keys) {
      results[key] = await this.get(name, key);
    }
    return results;
  }

  async mset(name, entries, ttl = null) {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(name, key, value, ttl);
    }
    return { success: true };
  }

  async increment(name, key, amount = 1) {
    const cache = this.caches.get(name);
    if (!cache) throw new Error(`Cache not found: ${name}`);

    const entry = cache.entries.get(key);
    if (!entry) {
      await this.set(name, key, amount);
      return amount;
    }

    entry.value = (entry.value || 0) + amount;
    entry.lastAccessed = Date.now();

    return entry.value;
  }

  async decrement(name, key, amount = 1) {
    return this.increment(name, key, -amount);
  }

  async keys(name) {
    const cache = this.caches.get(name);
    if (!cache) throw new Error(`Cache not found: ${name}`);

    return Array.from(cache.entries.keys());
  }

  async size(name) {
    const cache = this.caches.get(name);
    if (!cache) throw new Error(`Cache not found: ${name}`);

    return cache.entries.size;
  }

  async getStats() {
    const cacheStats = {};
    for (const [name, cache] of this.caches) {
      cacheStats[name] = {
        entries: cache.entries.size,
        maxEntries: cache.maxEntries,
        ttl: cache.ttl,
        persistent: cache.persistent
      };
    }

    return {
      ...this.stats,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
        : '0%',
      caches: cacheStats
    };
  }

  async saveCache(name) {
    const cache = this.caches.get(name);
    if (!cache || !cache.persistent) return;

    const data = {
      name: cache.name,
      ttl: cache.ttl,
      maxEntries: cache.maxEntries,
      persistent: cache.persistent,
      createdAt: cache.createdAt,
      entries: Object.fromEntries(cache.entries)
    };

    await fs.writeJson(path.join(this.cacheDir, `${name}.json`), data, { spaces: 2 });
  }

  async flushAll() {
    for (const [name] of this.caches) {
      await this.clear(name);
    }
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
    return { success: true };
  }

  createLRUCache(name, maxAge = 600, maxSize = 1000) {
    return this.createCache(name, {
      ttl: maxAge,
      maxEntries: maxSize,
      persistent: false
    });
  }

  createTTLCache(name, defaultTTL = 60) {
    return this.createCache(name, {
      ttl: defaultTTL,
      persistent: false
    });
  }

  createPersistentCache(name) {
    return this.createCache(name, {
      persistent: true
    });
  }
}

module.exports = CacheEngine;
