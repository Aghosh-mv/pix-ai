const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class SearchEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.indexes = new Map();
    this.searchHistory = [];
    this.searchDir = path.join(os.homedir(), '.pix/search');
  }

  async initialize() {
    this.logger.info('Initializing Search Engine...');
    await fs.ensureDir(this.searchDir);
    await this.loadIndexes();
    this.logger.info('Search Engine initialized');
  }

  async loadIndexes() {
    try {
      const files = await fs.readdir(this.searchDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const index = await fs.readJson(path.join(this.searchDir, file));
          this.indexes.set(index.name, index);
        }
      }
    } catch (e) {}
  }

  async createIndex(name, options = {}) {
    const index = {
      name,
      fields: options.fields || ['content'],
      storeVectors: options.storeVectors || false,
      documents: new Map(),
      createdAt: new Date().toISOString()
    };

    this.indexes.set(name, index);
    await this.saveIndex(name);

    this.logger.info(`Index created: ${name}`);
    return index;
  }

  async addDocument(indexName, doc) {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index not found: ${indexName}`);

    const id = doc.id || uuidv4();
    const document = {
      id,
      ...doc,
      indexedAt: new Date().toISOString()
    };

    index.documents.set(id, document);
    await this.saveIndex(indexName);

    return document;
  }

  async addDocuments(indexName, docs) {
    const results = [];
    for (const doc of docs) {
      const result = await this.addDocument(indexName, doc);
      results.push(result);
    }
    return results;
  }

  async search(indexName, query, options = {}) {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index not found: ${indexName}`);

    const { limit = 10, offset = 0, fields = null, fuzzy = false } = options;
    const searchFields = fields || index.fields;
    const queryLower = query.toLowerCase();

    const results = [];

    for (const [, doc] of index.documents) {
      let score = 0;

      for (const field of searchFields) {
        const value = this.getNestedValue(doc, field);
        if (!value) continue;

        const valueStr = String(value).toLowerCase();

        if (valueStr === queryLower) {
          score += 100;
        } else if (valueStr.startsWith(queryLower)) {
          score += 80;
        } else if (valueStr.includes(queryLower)) {
          score += 60;
        } else if (fuzzy) {
          const similarity = this.calculateSimilarity(queryLower, valueStr);
          if (similarity > 0.7) {
            score += similarity * 50;
          }
        }
      }

      if (score > 0) {
        results.push({ ...doc, score });
      }
    }

    results.sort((a, b) => b.score - a.score);

    this.searchHistory.push({
      query,
      indexName,
      results: results.length,
      timestamp: new Date().toISOString()
    });

    return {
      results: results.slice(offset, offset + limit),
      total: results.length,
      query,
      took: Date.now()
    };
  }

  async deleteDocument(indexName, docId) {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index not found: ${indexName}`);

    index.documents.delete(docId);
    await this.saveIndex(indexName);

    return { success: true };
  }

  async updateDocument(indexName, docId, updates) {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index not found: ${indexName}`);

    const doc = index.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    const updated = { ...doc, ...updates, updatedAt: new Date().toISOString() };
    index.documents.set(docId, updated);
    await this.saveIndex(indexName);

    return updated;
  }

  async getDocument(indexName, docId) {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index not found: ${indexName}`);

    return index.documents.get(docId);
  }

  async listDocuments(indexName, options = {}) {
    const index = this.indexes.get(indexName);
    if (!index) throw new Error(`Index not found: ${indexName}`);

    const { limit = 100, offset = 0 } = options;
    const docs = Array.from(index.documents.values());

    return {
      documents: docs.slice(offset, offset + limit),
      total: docs.length
    };
  }

  async deleteIndex(name) {
    this.indexes.delete(name);
    await fs.remove(path.join(this.searchDir, `${name}.json`)).catch(() => {});
    return { success: true };
  }

  listIndexes() {
    return Array.from(this.indexes.values()).map(i => ({
      name: i.name,
      fields: i.fields,
      documents: i.documents.size,
      createdAt: i.createdAt
    }));
  }

  calculateSimilarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(s1, s2) {
    const m = s1.length;
    const n = s2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = s1[i - 1] === s2[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }

    return dp[m][n];
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  async saveIndex(name) {
    const index = this.indexes.get(name);
    if (index) {
      const data = {
        ...index,
        documents: Object.fromEntries(index.documents)
      };
      await fs.writeJson(path.join(this.searchDir, `${name}.json`), data, { spaces: 2 });
    }
  }

  async fullTextSearch(query, options = {}) {
    const { limit = 50 } = options;
    const results = [];

    for (const [indexName] of this.indexes) {
      const searchResults = await this.search(indexName, query, { limit: 10 });
      results.push(...searchResults.results.map(r => ({ ...r, index: indexName })));
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  getSearchHistory(limit = 50) {
    return this.searchHistory.slice(-limit);
  }

  clearSearchHistory() {
    this.searchHistory = [];
    return { success: true };
  }

  async getStats() {
    let totalDocuments = 0;
    for (const [, index] of this.indexes) {
      totalDocuments += index.documents.size;
    }

    return {
      indexes: this.indexes.size,
      totalDocuments,
      searches: this.searchHistory.length
    };
  }
}

module.exports = SearchEngine;
