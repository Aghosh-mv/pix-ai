/**
 * Credential Vault — Pix AI
 * Stores email/password encrypted, auto-login to safe apps only
 * by Aghosh-mv · justcode
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const VAULT_FILE = path.join(os.homedir(), '.pix', 'vault.json');
const SAFE_APPS = [
  'github.com', 'gitlab.com', 'bitbucket.org',
  'vercel.com', 'netlify.com', 'railway.app', 'render.com',
  'npmjs.com', 'pypi.org', 'rubygems.org',
  'supabase.com', 'firebase.google.com', 'aws.amazon.com',
  'cloudflare.com', 'digitalocean.com', 'heroku.com',
  'stripe.com', 'postman.com', 'linear.app',
  'notion.so', 'figma.com', 'slack.com',
  'openai.com', 'anthropic.com', 'openrouter.ai',
  'huggingface.co', 'replicate.com',
];

class CredentialVault {
  constructor() {
    this.key = this.deriveKey();
    this.creds = this.load();
  }

  deriveKey() {
    const seed = os.hostname() + os.userInfo().username + 'pix-vault-2024';
    return crypto.scryptSync(seed, 'pix-salt', 32);
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
    let enc = cipher.update(text, 'utf8', 'hex');
    enc += cipher.final('hex');
    return iv.toString('hex') + ':' + enc;
  }

  decrypt(data) {
    try {
      const [ivHex, enc] = data.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
      let dec = decipher.update(enc, 'hex', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    } catch (e) { return null; }
  }

  load() {
    try { return JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8')); } catch (e) { return { accounts: [] }; }
  }

  save() { fs.writeFileSync(VAULT_FILE, JSON.stringify(this.creds, null, 2)); }

  isSafe(domain) {
    return SAFE_APPS.some(d => domain.includes(d));
  }

  add(domain, email, password) {
    if (!this.isSafe(domain)) return { ok: false, reason: 'unsafe app' };
    const existing = this.creds.accounts.find(a => a.domain === domain && a.email === email);
    if (existing) {
      existing.password = this.encrypt(password);
    } else {
      this.creds.accounts.push({ domain, email, password: this.encrypt(password), added: new Date().toISOString() });
    }
    this.save();
    return { ok: true };
  }

  get(domain) {
    const acc = this.creds.accounts.find(a => a.domain === domain);
    if (!acc) return null;
    return { domain: acc.domain, email: acc.email, password: this.decrypt(acc.password) };
  }

  getByEmail(email) {
    return this.creds.accounts.filter(a => a.email === email).map(a => ({
      domain: a.domain, email: a.email, password: this.decrypt(a.password),
    }));
  }

  list() {
    return this.creds.accounts.map(a => ({ domain: a.domain, email: a.email, added: a.added }));
  }

  remove(domain, email) {
    this.creds.accounts = this.creds.accounts.filter(a => !(a.domain === domain && a.email === email));
    this.save();
    return true;
  }

  // Auto-login: returns credentials for a domain if safe + stored
  autoLogin(domain) {
    if (!this.isSafe(domain)) return null;
    return this.get(domain);
  }
}

module.exports = CredentialVault;
