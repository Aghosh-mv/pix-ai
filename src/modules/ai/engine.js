const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const pRetry = require('p-retry');
const PQueue = require('p-queue');

class AIEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.providers = new Map();
    this.conversations = new Map();
    this.models = new Map();
    this.queue = new PQueue({ concurrency: 10 });
    this.eventEmitter = new EventEmitter();
    this.contextWindows = new Map();
    this.memory = new Map();
    this.embeddingCache = new Map();
    this.rateLimiters = new Map();
  }

  async initialize() {
    this.logger.info('Initializing AI Engine...');

    this.registerProvider('gemini', new GeminiProvider(this.config, this.logger));
    this.registerProvider('groq', new GroqProvider(this.config, this.logger));
    this.registerProvider('openrouter', new OpenRouterProvider(this.config, this.logger));
    this.registerProvider('zai', new ZAIProvider(this.config, this.logger));
    this.registerProvider('serp', new SERPProvider(this.config, this.logger));

    this.loadModels();
    this.logger.info('AI Engine initialized with providers:', Array.from(this.providers.keys()));
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }

  loadModels() {
    const defaultModels = [
      { id: 'gemini-pro', provider: 'gemini', name: 'Gemini Pro', maxTokens: 32768, supportsVision: true },
      { id: 'gemini-ultra', provider: 'gemini', name: 'Gemini Ultra', maxTokens: 100000, supportsVision: true },
      { id: 'gemini-nano', provider: 'gemini', name: 'Gemini Nano', maxTokens: 8192, supportsVision: false },
      { id: 'llama-3.3-70b', provider: 'groq', name: 'Llama 3.3 70B', maxTokens: 128000, supportsVision: false },
      { id: 'mixtral-8x7b', provider: 'groq', name: 'Mixtral 8x7B', maxTokens: 32768, supportsVision: false },
      { id: 'gemma2-9b', provider: 'groq', name: 'Gemma 2 9B', maxTokens: 8192, supportsVision: false },
      { id: 'claude-3.5-sonnet', provider: 'openrouter', name: 'Claude 3.5 Sonnet', maxTokens: 200000, supportsVision: true },
      { id: 'gpt-4o', provider: 'openrouter', name: 'GPT-4o', maxTokens: 128000, supportsVision: true },
      { id: 'gpt-4o-mini', provider: 'openrouter', name: 'GPT-4o Mini', maxTokens: 128000, supportsVision: true },
      { id: 'deepseek-coder', provider: 'openrouter', name: 'DeepSeek Coder', maxTokens: 128000, supportsVision: false },
      { id: 'zai-default', provider: 'zai', name: 'Z AI Default', maxTokens: 32768, supportsVision: true },
      { id: 'zai-code', provider: 'zai', name: 'Z AI Code', maxTokens: 64000, supportsVision: false }
    ];

    defaultModels.forEach(model => this.models.set(model.id, model));
  }

  async complete(params) {
    const {
      prompt,
      model = 'gemini-pro',
      systemPrompt,
      temperature = 0.7,
      maxTokens = 4096,
      conversationId,
      context = [],
      images = [],
      tools = []
    } = params;

    const modelInfo = this.models.get(model);
    if (!modelInfo) throw new Error(`Unknown model: ${model}`);

    const provider = this.providers.get(modelInfo.provider);
    if (!provider) throw new Error(`Unknown provider: ${modelInfo.provider}`);

    let fullContext = [...context];

    if (conversationId) {
      const conversation = this.conversations.get(conversationId) || [];
      fullContext = [...conversation, ...context];
    }

    const request = {
      model: modelInfo.id,
      messages: this.buildMessages(prompt, systemPrompt, fullContext),
      temperature,
      maxTokens: Math.min(maxTokens, modelInfo.maxTokens),
      images,
      tools
    };

    this.logger.info(`AI Complete: ${model} (${modelInfo.provider})`);

    const response = await this.queue.add(() =>
      pRetry(() => provider.complete(request), {
        retries: 3,
        onFailedAttempt: (attempt) => {
          this.logger.warn(`Attempt ${attempt.attemptNumber} failed: ${attempt.error.message}`);
        }
      })
    );

    if (conversationId) {
      const conversation = this.conversations.get(conversationId) || [];
      conversation.push({ role: 'user', content: prompt });
      conversation.push({ role: 'assistant', content: response.content });
      this.conversations.set(conversationId, conversation.slice(-100));
    }

    return response;
  }

  async stream(params) {
    const {
      prompt,
      model = 'gemini-pro',
      systemPrompt,
      temperature = 0.7,
      maxTokens = 4096,
      conversationId,
      context = [],
      images = []
    } = params;

    const modelInfo = this.models.get(model);
    if (!modelInfo) throw new Error(`Unknown model: ${model}`);

    const provider = this.providers.get(modelInfo.provider);
    if (!provider) throw new Error(`Unknown provider: ${modelInfo.provider}`);

    let fullContext = [...context];
    if (conversationId) {
      const conversation = this.conversations.get(conversationId) || [];
      fullContext = [...conversation, ...context];
    }

    const request = {
      model: modelInfo.id,
      messages: this.buildMessages(prompt, systemPrompt, fullContext),
      temperature,
      maxTokens: Math.min(maxTokens, modelInfo.maxTokens),
      images
    };

    return provider.stream(request);
  }

  async vision(params) {
    const {
      images,
      prompt = 'Describe what you see in this image',
      model = 'gemini-pro',
      detailed = false
    } = params;

    const modelInfo = this.models.get(model);
    if (!modelInfo) throw new Error(`Unknown model: ${model}`);
    if (!modelInfo.supportsVision) throw new Error(`Model ${model} does not support vision`);

    const provider = this.providers.get(modelInfo.provider);

    const request = {
      model: modelInfo.id,
      messages: [{ role: 'user', content: prompt }],
      images: Array.isArray(images) ? images : [images],
      detailed
    };

    return provider.vision(request);
  }

  buildMessages(prompt, systemPrompt, context) {
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    context.forEach(msg => {
      messages.push(msg);
    });

    messages.push({ role: 'user', content: prompt });

    return messages;
  }

  createConversation() {
    const id = uuidv4();
    this.conversations.set(id, []);
    return id;
  }

  getConversation(id) {
    return this.conversations.get(id) || [];
  }

  clearConversation(id) {
    this.conversations.delete(id);
  }

  async getAvailableModels() {
    return Array.from(this.models.values());
  }

  async setModel(modelId, config) {
    this.models.set(modelId, { ...this.models.get(modelId), ...config });
  }

  async getUsage() {
    const usage = {};
    for (const [name, provider] of this.providers) {
      if (provider.getUsage) {
        usage[name] = await provider.getUsage();
      }
    }
    return usage;
  }
}

class BaseProvider {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.requestCount = 0;
    this.totalTokens = 0;
  }

  getApiKey() {
    throw new Error('getApiKey must be implemented');
  }

  async complete(request) {
    throw new Error('complete must be implemented');
  }

  stream(request) {
    throw new Error('stream must be implemented');
  }

  async vision(request) {
    throw new Error('vision must be implemented');
  }

  getUsage() {
    return { requests: this.requestCount, tokens: this.totalTokens };
  }
}

class GeminiProvider extends BaseProvider {
  constructor(config, logger) {
    super(config, logger);
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  getApiKey() {
    return this.config.getApiKey('gemini');
  }

  async complete(request) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('Gemini API key not configured');

    const { model, messages, temperature, maxTokens, images } = request;
    const contents = this.formatMessages(messages);

    const payload = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 40
      }
    };

    if (images && images.length > 0) {
      payload.contents[0].parts = payload.contents[0].parts || [];
      images.forEach(img => {
        if (typeof img === 'string') {
          payload.contents[0].parts.push({
            inlineData: {
              mimeType: 'image/png',
              data: img
            }
          });
        } else {
          payload.contents[0].parts.push({
            inlineData: {
              mimeType: img.mimeType || 'image/png',
              data: img.data
            }
          });
        }
      });
    }

    const response = await axios.post(
      `${this.baseUrl}/models/${model}:generateContent?key=${apiKey}`,
      payload,
      { timeout: 120000 }
    );

    this.requestCount++;
    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    this.totalTokens += response.data.usageMetadata?.totalTokenCount || 0;

    return {
      content,
      model,
      usage: response.data.usageMetadata,
      finishReason: response.data.candidates?.[0]?.finishReason
    };
  }

  stream(request) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('Gemini API key not configured');

    const EventEmitter = require('events');
    const emitter = new EventEmitter();

    const { model, messages, temperature, maxTokens } = request;
    const contents = this.formatMessages(messages);

    const payload = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 40
      }
    };

    axios.post(
      `${this.baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
      payload,
      {
        timeout: 120000,
        responseType: 'stream'
      }
    ).then(response => {
      let buffer = '';
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                emitter.emit('data', text);
              }
            } catch (e) {}
          }
        });
      });
      response.data.on('end', () => emitter.emit('end'));
      response.data.on('error', (err) => emitter.emit('error', err));
    }).catch(err => emitter.emit('error', err));

    return emitter;
  }

  async vision(request) {
    return this.complete({ ...request, images: request.images });
  }

  formatMessages(messages) {
    const contents = [];
    let currentUser = [];

    messages.forEach(msg => {
      if (msg.role === 'system') {
        currentUser.push({ text: `System: ${msg.content}` });
      } else if (msg.role === 'user') {
        currentUser.push({ text: msg.content });
      } else if (msg.role === 'assistant') {
        if (currentUser.length > 0) {
          contents.push({ role: 'user', parts: currentUser });
          currentUser = [];
        }
        contents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    });

    if (currentUser.length > 0) {
      contents.push({ role: 'user', parts: currentUser });
    }

    return contents;
  }
}

class GroqProvider extends BaseProvider {
  constructor(config, logger) {
    super(config, logger);
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }

  getApiKey() {
    return this.config.getApiKey('groq');
  }

  async complete(request) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('Groq API key not configured');

    const { model, messages, temperature, maxTokens } = request;

    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: 0.9,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    this.requestCount++;
    this.totalTokens += response.data.usage?.total_tokens || 0;

    return {
      content: response.data.choices[0].message.content,
      model,
      usage: response.data.usage,
      finishReason: response.data.choices[0].finish_reason
    };
  }

  stream(request) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('Groq API key not configured');

    const emitter = new EventEmitter();

    const { model, messages, temperature, maxTokens } = request;

    axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: 0.9,
        stream: true
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000,
        responseType: 'stream'
      }
    ).then(response => {
      let buffer = '';
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(line => {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                emitter.emit('data', content);
              }
            } catch (e) {}
          }
        });
      });
      response.data.on('end', () => emitter.emit('end'));
      response.data.on('error', (err) => emitter.emit('error', err));
    }).catch(err => emitter.emit('error', err));

    return emitter;
  }

  async vision(request) {
    throw new Error('Groq does not support vision. Use Gemini or OpenRouter.');
  }
}

class OpenRouterProvider extends BaseProvider {
  constructor(config, logger) {
    super(config, logger);
    this.baseUrl = 'https://openrouter.ai/api/v1';
  }

  getApiKey() {
    return this.config.getApiKey('openrouter');
  }

  async complete(request) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('OpenRouter API key not configured');

    const { model, messages, temperature, maxTokens, images } = request;

    let formattedMessages = [...messages];

    if (images && images.length > 0) {
      const lastUserMsg = formattedMessages.findLast(m => m.role === 'user');
      if (lastUserMsg) {
        const content = [];
        if (typeof lastUserMsg.content === 'string') {
          content.push({ type: 'text', text: lastUserMsg.content });
        }
        images.forEach(img => {
          content.push({
            type: 'image_url',
            image_url: {
              url: typeof img === 'string' ? `data:image/png;base64,${img}` : img.url
            }
          });
        });
        lastUserMsg.content = content;
      }
    }

    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pix.app',
          'X-Title': 'Pix AI Harness'
        },
        timeout: 120000
      }
    );

    this.requestCount++;
    this.totalTokens += response.data.usage?.total_tokens || 0;

    return {
      content: response.data.choices[0].message.content,
      model,
      usage: response.data.usage,
      finishReason: response.data.choices[0].finish_reason
    };
  }

  stream(request) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('OpenRouter API key not configured');

    const emitter = new EventEmitter();
    const { model, messages, temperature, maxTokens } = request;

    axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pix.app',
          'X-Title': 'Pix AI Harness'
        },
        timeout: 120000,
        responseType: 'stream'
      }
    ).then(response => {
      let buffer = '';
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(line => {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                emitter.emit('data', content);
              }
            } catch (e) {}
          }
        });
      });
      response.data.on('end', () => emitter.emit('end'));
      response.data.on('error', (err) => emitter.emit('error', err));
    }).catch(err => emitter.emit('error', err));

    return emitter;
  }

  async vision(request) {
    return this.complete(request);
  }
}

class ZAIProvider extends BaseProvider {
  constructor(config, logger) {
    super(config, logger);
    this.baseUrl = 'https://api.z.ai/v1';
  }

  getApiKey() {
    return this.config.getApiKey('zai');
  }

  async complete(request) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('Z AI API key not configured');

    const { model, messages, temperature, maxTokens, images } = request;

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    };

    if (images && images.length > 0) {
      const lastUserMsg = payload.messages.findLast(m => m.role === 'user');
      if (lastUserMsg) {
        const content = [];
        if (typeof lastUserMsg.content === 'string') {
          content.push({ type: 'text', text: lastUserMsg.content });
        }
        images.forEach(img => {
          content.push({
            type: 'image_url',
            image_url: {
              url: typeof img === 'string' ? `data:image/png;base64,${img}` : img.url
            }
          });
        });
        lastUserMsg.content = content;
      }
    }

    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    this.requestCount++;
    this.totalTokens += response.data.usage?.total_tokens || 0;

    return {
      content: response.data.choices[0].message.content,
      model,
      usage: response.data.usage,
      finishReason: response.data.choices[0].finish_reason
    };
  }

  stream(request) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('Z AI API key not configured');

    const emitter = new EventEmitter();
    const { model, messages, temperature, maxTokens } = request;

    axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000,
        responseType: 'stream'
      }
    ).then(response => {
      let buffer = '';
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(line => {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                emitter.emit('data', content);
              }
            } catch (e) {}
          }
        });
      });
      response.data.on('end', () => emitter.emit('end'));
      response.data.on('error', (err) => emitter.emit('error', err));
    }).catch(err => emitter.emit('error', err));

    return emitter;
  }

  async vision(request) {
    return this.complete({ ...request, images: request.images });
  }
}

class SERPProvider extends BaseProvider {
  constructor(config, logger) {
    super(config, logger);
    this.baseUrl = 'https://serpapi.com/search';
  }

  getApiKey() {
    return this.config.getApiKey('serp');
  }

  async search(query, options = {}) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('SERP API key not configured');

    const params = {
      q: query,
      api_key: apiKey,
      engine: options.engine || 'google',
      num: options.num || 10,
      location: options.location,
      gl: options.country,
      hl: options.language,
      ...options
    };

    const response = await axios.get(this.baseUrl, { params, timeout: 30000 });
    this.requestCount++;

    return {
      organic: response.data.organic_results || [],
      knowledge: response.data.knowledge_graph,
      answerBox: response.data.answer_box,
      related: response.data.related_questions || [],
      suggestions: response.data.search_suggestions || [],
      totalResults: response.data.search_information?.total_results || 0
    };
  }

  async complete(request) {
    return this.search(request.messages?.[0]?.content || '');
  }

  stream(request) {
    const emitter = new EventEmitter();
    this.search(request.messages?.[0]?.content || '')
      .then(result => {
        emitter.emit('data', JSON.stringify(result));
        emitter.emit('end');
      })
      .catch(err => emitter.emit('error', err));
    return emitter;
  }

  async vision(request) {
    throw new Error('SERP does not support vision');
  }
}

module.exports = AIEngine;
