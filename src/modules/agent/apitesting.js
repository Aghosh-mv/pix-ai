const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class APITestingEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.collections = new Map();
    this.requests = new Map();
    this.environments = new Map();
    this.histories = new Map();
    this.apiDir = path.join(os.homedir(), '.pix/apitesting');

    this.httpMethods = [
      { id: 'GET', name: 'GET', color: '#61affe', description: 'Retrieve data' },
      { id: 'POST', name: 'POST', color: '#49cc90', description: 'Create data' },
      { id: 'PUT', name: 'PUT', color: '#fca130', description: 'Update data' },
      { id: 'PATCH', name: 'PATCH', color: '#50e3c2', description: 'Partial update' },
      { id: 'DELETE', name: 'DELETE', color: '#f93e3e', description: 'Delete data' },
      { id: 'HEAD', name: 'HEAD', color: '#9012fe', description: 'Get headers' },
      { id: 'OPTIONS', name: 'OPTIONS', color: '#0d5aa7', description: 'Get options' }
    ];

    this.authTypes = [
      { id: 'none', name: 'No Auth', icon: '🔓', fields: [] },
      { id: 'bearer', name: 'Bearer Token', icon: '🔑', fields: ['token'] },
      { id: 'basic', name: 'Basic Auth', icon: '🔐', fields: ['username', 'password'] },
      { id: 'oauth2', name: 'OAuth 2.0', icon: '🎫', fields: ['clientId', 'clientSecret', 'tokenUrl', 'scopes'] },
      { id: 'apikey', name: 'API Key', icon: '🗝️', fields: ['key', 'value', 'in'] },
      { id: 'jwt', name: 'JWT', icon: '🪪', fields: ['token'] },
      { id: 'hawk', name: 'Hawk', icon: '🦅', fields: ['id', 'key', 'algorithm'] },
      { id: 'aws', name: 'AWS Signature', icon: '☁️', fields: ['accessKey', 'secretKey', 'region', 'service'] }
    ];

    this.contentTypes = [
      { id: 'json', name: 'JSON', header: 'application/json', icon: '📋' },
      { id: 'xml', name: 'XML', header: 'application/xml', icon: '📄' },
      { id: 'form', name: 'Form Data', header: 'multipart/form-data', icon: '📝' },
      { id: 'urlencoded', name: 'URL Encoded', header: 'application/x-www-form-urlencoded', icon: '🔗' },
      { id: 'text', name: 'Plain Text', header: 'text/plain', icon: '📃' },
      { id: 'html', name: 'HTML', header: 'text/html', icon: '🌐' },
      { id: 'binary', name: 'Binary', header: 'application/octet-stream', icon: '💾' }
    ];

    this.testTypes = [
      { id: 'status', name: 'Status Code', icon: '📊', description: 'Check response status' },
      { id: 'header', name: 'Header', icon: '📋', description: 'Check response headers' },
      { id: 'body', name: 'Body', icon: '📦', description: 'Check response body' },
      { id: 'time', name: 'Response Time', icon: '⏱️', description: 'Check response time' },
      { id: 'schema', name: 'JSON Schema', icon: '📐', description: 'Validate JSON schema' },
      { id: 'regex', name: 'Regex Match', icon: '🔍', description: 'Regex pattern match' },
      { id: 'exists', name: 'Exists', icon: '✅', description: 'Check if value exists' },
      { id: 'type', name: 'Type Check', icon: '🔢', description: 'Check value type' }
    ];

    this.presetCollections = [
      { id: 'rest-api', name: 'REST API', icon: '🌐', description: 'Common REST endpoints' },
      { id: 'graphql', name: 'GraphQL', icon: '◈', description: 'GraphQL queries and mutations' },
      { id: 'websocket', name: 'WebSocket', icon: '🔌', description: 'WebSocket connections' },
      { id: 'grpc', name: 'gRPC', icon: '⚡', description: 'gRPC services' },
      { id: 'soap', name: 'SOAP', icon: '📜', description: 'SOAP web services' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing API Testing Engine...');
    await fs.ensureDir(this.apiDir);
    await fs.ensureDir(path.join(this.apiDir, 'collections'));
    await fs.ensureDir(path.join(this.apiDir, 'environments'));
    await this.loadData();
    this.loadSettings();
    this.logger.info('API Testing Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.apiDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.apiDir, file));
          if (data.type === 'collection') this.collections.set(data.id, data);
          else if (data.type === 'request') this.requests.set(data.id, data);
          else if (data.type === 'environment') this.environments.set(data.id, data);
          else if (data.type === 'history') this.histories.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadSettings() {
    this.settings = {
      defaultTimeout: 30000,
      followRedirects: true,
      validateSSL: true,
      proxyEnabled: false,
      proxyUrl: '',
      prettyPrint: true,
      autoSave: true,
      historySize: 100
    };
  }

  async createCollection(params) {
    const { name, description = '', requests = [], folders = [] } = params;

    const id = uuidv4();
    const collection = {
      id,
      name,
      description,
      requests,
      folders,
      auth: null,
      variables: {},
      type: 'collection',
      createdAt: new Date().toISOString()
    };

    this.collections.set(id, collection);
    await this.saveCollection(collection);

    return collection;
  }

  async createRequest(params) {
    const {
      collectionId = null,
      name,
      method = 'GET',
      url,
      headers = [],
      body = null,
      auth = null,
      params = [],
      tests = [],
      preRequestScript = null,
      variables = {}
    } = params;

    const id = uuidv4();
    const request = {
      id,
      collectionId,
      name,
      method,
      url,
      headers,
      body,
      auth,
      params,
      tests,
      preRequestScript,
      variables,
      type: 'request',
      createdAt: new Date().toISOString()
    };

    this.requests.set(id, request);

    if (collectionId) {
      const collection = this.collections.get(collectionId);
      if (collection) {
        collection.requests.push(id);
        this.collections.set(collectionId, collection);
        await this.saveCollection(collection);
      }
    }

    await this.saveRequest(request);

    return request;
  }

  async sendRequest(requestId, options = {}) {
    const request = this.requests.get(requestId);
    if (!request) throw new Error(`Request not found: ${requestId}`);

    const startTime = Date.now();
    const historyId = uuidv4();

    const history = {
      id: historyId,
      requestId,
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      status: 'sent',
      response: null,
      duration: 0,
      type: 'history',
      sentAt: new Date().toISOString()
    };

    this.histories.set(historyId, history);

    const response = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      duration: Math.floor(Math.random() * 500) + 100,
      size: 0
    };

    history.response = response;
    history.status = 'completed';
    history.duration = Date.now() - startTime;

    this.histories.set(historyId, history);
    await this.saveHistory(history);

    return history;
  }

  async addTest(requestId, test) {
    const request = this.requests.get(requestId);
    if (!request) throw new Error(`Request not found: ${requestId}`);

    const testEntry = {
      id: uuidv4(),
      ...test,
      type: 'test'
    };

    request.tests.push(testEntry);
    this.requests.set(requestId, request);
    await this.saveRequest(request);

    return testEntry;
  }

  async createEnvironment(params) {
    const { name, variables = [], isActive = false } = params;

    const id = uuidv4();
    const environment = {
      id,
      name,
      variables: variables.map(v => ({
        id: uuidv4(),
        key: v.key,
        value: v.value,
        type: v.type || 'default',
        enabled: v.enabled !== false
      })),
      isActive,
      type: 'environment',
      createdAt: new Date().toISOString()
    };

    this.environments.set(id, environment);
    await this.saveEnvironment(environment);

    return environment;
  }

  async getCollection(id) {
    return this.collections.get(id);
  }

  listCollections() {
    return Array.from(this.collections.values());
  }

  async getRequest(id) {
    return this.requests.get(id);
  }

  listRequests(collectionId = null) {
    let requests = Array.from(this.requests.values());
    if (collectionId) requests = requests.filter(r => r.collectionId === collectionId);
    return requests;
  }

  async getEnvironment(id) {
    return this.environments.get(id);
  }

  listEnvironments() {
    return Array.from(this.environments.values());
  }

  async getHistory(id) {
    return this.histories.get(id);
  }

  listHistory(limit = 100) {
    return Array.from(this.histories.values())
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
      .slice(0, limit);
  }

  getHTTPMethods() {
    return this.httpMethods;
  }

  getAuthTypes() {
    return this.authTypes;
  }

  getContentTypes() {
    return this.contentTypes;
  }

  getTestTypes() {
    return this.testTypes;
  }

  getPresetCollections() {
    return this.presetCollections;
  }

  async getStats() {
    const collections = Array.from(this.collections.values());
    const requests = Array.from(this.requests.values());
    const environments = Array.from(this.environments.values());
    const histories = Array.from(this.histories.values());

    return {
      collections: collections.length,
      requests: requests.length,
      environments: environments.length,
      historyCount: histories.length,
      successfulRequests: histories.filter(h => h.status === 'completed').length,
      failedRequests: histories.filter(h => h.status === 'failed').length
    };
  }

  async saveCollection(collection) {
    const filePath = path.join(this.apiDir, `collection-${collection.id}.json`);
    await fs.writeJson(filePath, collection, { spaces: 2 });
  }

  async saveRequest(request) {
    const filePath = path.join(this.apiDir, `request-${request.id}.json`);
    await fs.writeJson(filePath, request, { spaces: 2 });
  }

  async saveEnvironment(environment) {
    const filePath = path.join(this.apiDir, `env-${environment.id}.json`);
    await fs.writeJson(filePath, environment, { spaces: 2 });
  }

  async saveHistory(history) {
    const filePath = path.join(this.apiDir, `history-${history.id}.json`);
    await fs.writeJson(filePath, history, { spaces: 2 });
  }

  async exportAPI(format = 'json') {
    const data = {
      collections: Array.from(this.collections.values()),
      requests: Array.from(this.requests.values()),
      environments: Array.from(this.environments.values()),
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = APITestingEngine;
