const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class DatabaseEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.databases = new Map();
    this.collections = new Map();
    this.dbDir = path.join(os.homedir(), '.pix/database');
    this.indexes = new Map();
    this.queries = [];
  }

  async initialize() {
    this.logger.info('Initializing Database Engine...');
    await fs.ensureDir(this.dbDir);
    await this.loadDatabases();
    this.logger.info('Database Engine initialized');
  }

  async loadDatabases() {
    try {
      const files = await fs.readdir(this.dbDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const db = await fs.readJson(path.join(this.dbDir, file));
          this.databases.set(db.name, db);
        }
      }
    } catch (e) {}
  }

  async createDatabase(name, options = {}) {
    if (this.databases.has(name)) {
      throw new Error(`Database already exists: ${name}`);
    }

    const db = {
      id: uuidv4(),
      name,
      description: options.description || '',
      collections: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      size: 0,
      documentCount: 0
    };

    this.databases.set(name, db);
    await this.saveDatabase(db);

    this.logger.info(`Database created: ${name}`);
    return db;
  }

  async deleteDatabase(name) {
    const db = this.databases.get(name);
    if (!db) throw new Error(`Database not found: ${name}`);

    this.databases.delete(name);
    await fs.remove(path.join(this.dbDir, `${name}.json`)).catch(() => {});
    await fs.remove(path.join(this.dbDir, name)).catch(() => {});

    this.logger.info(`Database deleted: ${name}`);
    return { success: true };
  }

  async createCollection(dbName, collectionName, options = {}) {
    const db = this.databases.get(dbName);
    if (!db) throw new Error(`Database not found: ${dbName}`);

    const collection = {
      id: uuidv4(),
      name: collectionName,
      dbName,
      schema: options.schema || null,
      indexes: options.indexes || [],
      documentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.collections.push(collectionName);
    await this.saveDatabase(db);

    const collDir = path.join(this.dbDir, dbName, collectionName);
    await fs.ensureDir(collDir);

    this.collections.set(`${dbName}.${collectionName}`, collection);

    this.logger.info(`Collection created: ${dbName}.${collectionName}`);
    return collection;
  }

  async insert(dbName, collectionName, documents) {
    const key = `${dbName}.${collectionName}`;
    const coll = this.collections.get(key);

    if (!coll) throw new Error(`Collection not found: ${key}`);

    const docs = Array.isArray(documents) ? documents : [documents];
    const inserted = [];

    for (const doc of docs) {
      const newDoc = {
        _id: doc._id || uuidv4(),
        ...doc,
        _createdAt: new Date().toISOString(),
        _updatedAt: new Date().toISOString()
      };

      const filePath = path.join(this.dbDir, dbName, collectionName, `${newDoc._id}.json`);
      await fs.writeJson(filePath, newDoc, { spaces: 2 });

      inserted.push(newDoc);
      coll.documentCount++;
    }

    const db = this.databases.get(dbName);
    db.documentCount += inserted.length;
    db.updatedAt = new Date().toISOString();
    await this.saveDatabase(db);

    this.logger.info(`Inserted ${inserted.length} documents into ${key}`);
    return inserted;
  }

  async find(dbName, collectionName, query = {}, options = {}) {
    const key = `${dbName}.${collectionName}`;
    const collDir = path.join(this.dbDir, dbName, collectionName);

    if (!await fs.pathExists(collDir)) {
      return [];
    }

    const files = await fs.readdir(collDir);
    const { limit = 100, offset = 0, sort = null, projection = null } = options;

    let documents = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const doc = await fs.readJson(path.join(collDir, file));
          if (this.matchesQuery(doc, query)) {
            documents.push(doc);
          }
        } catch (e) {}
      }
    }

    if (sort) {
      const sortKey = Object.keys(sort)[0];
      const sortOrder = sort[sortKey];
      documents.sort((a, b) => {
        if (sortOrder === 1) return a[sortKey] > b[sortKey] ? 1 : -1;
        return a[sortKey] < b[sortKey] ? 1 : -1;
      });
    }

    const total = documents.length;
    documents = documents.slice(offset, offset + limit);

    if (projection) {
      documents = documents.map(doc => {
        const projected = {};
        for (const key of Object.keys(projection)) {
          if (projection[key]) {
            projected[key] = doc[key];
          }
        }
        projected._id = doc._id;
        return projected;
      });
    }

    return { documents, total, limit, offset };
  }

  async findOne(dbName, collectionName, query = {}) {
    const result = await this.find(dbName, collectionName, query, { limit: 1 });
    return result.documents[0] || null;
  }

  async findById(dbName, collectionName, id) {
    const filePath = path.join(this.dbDir, dbName, collectionName, `${id}.json`);
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
    return null;
  }

  async update(dbName, collectionName, query, update, options = {}) {
    const { documents } = await this.find(dbName, collectionName, query);
    const updated = [];

    for (const doc of documents) {
      const updatedDoc = {
        ...doc,
        ...update,
        _id: doc._id,
        _createdAt: doc._createdAt,
        _updatedAt: new Date().toISOString()
      };

      const filePath = path.join(this.dbDir, dbName, collectionName, `${doc._id}.json`);
      await fs.writeJson(filePath, updatedDoc, { spaces: 2 });
      updated.push(updatedDoc);
    }

    this.logger.info(`Updated ${updated.length} documents in ${dbName}.${collectionName}`);
    return { modified: updated.length, documents: updated };
  }

  async updateById(dbName, collectionName, id, update) {
    const doc = await this.findById(dbName, collectionName, id);
    if (!doc) throw new Error(`Document not found: ${id}`);

    const updatedDoc = {
      ...doc,
      ...update,
      _id: doc._id,
      _createdAt: doc._createdAt,
      _updatedAt: new Date().toISOString()
    };

    const filePath = path.join(this.dbDir, dbName, collectionName, `${id}.json`);
    await fs.writeJson(filePath, updatedDoc, { spaces: 2 });

    return updatedDoc;
  }

  async delete(dbName, collectionName, query) {
    const { documents } = await this.find(dbName, collectionName, query);
    let deleted = 0;

    for (const doc of documents) {
      const filePath = path.join(this.dbDir, dbName, collectionName, `${doc._id}.json`);
      await fs.remove(filePath).catch(() => {});
      deleted++;
    }

    this.logger.info(`Deleted ${deleted} documents from ${dbName}.${collectionName}`);
    return { deleted };
  }

  async deleteById(dbName, collectionName, id) {
    const filePath = path.join(this.dbDir, dbName, collectionName, `${id}.json`);
    const exists = await fs.pathExists(filePath);
    if (exists) {
      await fs.remove(filePath);
      return { deleted: 1 };
    }
    return { deleted: 0 };
  }

  async count(dbName, collectionName, query = {}) {
    const { total } = await this.find(dbName, collectionName, query, { limit: 0 });
    return total;
  }

  async aggregate(dbName, collectionName, pipeline) {
    const { documents } = await this.find(dbName, collectionName, {}, { limit: Infinity });

    let result = documents;

    for (const stage of pipeline) {
      if (stage.$match) {
        result = result.filter(doc => this.matchesQuery(doc, stage.$match));
      }

      if (stage.$group) {
        const groups = {};
        for (const doc of result) {
          const key = stage.$group._id
            ? this.resolveField(doc, stage.$group._id)
            : 'all';

          if (!groups[key]) groups[key] = [];
          groups[key].push(doc);
        }

        result = Object.entries(groups).map(([key, docs]) => {
          const grouped = { _id: key };
          for (const [field, accumulator] of Object.entries(stage.$group)) {
            if (field === '_id') continue;
            if (accumulator.$sum) grouped[field] = docs.length;
            if (accumulator.$avg) grouped[field] = docs.reduce((sum, d) => sum + (d[accumulator.$avg] || 0), 0) / docs.length;
            if (accumulator.$min) grouped[field] = Math.min(...docs.map(d => d[accumulator.$min] || Infinity));
            if (accumulator.$max) grouped[field] = Math.max(...docs.map(d => d[accumulator.$max] || -Infinity));
          }
          return grouped;
        });
      }

      if (stage.$sort) {
        const sortKey = Object.keys(stage.$sort)[0];
        const sortOrder = stage.$sort[sortKey];
        result.sort((a, b) => {
          if (sortOrder === 1) return a[sortKey] > b[sortKey] ? 1 : -1;
          return a[sortKey] < b[sortKey] ? 1 : -1;
        });
      }

      if (stage.$limit) {
        result = result.slice(0, stage.$limit);
      }

      if (stage.$skip) {
        result = result.slice(stage.$skip);
      }
    }

    return result;
  }

  matchesQuery(doc, query) {
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('$')) {
        if (key === '$and') {
          if (!value.every(q => this.matchesQuery(doc, q))) return false;
        }
        if (key === '$or') {
          if (!value.some(q => this.matchesQuery(doc, q))) return false;
        }
        continue;
      }

      const docValue = this.resolveField(doc, key);

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (value.$eq !== undefined && docValue !== value.$eq) return false;
        if (value.$ne !== undefined && docValue === value.$ne) return false;
        if (value.$gt !== undefined && docValue <= value.$gt) return false;
        if (value.$gte !== undefined && docValue < value.$gte) return false;
        if (value.$lt !== undefined && docValue >= value.$lt) return false;
        if (value.$lte !== undefined && docValue > value.$lte) return false;
        if (value.$in !== undefined && !value.$in.includes(docValue)) return false;
        if (value.$nin !== undefined && value.$nin.includes(docValue)) return false;
        if (value.$regex && !new RegExp(value.$regex).test(docValue)) return false;
      } else {
        if (docValue !== value) return false;
      }
    }
    return true;
  }

  resolveField(doc, path) {
    return path.split('.').reduce((obj, key) => obj?.[key], doc);
  }

  async createIndex(dbName, collectionName, field, options = {}) {
    const key = `${dbName}.${collectionName}`;
    const indexKey = `${key}.${field}`;

    this.indexes.set(indexKey, {
      field,
      unique: options.unique || false,
      sparse: options.sparse || false,
      createdAt: new Date().toISOString()
    });

    this.logger.info(`Index created: ${indexKey}`);
    return { success: true };
  }

  async getStats() {
    const stats = {
      databases: this.databases.size,
      collections: 0,
      documents: 0,
      indexes: this.indexes.size
    };

    for (const db of this.databases.values()) {
      stats.collections += db.collections.length;
      stats.documents += db.documentCount;
    }

    return stats;
  }

  async listDatabases() {
    return Array.from(this.databases.values());
  }

  async listCollections(dbName) {
    const db = this.databases.get(dbName);
    if (!db) throw new Error(`Database not found: ${dbName}`);

    const collections = [];
    for (const collName of db.collections) {
      const key = `${dbName}.${collName}`;
      const coll = this.collections.get(key);
      if (coll) {
        collections.push(coll);
      }
    }

    return collections;
  }

  async saveDatabase(db) {
    const filePath = path.join(this.dbDir, `${db.name}.json`);
    await fs.writeJson(filePath, db, { spaces: 2 });
  }

  async backup(dbName) {
    const backupDir = path.join(this.dbDir, 'backups', `${dbName}-${Date.now()}`);
    await fs.ensureDir(backupDir);

    const dbDir = path.join(this.dbDir, dbName);
    if (await fs.pathExists(dbDir)) {
      await fs.copy(dbDir, backupDir);
    }

    const db = this.databases.get(dbName);
    await fs.writeJson(path.join(backupDir, 'metadata.json'), db);

    this.logger.info(`Backup created: ${backupDir}`);
    return { path: backupDir, database: dbName };
  }
}

module.exports = DatabaseEngine;
