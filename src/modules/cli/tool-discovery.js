/**
 * Auto Tool Discovery — Pix AI
 * AI finds & uses apps when stuck, auto-login to safe apps
 * by Aghosh-mv · justcode
 */
const { execSync } = require('child_process');
const https = require('https');

const APP_REGISTRY = [
  { name: 'curl', type: 'http', install: { mac: 'brew install curl', linux: 'apt install curl', win: 'choco install curl' } },
  { name: 'jq', type: 'json', install: { mac: 'brew install jq', linux: 'apt install jq', win: 'choco install jq' } },
  { name: 'ffmpeg', type: 'media', install: { mac: 'brew install ffmpeg', linux: 'apt install ffmpeg', win: 'choco install ffmpeg' } },
  { name: 'sqlite3', type: 'database', install: { mac: 'brew install sqlite3', linux: 'apt install sqlite3', win: 'choco install sqlite' } },
  { name: 'python3', type: 'runtime', install: { mac: 'brew install python3', linux: 'apt install python3', win: 'choco install python3' } },
  { name: 'node', type: 'runtime', install: { mac: 'brew install node', linux: 'apt install nodejs', win: 'choco install nodejs' } },
  { name: 'git', type: 'vcs', install: { mac: 'brew install git', linux: 'apt install git', win: 'choco install git' } },
  { name: 'docker', type: 'container', install: { mac: 'brew install --cask docker', linux: 'apt install docker.io', win: 'choco install docker-desktop' } },
  { name: 'rg', type: 'search', install: { mac: 'brew install ripgrep', linux: 'apt install ripgrep', win: 'choco install ripgrep' } },
  { name: 'fzf', type: 'search', install: { mac: 'brew install fzf', linux: 'apt install fzf', win: 'choco install fzf' } },
  { name: 'tree', type: 'display', install: { mac: 'brew install tree', linux: 'apt install tree', win: 'choco install tree' } },
  { name: 'wget', type: 'http', install: { mac: 'brew install wget', linux: 'apt install wget', win: 'choco install wget' } },
];

const WEBAPPS = [
  { name: 'github', domain: 'github.com', api: true, safe: true },
  { name: 'vercel', domain: 'vercel.com', api: true, safe: true },
  { name: 'netlify', domain: 'netlify.com', api: true, safe: true },
  { name: 'npm', domain: 'npmjs.com', api: true, safe: true },
  { name: 'supabase', domain: 'supabase.com', api: true, safe: true },
  { name: 'openai', domain: 'openai.com', api: true, safe: true },
  { name: 'anthropic', domain: 'anthropic.com', api: true, safe: true },
];

class ToolDiscovery {
  constructor(vault) {
    this.vault = vault;
    this.platform = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux';
  }

  // Check if a CLI tool is installed
  hasTool(name) {
    try {
      execSync(`which ${name}`, { encoding: 'utf8', stdio: 'pipe' });
      return true;
    } catch (e) { return false; }
  }

  // Install a tool if missing
  installTool(name) {
    const app = APP_REGISTRY.find(a => a.name === name);
    if (!app) return { ok: false, error: 'unknown tool' };
    const cmd = app.install[this.platform];
    if (!cmd) return { ok: false, error: 'no install command for platform' };
    try {
      execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
      return { ok: true, tool: name };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // Auto-discover: given a problem, find the right tool
  discover(problem) {
    const p = problem.toLowerCase();
    const matches = [];

    // Match problem to tool type
    if (/\b(convert|video|audio|image|media)\b/.test(p)) matches.push(...APP_REGISTRY.filter(a => a.type === 'media'));
    if (/\b(query|database|sql|data)\b/.test(p)) matches.push(...APP_REGISTRY.filter(a => a.type === 'database'));
    if (/\b(http|fetch|download|api|request)\b/.test(p)) matches.push(...APP_REGISTRY.filter(a => a.type === 'http'));
    if (/\b(parse|json|format)\b/.test(p)) matches.push(...APP_REGISTRY.filter(a => a.type === 'json'));
    if (/\b(search|find|grep|look)\b/.test(p)) matches.push(...APP_REGISTRY.filter(a => a.type === 'search'));
    if (/\b(code|script|run|execute)\b/.test(p)) matches.push(...APP_REGISTRY.filter(a => a.type === 'runtime'));
    if (/\b(container|deploy|ship|docker)\b/.test(p)) matches.push(...APP_REGISTRY.filter(a => a.type === 'container'));

    // Deduplicate
    const seen = new Set();
    return matches.filter(a => { if (seen.has(a.name)) return false; seen.add(a.name); return true; });
  }

  // Auto-login to a web app using stored credentials
  autoLogin(appName) {
    const app = WEBAPPS.find(a => a.name === appName || a.domain.includes(appName));
    if (!app) return { ok: false, error: 'unknown app' };
    if (!app.safe) return { ok: false, error: 'app not in safe list' };

    const creds = this.vault?.autoLogin(app.domain);
    if (!creds) return { ok: false, error: 'no credentials stored', hint: 'pix creds add <email> <pass>' };

    // Return creds for the AI to use
    return { ok: true, domain: app.domain, email: creds.email, password: creds.password, api: app.api };
  }

  // List available tools
  available() {
    return APP_REGISTRY.map(a => ({
      ...a,
      installed: this.hasTool(a.name),
    }));
  }

  // List web apps
  webapps() {
    return WEBAPPS.map(a => ({
      ...a,
      hasCreds: this.vault ? !!this.vault.get(a.domain) : false,
    }));
  }

  // Suggest tools for a problem
  suggest(problem) {
    const tools = this.discover(problem);
    const webapps = WEBAPPS.filter(a => {
      const p = problem.toLowerCase();
      if (a.name === 'github' && /\b(git|repo|push|commit|pr)\b/.test(p)) return true;
      if (a.name === 'vercel' && /\b(deploy|host|site|web)\b/.test(p)) return true;
      if (a.name === 'npm' && /\b(package|module|dependency|install)\b/.test(p)) return true;
      return false;
    });

    return { cli: tools, web: webapps };
  }
}

module.exports = ToolDiscovery;
