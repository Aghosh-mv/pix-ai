const https = require('https');
const fs = require('fs');

class MultiProviderFailover {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = this.loadConfig();
    this.providers = [
      { id: 'openrouter', name: 'OpenRouter', host: 'openrouter.ai', path: '/api/v1/chat/completions', keyEnv: 'OPENROUTER_API_KEY' },
      { id: 'gemini', name: 'Google Gemini', host: 'generativelanguage.googleapis.com', path: '/v1beta/models/gemini-pro:generateContent', keyEnv: 'GEMINI_API_KEY' },
      { id: 'groq', name: 'Groq', host: 'api.groq.com', path: '/openai/v1/chat/completions', keyEnv: 'GROQ_API_KEY' },
      { id: 'openai', name: 'OpenAI', host: 'api.openai.com', path: '/v1/chat/completions', keyEnv: 'OPENAI_API_KEY' },
      { id: 'anthropic', name: 'Anthropic', host: 'api.anthropic.com', path: '/v1/messages', keyEnv: 'ANTHROPIC_API_KEY' },
      { id: 'mistral', name: 'Mistral', host: 'api.mistral.ai', path: '/v1/chat/completions', keyEnv: 'MISTRAL_API_KEY' }
    ];
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch (e) {}
    return {};
  }

  getKey(provider) {
    const envKey = provider.keyEnv;
    if (process.env[envKey]) return process.env[envKey];
    if (this.config.apiKeys && this.config.apiKeys[provider.id]) return this.config.apiKeys[provider.id];
    if (this.config.provider === provider.id && this.config.apiKey) return this.config.apiKey;
    return null;
  }

  getAvailableProviders() {
    return this.providers.filter(p => this.getKey(p));
  }

  async call(prompt, preferredProvider) {
    const available = this.getAvailableProviders();
    if (available.length === 0) return { error: 'No API keys configured. Run: pix config --set-key <key>' };

    let ordered = available;
    if (preferredProvider) {
      const pref = available.find(p => p.id === preferredProvider);
      if (pref) ordered = [pref, ...available.filter(p => p.id !== preferredProvider)];
    }

    for (const provider of ordered) {
      try {
        const result = await this._callProvider(provider, prompt);
        return { ...result, provider: provider.id };
      } catch (e) {
        continue;
      }
    }
    return { error: 'All providers failed' };
  }

  _callProvider(provider, prompt) {
    return new Promise((resolve, reject) => {
      const key = this.getKey(provider);
      const postData = JSON.stringify({
        model: this._getModel(provider),
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096
      });

      const options = {
        hostname: provider.host,
        port: 443,
        path: provider.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Bearer ${key}`
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.choices && json.choices[0]) {
              resolve({ text: json.choices[0].message.content, usage: json.usage });
            } else if (json.candidates && json.candidates[0]) {
              resolve({ text: json.candidates[0].content.parts[0].text });
            } else if (json.content && json.content[0]) {
              resolve({ text: json.content[0].text });
            } else {
              reject(new Error('Unexpected response'));
            }
          } catch (e) { reject(e); }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
      req.write(postData);
      req.end();
    });
  }

  _getModel(provider) {
    const models = {
      openrouter: 'openai/gpt-4o-mini',
      gemini: 'gemini-pro',
      groq: 'llama3-8b-8192',
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-haiku-20240307',
      mistral: 'mistral-small-latest'
    };
    return models[provider.id] || 'gpt-4o-mini';
  }
}

module.exports = MultiProviderFailover;
