/**
 * Zero-Knowledge PII Masking — Pix AI
 * Strips sensitive data, replaces with crypto-secure tokens
 * before sending to ANY third-party API
 * by Aghosh-mv · justcode
 */
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

class PIIMasking {
  constructor() {
    this.key = crypto.randomBytes(32);
    this.tokenMap = new Map(); // token → original value
    this.reverseMap = new Map(); // original → token
    this.stats = { masked: 0, restored: 0 };
  }

  // ── Generate a deterministic token for a value ──
  tokenize(value) {
    if (this.reverseMap.has(value)) return this.reverseMap.get(value);

    // Create a fixed-length token: pii_ + hex
    const hash = crypto.createHmac('sha256', this.key).update(value).digest('hex').slice(0, 12);
    const type = this.classify(value);
    const token = `__[${type}_${hash}]__`;

    this.tokenMap.set(token, value);
    this.reverseMap.set(value, token);
    this.stats.masked++;
    return token;
  }

  // ── Classify PII type ──
  classify(value) {
    const v = value.trim();
    if (/^\+?[\d\s\-()]{7,15}$/.test(v)) return 'PHONE';
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)) return 'EMAIL';
    if (/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(v)) return 'CARD';
    if (/^\d{3}[\s-]?\d{2}[\s-]?\d{4}$/.test(v)) return 'SSN';
    if (/^(0x)?[0-9a-fA-F]{40}$/.test(v)) return 'ETH_ADDR';
    if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(v)) return 'BTC_ADDR';
    if (/^(sk-|pk-|key-|token-|bearer\s+)[a-zA-Z0-9_-]{10,}/i.test(v)) return 'API_KEY';
    if (/^ghp_[a-zA-Z0-9]{36}$/.test(v)) return 'GITHUB_TOKEN';
    if (/^xox[bpsa]-[a-zA-Z0-9-]+$/.test(v)) return 'SLACK_TOKEN';
    if (/^AKIA[A-Z0-9]{16}$/.test(v)) return 'AWS_KEY';
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v)) return 'IP';
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)) return 'UUID';
    if (/password\s*[:=]\s*\S+/i.test(v)) return 'PASSWORD';
    if (/secret\s*[:=]\s*\S+/i.test(v)) return 'SECRET';
    return 'PII';
  }

  // ── Mask all PII in a text string ──
  mask(text) {
    let masked = text;

    // Email addresses
    masked = masked.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (m) => this.tokenize(m));

    // Phone numbers
    masked = masked.replace(/\+?[\d][\d\s\-()]{6,14}\d/g, (m) => {
      if (m.length < 7) return m;
      return this.tokenize(m);
    });

    // Credit card numbers
    masked = masked.replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, (m) => this.tokenize(m));

    // SSN
    masked = masked.replace(/\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g, (m) => this.tokenize(m));

    // API keys (various formats)
    masked = masked.replace(/(sk-|pk-|key-|token-|bearer\s+)[a-zA-Z0-9_-]{10,}/gi, (m) => this.tokenize(m));
    masked = masked.replace(/ghp_[a-zA-Z0-9]{36}/g, (m) => this.tokenize(m));
    masked = masked.replace(/AKIA[A-Z0-9]{16}/g, (m) => this.tokenize(m));
    masked = masked.replace(/xox[bpsa]-[a-zA-Z0-9-]+/g, (m) => this.tokenize(m));

    // IP addresses
    masked = masked.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, (m) => this.tokenize(m));

    // UUIDs
    masked = masked.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, (m) => this.tokenize(m));

    // Passwords and secrets in code
    masked = masked.replace(/(password|passwd|pwd|secret|api[_-]?key|auth[_-]?token|access[_-]?token)\s*[:=]\s*['"`]?([^\s'"`,;)}\]]+)/gi, (m, key, val) => {
      return `${key} = ${this.tokenize(val)}`;
    });

    // AWS-style keys
    masked = masked.replace(/['"`]?(AKIA[A-Z0-9]{16})['"`]?/g, (m) => this.tokenize(m));

    // Private keys (PEM)
    masked = masked.replace(/-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |DSA )?PRIVATE KEY-----/g, (m) => this.tokenize(m));

    return masked;
  }

  // ── Restore tokens back to original values ──
  restore(text) {
    let restored = text;
    for (const [token, original] of this.tokenMap) {
      restored = restored.split(token).join(original);
    }
    this.stats.restored++;
    return restored;
  }

  // ── Mask an object (deep) ──
  maskObject(obj) {
    if (typeof obj === 'string') return this.mask(obj);
    if (Array.isArray(obj)) return obj.map(item => this.maskObject(item));
    if (typeof obj === 'object' && obj !== null) {
      const masked = {};
      for (const [key, val] of Object.entries(obj)) {
        // Mask key names that look sensitive
        const maskedKey = /password|secret|token|key|auth|credential/i.test(key) ? this.tokenize(key) : key;
        masked[maskedKey] = this.maskObject(val);
      }
      return masked;
    }
    return obj;
  }

  // ── Preprocess messages before sending to API ──
  maskMessages(messages) {
    return messages.map(m => ({
      ...m,
      content: typeof m.content === 'string' ? this.mask(m.content) : m.content,
    }));
  }

  // ── Get mapping for later restoration ──
  getMapping() {
    const map = {};
    for (const [token, original] of this.tokenMap) {
      map[token] = original;
    }
    return map;
  }

  // ── Import mapping (for shared sessions) ──
  importMapping(map) {
    for (const [token, original] of Object.entries(map)) {
      this.tokenMap.set(token, original);
      this.reverseMap.set(original, token);
    }
  }

  // ── Stats ──
  getStats() {
    return { ...this.stats, uniqueTokens: this.tokenMap.size };
  }

  // ── Check if text contains PII ──
  hasPII(text) {
    return (
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text) ||
      /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/.test(text) ||
      /(sk-|pk-|key-|token-)[a-zA-Z0-9_-]{10,}/i.test(text) ||
      /password\s*[:=]\s*\S+/i.test(text) ||
      /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/.test(text)
    );
  }

  // ── Scan text and report PII found ──
  scan(text) {
    const findings = [];
    const checks = [
      { type: 'EMAIL', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
      { type: 'PHONE', pattern: /\+?[\d][\d\s\-()]{6,14}\d/g },
      { type: 'CARD', pattern: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g },
      { type: 'SSN', pattern: /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g },
      { type: 'API_KEY', pattern: /(sk-|pk-|key-|token-)[a-zA-Z0-9_-]{10,}/gi },
      { type: 'PASSWORD', pattern: /password\s*[:=]\s*\S+/gi },
      { type: 'IP', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
      { type: 'AWS_KEY', pattern: /AKIA[A-Z0-9]{16}/g },
      { type: 'GITHUB_TOKEN', pattern: /ghp_[a-zA-Z0-9]{36}/g },
    ];

    checks.forEach(({ type, pattern }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        findings.push({ type, value: match[0].substring(0, 20) + '...', index: match.index });
      }
    });

    return findings;
  }
}

module.exports = PIIMasking;
