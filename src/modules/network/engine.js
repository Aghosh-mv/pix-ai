const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class NetworkEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.eventEmitter = new EventEmitter();
    this.requests = new Map();
    this.websockets = new Map();
    this.webhooks = new Map();
    this.cache = new Map();
    this.rateLimiters = new Map();
    this.interceptors = [];
    this.baseUrl = null;
    this.defaultHeaders = {};
    this.networkDir = path.join(os.homedir(), '.pix/network');
  }

  async initialize() {
    this.logger.info('Initializing Network Engine...');
    await fs.ensureDir(this.networkDir);
    this.setupDefaultInterceptors();
    this.logger.info('Network Engine initialized');
  }

  setupDefaultInterceptors() {
    this.addInterceptor({
      name: 'logging',
      request: (config) => {
        const requestId = uuidv4();
        config.metadata = { ...config.metadata, requestId, startTime: Date.now() };
        this.requests.set(requestId, {
          url: config.url,
          method: config.method,
          startTime: Date.now(),
          status: 'pending'
        });
        return config;
      },
      response: (response) => {
        const requestId = response.config?.metadata?.requestId;
        if (requestId) {
          const req = this.requests.get(requestId);
          if (req) {
            req.status = 'completed';
            req.duration = Date.now() - req.startTime;
            req.statusCode = response.status;
          }
        }
        return response;
      },
      error: (error) => {
        const requestId = error.config?.metadata?.requestId;
        if (requestId) {
          const req = this.requests.get(requestId);
          if (req) {
            req.status = 'failed';
            req.duration = Date.now() - req.startTime;
            req.error = error.message;
          }
        }
        return Promise.reject(error);
      }
    });
  }

  addInterceptor(interceptor) {
    this.interceptors.push(interceptor);
  }

  removeInterceptor(name) {
    this.interceptors = this.interceptors.filter(i => i.name !== name);
  }

  setBaseUrl(url) {
    this.baseUrl = url;
  }

  setDefaultHeaders(headers) {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  async request(options) {
    const {
      method = 'GET',
      url,
      data = null,
      headers = {},
      params = {},
      timeout = 30000,
      retries = 3,
      retryDelay = 1000,
      cache = false,
      cacheTTL = 300,
      rateLimit = null
    } = options;

    const fullUrl = this.baseUrl ? `${this.baseUrl}${url}` : url;

    if (cache) {
      const cacheKey = `${method}:${fullUrl}:${JSON.stringify(params)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit: ${cacheKey}`);
        return cached;
      }
    }

    if (rateLimit) {
      await this.checkRateLimit(rateLimit);
    }

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        let config = {
          method,
          url: fullUrl,
          data,
          headers: { ...this.defaultHeaders, ...headers },
          params,
          timeout
        };

        for (const interceptor of this.interceptors) {
          if (interceptor.request) {
            config = interceptor.request(config);
          }
        }

        let response = await axios(config);

        for (const interceptor of this.interceptors) {
          if (interceptor.response) {
            response = interceptor.response(response);
          }
        }

        if (cache) {
          const cacheKey = `${method}:${fullUrl}:${JSON.stringify(params)}`;
          this.setCache(cacheKey, response.data, cacheTTL);
        }

        this.eventEmitter.emit('request:success', {
          url: fullUrl,
          method,
          status: response.status,
          duration: Date.now() - (config.metadata?.startTime || Date.now())
        });

        return response.data;
      } catch (error) {
        lastError = error;

        for (const interceptor of this.interceptors) {
          if (interceptor.error) {
            try {
              await interceptor.error(error);
            } catch (e) {}
          }
        }

        this.eventEmitter.emit('request:error', {
          url: fullUrl,
          method,
          error: error.message,
          attempt
        });

        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }

    throw lastError;
  }

  async get(url, options = {}) {
    return this.request({ ...options, method: 'GET', url });
  }

  async post(url, data, options = {}) {
    return this.request({ ...options, method: 'POST', url, data });
  }

  async put(url, data, options = {}) {
    return this.request({ ...options, method: 'PUT', url, data });
  }

  async patch(url, data, options = {}) {
    return this.request({ ...options, method: 'PATCH', url, data });
  }

  async delete(url, options = {}) {
    return this.request({ ...options, method: 'DELETE', url });
  }

  async download(url, options = {}) {
    const { destination, onProgress } = options;
    const response = await this.request({
      ...options,
      method: 'GET',
      url,
      responseType: 'stream'
    });

    if (destination) {
      const writer = fs.createWriteStream(destination);
      response.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve({ destination, size: writer.bytesWritten }));
        writer.on('error', reject);
      });
    }

    return response;
  }

  async upload(url, filePath, options = {}) {
    const { fieldName = 'file', additionalData = {} } = options;
    const formData = new FormData();

    const fileBuffer = await fs.readFile(filePath);
    const blob = new Blob([fileBuffer]);
    formData.append(fieldName, blob, path.basename(filePath));

    for (const [key, value] of Object.entries(additionalData)) {
      formData.append(key, value);
    }

    return this.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...options
    });
  }

  getFromCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  setCache(key, value, ttl = 300) {
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: ttl ? Date.now() + (ttl * 1000) : null
    });
  }

  clearCache(pattern = null) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  async checkRateLimit(name) {
    const limiter = this.rateLimiters.get(name);
    if (!limiter) return;

    const now = Date.now();
    const windowStart = now - limiter.windowMs;

    limiter.requests = limiter.requests.filter(time => time > windowStart);

    if (limiter.requests.length >= limiter.maxRequests) {
      const waitTime = limiter.requests[0] + limiter.windowMs - now;
      this.logger.warn(`Rate limit reached for ${name}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    limiter.requests.push(now);
  }

  addRateLimiter(name, options) {
    this.rateLimiters.set(name, {
      maxRequests: options.maxRequests || 100,
      windowMs: options.windowMs || 60000,
      requests: []
    });
  }

  removeRateLimiter(name) {
    this.rateLimiters.delete(name);
  }

  createWebSocket(url, options = {}) {
    const wsId = uuidv4();
    const ws = {
      id: wsId,
      url,
      options,
      connected: false,
      messages: [],
      eventEmitter: new EventEmitter()
    };

    this.websockets.set(wsId, ws);
    return ws;
  }

  createWebhook(options) {
    const { url, events, secret, handler } = options;
    const webhookId = uuidv4();

    const webhook = {
      id: webhookId,
      url,
      events,
      secret,
      handler,
      active: true,
      createdAt: new Date().toISOString(),
      deliveries: []
    };

    this.webhooks.set(webhookId, webhook);
    this.logger.info(`Webhook created: ${webhookId}`);
    return webhook;
  }

  async triggerWebhook(webhookId, event, data) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook || !webhook.active) return;

    const delivery = {
      id: uuidv4(),
      event,
      data,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    try {
      await this.post(webhook.url, {
        event,
        data,
        webhookId,
        timestamp: delivery.timestamp
      }, {
        headers: webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : {}
      });

      delivery.status = 'success';
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error.message;
    }

    webhook.deliveries.push(delivery);
    if (webhook.deliveries.length > 100) {
      webhook.deliveries = webhook.deliveries.slice(-100);
    }

    return delivery;
  }

  getRequestHistory(limit = 100) {
    return Array.from(this.requests.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  getStats() {
    const requests = Array.from(this.requests.values());
    const completed = requests.filter(r => r.status === 'completed');
    const failed = requests.filter(r => r.status === 'failed');

    return {
      totalRequests: requests.length,
      completed: completed.length,
      failed: failed.length,
      averageDuration: completed.length > 0
        ? completed.reduce((sum, r) => sum + (r.duration || 0), 0) / completed.length
        : 0,
      cacheSize: this.cache.size,
      webhooks: this.webhooks.size,
      rateLimiters: this.rateLimiters.size
    };
  }

  async healthCheck(url) {
    try {
      const start = Date.now();
      await this.get(url, { timeout: 5000, retries: 1 });
      return {
        status: 'healthy',
        url,
        latency: Date.now() - start,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        url,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async ping(host, options = {}) {
    const { count = 4, interval = 1000 } = options;
    const results = [];

    for (let i = 0; i < count; i++) {
      const start = Date.now();
      try {
        await this.get(`http://${host}`, { timeout: 5000, retries: 1 });
        results.push({
          seq: i + 1,
          latency: Date.now() - start,
          status: 'success'
        });
      } catch (error) {
        results.push({
          seq: i + 1,
          latency: Date.now() - start,
          status: 'failed',
          error: error.message
        });
      }

      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    const successful = results.filter(r => r.status === 'success');
    return {
      host,
      results,
      stats: {
        sent: count,
        received: successful.length,
        loss: count - successful.length,
        minLatency: successful.length > 0 ? Math.min(...successful.map(r => r.latency)) : null,
        maxLatency: successful.length > 0 ? Math.max(...successful.map(r => r.latency)) : null,
        avgLatency: successful.length > 0
          ? successful.reduce((sum, r) => sum + r.latency, 0) / successful.length
          : null
      }
    };
  }

  async dnsLookup(domain) {
    const dns = require('dns').promises;
    try {
      const addresses = await dns.resolve4(domain);
      return { domain, addresses, type: 'A' };
    } catch (e) {
      try {
        const addresses = await dns.resolve6(domain);
        return { domain, addresses, type: 'AAAA' };
      } catch (e2) {
        return { domain, addresses: [], error: e2.message };
      }
    }
  }

  async getPublicIP() {
    try {
      const data = await this.get('https://api.ipify.org?format=json');
      return data.ip;
    } catch (e) {
      return null;
    }
  }

  async getGeolocation(ip) {
    try {
      return await this.get(`http://ip-api.com/json/${ip}`);
    } catch (e) {
      return null;
    }
  }
}

module.exports = NetworkEngine;
