/**
 * Model-Aware Content Filter — Pix AI
 * Uncensored API keys pass through as-is
 * Content filtering varies by model
 * by Aghosh-mv · justcode
 */

// Model censorship profiles
const MODEL_PROFILES = {
  // Strict: filters everything
  claude: {
    name: 'Anthropic Claude',
    level: 'strict',
    blocked: /\b(kill|murder|bomb|weapon|illegal drug manufacturing|child.?abuse|snuff)\b/gi,
    sensitive: /\b(blood|death|violence|gore|torture|nsfw|porn|sex|nude)\b/gi,
    allowed: /\b(damn|hell|crap|ass(?:hole)?|shit|fuck(?:ing|ed|er)?)\b/gi, // these pass
    note: 'Claude blocks harm content but allows profanity',
  },

  // Balanced: some filtering
  openai: {
    name: 'OpenAI GPT',
    level: 'balanced',
    blocked: /\b(child.?abuse|snuff|chemical weapon|bioweapon)\b/gi,
    sensitive: /\b(nsfw|porn|explicit sexual|graphic violence)\b/gi,
    allowed: /\b(kill|death|blood|violence|damn|hell|shit|fuck)\b/gi,
    note: 'OpenAI blocks CSAM/bioweapons, allows fiction violence',
  },

  // Loose: minimal filtering
  groq: {
    name: 'Groq (Llama)',
    level: 'loose',
    blocked: /\b(child.?exploitation|bioweapon)\b/gi,
    sensitive: /\b(graphic sexual|extreme gore)\b/gi,
    allowed: /\b(kill|death|blood|violence|sex|porn|nude|drug|weapon|bomb|shit|fuck)\b/gi,
    note: 'Groq/Llama is minimally filtered',
  },

  // Uncensored: no filtering
  openrouter: {
    name: 'OpenRouter (varies)',
    level: 'uncensored',
    blocked: /\b(child.?exploitation)\b/gi, // only illegal
    sensitive: new RegExp('NEVER_MATCH'), // nothing blocked
    allowed: /\b.+\b/gi, // everything allowed
    note: 'OpenRouter passes through uncensored for many models',
  },

  mistral: {
    name: 'Mistral',
    level: 'loose',
    blocked: /\b(child.?exploitation)\b/gi,
    sensitive: /\b(extreme graphic sexual)\b/gi,
    allowed: /\b(kill|death|blood|violence|sex|drug|weapon|shit|fuck)\b/gi,
    note: 'Mistral is relatively open',
  },

  gemini: {
    name: 'Google Gemini',
    level: 'balanced',
    blocked: /\b(child.?abuse|bioweapon|chemical weapon)\b/gi,
    sensitive: /\b(nsfw|porn|explicit sexual|graphic violence)\b/gi,
    allowed: /\b(kill|death|blood|violence|damn|hell|shit)\b/gi,
    note: 'Gemini has Google safety filters',
  },
};

class ContentFilter {
  constructor(model = 'openrouter') {
    this.model = model;
    this.profile = MODEL_PROFILES[model] || MODEL_PROFILES.openrouter;
    this.customBlock = null;
    this.onFlag = null; // callback
  }

  // ── Set model ──
  setModel(model) {
    this.model = model;
    this.profile = MODEL_PROFILES[model] || MODEL_PROFILES.openrouter;
  }

  // ── Check content against model's filter ──
  check(text) {
    const result = { safe: true, blocked: false, flagged: false, reasons: [] };

    // Check blocked patterns
    if (this.profile.blocked.test(text)) {
      result.blocked = true;
      result.safe = false;
      result.reasons.push('contains blocked content');
    }

    // Check sensitive patterns
    if (this.profile.sensitive.test(text)) {
      result.flagged = true;
      result.reasons.push('contains sensitive content');
    }

    // Check custom block
    if (this.customBlock && this.customBlock.test(text)) {
      result.blocked = true;
      result.safe = false;
      result.reasons.push('custom filter triggered');
    }

    if (this.onFlag && (result.blocked || result.flagged)) {
      this.onFlag(text, result);
    }

    return result;
  }

  // ── Filter text: return safe version ──
  filter(text) {
    const check = this.check(text);
    if (check.safe) return { text, filtered: false };

    if (check.blocked) {
      return {
        text: '[BLOCKED: content violates model safety policy]',
        filtered: true,
        reason: check.reasons.join(', '),
      };
    }

    if (check.flagged) {
      // Soft filter: keep but flag
      return {
        text: `[FLAGGED: ${check.reasons.join(', ')}]\n${text}`,
        filtered: true,
        soft: true,
      };
    }

    return { text, filtered: false };
  }

  // ── Filter messages before sending to API ──
  filterMessages(messages) {
    return messages.map(m => {
      if (typeof m.content !== 'string') return m;
      const result = this.filter(m.content);
      return { ...m, content: result.text };
    });
  }

  // ── API keys pass through NEVER censored ──
  // This is critical: API keys, tokens, credentials are NEVER filtered
  sanitizeForAPI(text, apiKey) {
    // API key stays as-is - zero knowledge masking handles PII separately
    // This method just ensures the key isn't accidentally filtered
    let sanitized = text;

    // Remove API key from any content before filtering
    if (apiKey) {
      sanitized = sanitized.split(apiKey).join('[API_KEY]');
    }

    // Apply content filter
    const filtered = this.filter(sanitized);

    // Restore API key
    if (apiKey) {
      filtered.text = filtered.text.split('[API_KEY]').join(apiKey);
    }

    return filtered;
  }

  // ── Set custom filter ──
  setCustomFilter(pattern) {
    this.customBlock = pattern;
  }

  // ── Get profile info ──
  getProfile() {
    return {
      model: this.model,
      name: this.profile.name,
      level: this.profile.level,
      note: this.profile.note,
    };
  }

  // ── List all profiles ──
  static listProfiles() {
    return Object.entries(MODEL_PROFILES).map(([key, val]) => ({
      id: key, name: val.name, level: val.level, note: val.note,
    }));
  }

  // ── Uncensored mode: disable all filtering ──
  setUncensored(enabled) {
    if (enabled) {
      this.profile = {
        ...this.profile,
        level: 'uncensored',
        blocked: new RegExp('NEVER_MATCH'),
        sensitive: new RegExp('NEVER_MATCH'),
        allowed: /\b.+\b/gi,
      };
    } else {
      this.profile = MODEL_PROFILES[this.model] || MODEL_PROFILES.openrouter;
    }
  }

  // ── Stats ──
  getStats() {
    return {
      model: this.model,
      level: this.profile.level,
      hasCustomFilter: !!this.customBlock,
    };
  }
}

module.exports = ContentFilter;
