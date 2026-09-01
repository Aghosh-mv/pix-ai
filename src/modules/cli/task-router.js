/**
 * Task-Based Router — Pix AI
 * Routes cheap tasks to cheap models, hard tasks to powerful ones
 * by Aghosh-mv · justcode
 */

// Task complexity classifier
const TASK_PATTERNS = {
  // CHEAP tasks → use fast/cheap models
  cheap: [
    { pattern: /\b(hello|hi|hey|thanks|ok|yes|no|sure)\b/i, weight: 1 },
    { pattern: /\b(what is|define|meaning of|who is)\b/i, weight: 1 },
    { pattern: /\b(explain in simple|tldr|summarize briefly)\b/i, weight: 1 },
    { pattern: /\b(convert|translate|format|lint)\b/i, weight: 1 },
    { pattern: /\b(list|show|print|display)\b/i, weight: 1 },
    { pattern: /\b(good morning|how are you|bye)\b/i, weight: 1 },
    { pattern: /^.{0,50}$/, weight: 1 }, // short messages
  ],

  // MEDIUM tasks → use balanced models
  medium: [
    { pattern: /\b(write|create|generate|build)\b.*\b(function|class|module|component)\b/i, weight: 2 },
    { pattern: /\b(fix|debug|error|issue|bug)\b/i, weight: 2 },
    { pattern: /\b(refactor|improve|optimize|clean)\b/i, weight: 2 },
    { pattern: /\b(test|spec|assert|expect)\b/i, weight: 2 },
    { pattern: /\b(review|check|validate|verify)\b/i, weight: 2 },
    { pattern: /\b(document|readme|comment)\b/i, weight: 2 },
    { pattern: /^.{50,200}$/, weight: 2 }, // medium messages
  ],

  // HARD tasks → use powerful models
  hard: [
    { pattern: /\b(design|architecture|system|infrastructure)\b/i, weight: 3 },
    { pattern: /\b(security|vulnerability|exploit|encrypt|auth)\b/i, weight: 3 },
    { pattern: /\b(performance|benchmark|scale|distributed)\b/i, weight: 3 },
    { pattern: /\b(algorithm|complexity|data structure|graph|tree)\b/i, weight: 3 },
    { pattern: /\b(migration|upgrade|breaking change|backward)\b/i, weight: 3 },
    { pattern: /\b(implement|build).*(from scratch|complete|full)\b/i, weight: 3 },
    { pattern: /\b(analyze|reason|compare|evaluate|trade.?off)\b/i, weight: 3 },
    { pattern: /^.{200,}$/, weight: 3 }, // long detailed messages
  ],
};

// Model tiers
const MODEL_TIERS = {
  // Cheap: fast, low cost
  cheap: [
    { provider: 'groq', model: 'llama3-8b-8192', costPer1k: 0.00005 },
    { provider: 'openrouter', model: 'gpt-4o-mini', costPer1k: 0.00015 },
    { provider: 'mistral', model: 'mistral-tiny', costPer1k: 0.0001 },
  ],
  // Medium: balanced
  medium: [
    { provider: 'openrouter', model: 'gpt-4o-mini', costPer1k: 0.00015 },
    { provider: 'gemini', model: 'gemini-2.0-flash', costPer1k: 0.00025 },
    { provider: 'groq', model: 'llama3-70b-8192', costPer1k: 0.0005 },
  ],
  // Hard: powerful
  hard: [
    { provider: 'openai', model: 'gpt-4o', costPer1k: 0.005 },
    { provider: 'anthropic', model: 'claude-3-opus-20240229', costPer1k: 0.015 },
    { provider: 'openrouter', model: 'gpt-4o', costPer1k: 0.005 },
  ],
};

class TaskRouter {
  constructor(config) {
    this.config = config || {};
    this.stats = { cheap: 0, medium: 0, hard: 0, totalSaved: 0 };
  }

  // ── Classify task complexity ──
  classify(query) {
    let cheapScore = 0, mediumScore = 0, hardScore = 0;

    TASK_PATTERNS.cheap.forEach(t => { if (t.pattern.test(query)) cheapScore += t.weight; });
    TASK_PATTERNS.medium.forEach(t => { if (t.pattern.test(query)) mediumScore += t.weight; });
    TASK_PATTERNS.hard.forEach(t => { if (t.pattern.test(query)) hardScore += t.weight; });

    // Context boosts
    if (query.includes('?')) mediumScore += 0.5;
    if (/\b(this code|the function|the class|the file)\b/.test(query)) mediumScore += 1;
    if (/\b整个|全面|complete|full|comprehensive|thorough\b/i.test(query)) hardScore += 1;

    const max = Math.max(cheapScore, mediumScore, hardScore);
    if (max === 0) return 'medium'; // default
    if (hardScore === max) return 'hard';
    if (mediumScore === max) return 'medium';
    return 'cheap';
  }

  // ── Route to best model for task ──
  route(query, availableProviders = []) {
    const tier = this.classify(query);
    this.stats[tier]++;

    const models = MODEL_TIERS[tier];

    // Filter to available providers
    let candidates = models;
    if (availableProviders.length > 0) {
      candidates = models.filter(m => availableProviders.includes(m.provider));
      if (candidates.length === 0) candidates = models; // fallback to all
    }

    // Prefer user's configured provider
    if (this.config.provider) {
      const preferred = candidates.find(m => m.provider === this.config.provider);
      if (preferred) return { ...preferred, tier, reason: `configured provider + ${tier} task` };
    }

    // Pick cheapest available
    const sorted = candidates.sort((a, b) => a.costPer1k - b.costPer1k);
    return { ...sorted[0], tier, reason: `auto-routed ${tier} task` };
  }

  // ── Estimate cost ──
  estimateCost(query, model) {
    const tokens = Math.ceil(query.length / 4); // rough estimate
    const tier = this.classify(query);
    const m = MODEL_TIERS[tier].find(x => x.model === model) || MODEL_TIERS[tier][0];
    return { estimatedTokens: tokens, estimatedCost: (tokens / 1000) * m.costPer1k, tier };
  }

  // ── Get routing decision for display ──
  getRouting(query, availableProviders) {
    const decision = this.route(query, availableProviders);
    return {
      task: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
      tier: decision.tier,
      model: decision.model,
      provider: decision.provider,
      reason: decision.reason,
      estimatedCost: this.estimateCost(query, decision.model).estimatedCost,
    };
  }

  // ── Stats ──
  getStats() {
    const total = this.stats.cheap + this.stats.medium + this.stats.hard;
    return {
      ...this.stats,
      total,
      cheapPct: total > 0 ? Math.round(this.stats.cheap / total * 100) : 0,
      mediumPct: total > 0 ? Math.round(this.stats.medium / total * 100) : 0,
      hardPct: total > 0 ? Math.round(this.stats.hard / total * 100) : 0,
    };
  }
}

module.exports = TaskRouter;
