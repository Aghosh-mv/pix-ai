const fs = require('fs');
const path = require('path');

class SelfRewriteEngine {
  constructor(pixHome) {
    this.rewritesDir = path.join(pixHome, 'rewrites');
    this.profileFile = path.join(pixHome, 'ai-profile.json');
    this.rulesFile = path.join(pixHome, 'rewrite-rules.json');
    if (!fs.existsSync(this.rewritesDir)) fs.mkdirSync(this.rewritesDir, { recursive: true });
  }

  loadProfile() {
    try {
      if (fs.existsSync(this.profileFile)) return JSON.parse(fs.readFileSync(this.profileFile, 'utf8'));
    } catch (e) {}
    return {
      personality: 'helpful',
      verbosity: 'concise',
      responseStyle: 'technical',
      priorities: ['accuracy', 'speed', 'completeness'],
      customTraits: [],
      thinkingDepth: 'standard',
      codeStyle: 'clean',
      explanationLevel: 'moderate'
    };
  }

  saveProfile(profile) {
    fs.writeFileSync(this.profileFile, JSON.stringify(profile, null, 2));
  }

  loadRules() {
    try {
      if (fs.existsSync(this.rulesFile)) return JSON.parse(fs.readFileSync(this.rulesFile, 'utf8'));
    } catch (e) {}
    return { rules: [], version: 1, immutable: ['safety', 'guardrails', 'content-filter'] };
  }

  saveRules(rules) {
    fs.writeFileSync(this.rulesFile, JSON.stringify(rules, null, 2));
  }

  rewriteProfile(changes) {
    const profile = this.loadProfile();
    const before = { ...profile };
    Object.assign(profile, changes);
    this.saveProfile(profile);

    const rewrite = {
      timestamp: new Date().toISOString(),
      type: 'profile-rewrite',
      before,
      after: profile,
      changes
    };
    this.logRewrite(rewrite);
    return { success: true, profile };
  }

  addPersonalityTrait(trait) {
    const profile = this.loadProfile();
    if (!profile.customTraits.includes(trait)) {
      profile.customTraits.push(trait);
      this.saveProfile(profile);
    }
    return profile;
  }

  removePersonalityTrait(trait) {
    const profile = this.loadProfile();
    profile.customTraits = profile.customTraits.filter(t => t !== trait);
    this.saveProfile(profile);
    return profile;
  }

  setThinkingDepth(depth) {
    const valid = ['minimal', 'standard', 'deep', 'exhaustive'];
    if (!valid.includes(depth)) return { error: 'Invalid depth' };
    const profile = this.loadProfile();
    profile.thinkingDepth = depth;
    this.saveProfile(profile);
    return profile;
  }

  setCodeStyle(style) {
    const valid = ['clean', 'compact', 'verbose', 'functional', 'oop'];
    if (!valid.includes(style)) return { error: 'Invalid style' };
    const profile = this.loadProfile();
    profile.codeStyle = style;
    this.saveProfile(profile);
    return profile;
  }

  addRule(rule) {
    const rules = this.loadRules();
    if (rules.immutable.includes(rule.category)) {
      return { error: `Cannot modify immutable rule: ${rule.category}` };
    }
    rules.rules.push({
      id: Date.now().toString(36),
      ...rule,
      created: new Date().toISOString()
    });
    rules.version++;
    this.saveRules(rules);
    return { success: true, rule };
  }

  removeRule(ruleId) {
    const rules = this.loadRules();
    rules.rules = rules.rules.filter(r => r.id !== ruleId);
    rules.version++;
    this.saveRules(rules);
    return { success: true };
  }

  listRules() {
    return this.loadRules();
  }

  getSystemPrompt() {
    const profile = this.loadProfile();
    const traits = profile.customTraits.length > 0 ? `\nCustom traits: ${profile.customTraits.join(', ')}` : '';
    return `You are Pix AI. Personality: ${profile.personality}. Verbosity: ${profile.verbosity}. Response style: ${profile.responseStyle}. Thinking depth: ${profile.thinkingDepth}. Code style: ${profile.codeStyle}. Explanation level: ${profile.explanationLevel}. Priorities: ${profile.priorities.join(', ')}.${traits}`;
  }

  logRewrite(rewrite) {
    const file = path.join(this.rewritesDir, `${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(rewrite, null, 2));
  }

  getRewriteHistory() {
    const files = fs.readdirSync(this.rewritesDir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(this.rewritesDir, f), 'utf8')); } catch (e) { return null; }
    }).filter(Boolean).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  resetProfile() {
    const defaultProfile = {
      personality: 'helpful', verbosity: 'concise', responseStyle: 'technical',
      priorities: ['accuracy', 'speed', 'completeness'], customTraits: [],
      thinkingDepth: 'standard', codeStyle: 'clean', explanationLevel: 'moderate'
    };
    this.saveProfile(defaultProfile);
    return defaultProfile;
  }
}

module.exports = SelfRewriteEngine;
