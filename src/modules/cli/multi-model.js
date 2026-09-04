/**
 * Multi-Model Engine — Pix AI
 * MoE routing, model chain, provider fallback
 * by Aghosh-mv · justcode
 */
const https = require('https');

const PROVIDERS = {
  openrouter: { host: 'openrouter.ai', path: '/api/v1/chat/completions', model: 'gpt-4o-mini' },
  groq:       { host: 'api.groq.com',  path: '/openai/v1/chat/completions',    model: 'llama3-8b-8192' },
  openai:     { host: 'api.openai.com', path: '/v1/chat/completions',    model: 'gpt-4o-mini' },
  gemini:     { host: 'generativelanguage.googleapis.com', path: '/v1beta/models/gemini-2.0-flash:generateContent', model: 'gemini-2.0-flash' },
  anthropic:  { host: 'api.anthropic.com', path: '/v1/messages',         model: 'claude-3-haiku-20240307' },
  mistral:    { host: 'api.mistral.ai', path: '/v1/chat/completions',    model: 'mistral-tiny' },
  glm:        { host: 'open.bigmodel.cn', path: '/api/paas/v4/chat/completions', model: 'glm-4-flash' },
};

const MOE_ROUTES = {
  code:    ['groq', 'openrouter', 'glm'],
  reason:  ['anthropic', 'openai', 'gemini'],
  speed:   ['groq', 'glm', 'openrouter'],
  general: ['glm', 'groq', 'openrouter'],
};

function detectTaskType(q) {
  q = q.toLowerCase();
  if (/\b(code|function|class|debug|fix|implement|refactor|write|bug)\b/.test(q)) return 'code';
  if (/\b(explain|why|how|think|reason|analyze|plan|design)\b/.test(q)) return 'reason';
  if (/\b(quick|fast|simple|what is|define)\b/.test(q)) return 'speed';
  return 'general';
}

class MultiModel {
  constructor(getConfig, getApiKey) {
    this.getConfig = getConfig;
    this.getApiKey = getApiKey;
  }

  getChain(query) {
    const c = this.getConfig();
    if (c.fallbackChain?.length > 0) return c.fallbackChain;
    if (c.models?.length > 0) return c.models;
    return MOE_ROUTES[detectTaskType(query)] || MOE_ROUTES.general;
  }

  call(provider, messages, cb) {
    const p = PROVIDERS[provider] || PROVIDERS.openrouter;
    const apiKey = this.getApiKey(provider);
    if (!apiKey) { cb(null, `${provider}: no api key`); return; }

    let postData;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };

    if (provider === 'gemini') {
      const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      postData = JSON.stringify({ contents, generationConfig: { maxOutputTokens: 2048 } });
    } else if (provider === 'anthropic') {
      const sys = messages.find(m => m.role === 'system')?.content || '';
      postData = JSON.stringify({ model: p.model, max_tokens: 2048, system: sys, messages: messages.filter(m => m.role !== 'system') });
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      delete headers['Authorization'];
    } else {
      postData = JSON.stringify({ model: p.model, messages, max_tokens: 2048 });
    }

    const req = https.request({ hostname: p.host, port: 443, path: p.path, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          let reply;
          if (provider === 'gemini') reply = json.candidates?.[0]?.content?.parts?.[0]?.text;
          else if (provider === 'anthropic') reply = json.content?.[0]?.text;
          else reply = json.choices?.[0]?.message?.content || json.error?.message;
          cb(reply || null, null);
        } catch (e) { cb(null, 'parse error'); }
      });
    });
    req.on('error', (e) => cb(null, `connection: ${e.message}`));
    req.write(postData);
    req.end();
  }

  askChain(messages, cb, idx = 0) {
    const chain = this.getChain(messages[messages.length - 1]?.content || '');
    if (idx >= chain.length) { cb(null, 'all providers failed'); return; }
    const provider = chain[idx];
    this.call(provider, messages, (reply, err) => {
      if (reply && !reply.startsWith('{red')) cb(reply, null, provider);
      else this.askChain(messages, cb, idx + 1);
    });
  }

  listProviders() {
    return Object.entries(PROVIDERS).map(([name, p]) => ({ name, model: p.model, hasKey: !!this.getApiKey(name) }));
  }
}

module.exports = MultiModel;
