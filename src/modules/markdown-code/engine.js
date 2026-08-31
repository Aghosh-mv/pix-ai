const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownCodeEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.snippets = new Map();
    this.languages = new Map();
    this.codeDir = path.join(os.homedir(), '.pix/markdown-code');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Code Engine...');
    await fs.ensureDir(this.codeDir);
    await this.loadSnippets();
    this.loadLanguages();
    this.loadTemplates();
    this.logger.info('Markdown Code Engine initialized');
  }

  async loadSnippets() {
    try {
      const files = await fs.readdir(this.codeDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.codeDir, file));
          if (data.type === 'snippet') this.snippets.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadLanguages() {
    const langs = [
      { id: 'javascript', name: 'JavaScript', icon: '📜', aliases: ['js', 'node'] },
      { id: 'typescript', name: 'TypeScript', icon: '📘', aliases: ['ts'] },
      { id: 'python', name: 'Python', icon: '🐍', aliases: ['py'] },
      { id: 'java', name: 'Java', icon: '☕', aliases: [] },
      { id: 'csharp', name: 'C#', icon: '🔷', aliases: ['cs', 'c#'] },
      { id: 'cpp', name: 'C++', icon: '⚙️', aliases: ['c++', 'cc'] },
      { id: 'c', name: 'C', icon: '©️', aliases: [] },
      { id: 'go', name: 'Go', icon: '🐹', aliases: ['golang'] },
      { id: 'rust', name: 'Rust', icon: '🦀', aliases: ['rs'] },
      { id: 'ruby', name: 'Ruby', icon: '💎', aliases: ['rb'] },
      { id: 'php', name: 'PHP', icon: '🐘', aliases: [] },
      { id: 'swift', name: 'Swift', icon: '🐦', aliases: [] },
      { id: 'kotlin', name: 'Kotlin', icon: '🇰', aliases: ['kt'] },
      { id: 'scala', name: 'Scala', icon: '🔴', aliases: [] },
      { id: 'sql', name: 'SQL', icon: '🗄️', aliases: ['mysql', 'postgres', 'sqlite'] },
      { id: 'html', name: 'HTML', icon: '🌐', aliases: [] },
      { id: 'css', name: 'CSS', icon: '🎨', aliases: ['scss', 'sass', 'less'] },
      { id: 'bash', name: 'Bash', icon: '🖥️', aliases: ['sh', 'shell', 'zsh'] },
      { id: 'powershell', name: 'PowerShell', icon: '💻', aliases: ['ps', 'ps1'] },
      { id: 'yaml', name: 'YAML', icon: '📄', aliases: ['yml'] },
      { id: 'json', name: 'JSON', icon: '📋', aliases: [] },
      { id: 'xml', name: 'XML', icon: '📰', aliases: [] },
      { id: 'markdown', name: 'Markdown', icon: '📝', aliases: ['md'] },
      { id: 'dockerfile', name: 'Dockerfile', icon: '🐳', aliases: ['docker'] },
      { id: 'graphql', name: 'GraphQL', icon: '📊', aliases: ['gql'] },
      { id: 'r', name: 'R', icon: '📈', aliases: ['rscript'] },
      { id: 'matlab', name: 'MATLAB', icon: '🔢', aliases: [] },
      { id: 'lua', name: 'Lua', icon: '🌙', aliases: [] },
      { id: 'perl', name: 'Perl', icon: '🐪', aliases: ['pl'] },
      { id: 'haskell', name: 'Haskell', icon: 'λ', aliases: ['hs'] },
      { id: 'elixir', name: 'Elixir', icon: '💧', aliases: ['ex'] }
    ];

    langs.forEach(lang => {
      this.languages.set(lang.id, { ...lang, type: 'language' });
    });
  }

  loadTemplates() {
    const defaults = [
      {
        id: 'javascript-function',
        name: 'JavaScript Function',
        language: 'javascript',
        template: '/**\n * ${description}\n * @param {${paramType}} ${paramName} - ${paramDescription}\n * @returns {${returnType}} ${returnDescription}\n */\nfunction ${functionName}(${paramName}) {\n  ${cursor}\n}',
        icon: '⚡'
      },
      {
        id: 'python-function',
        name: 'Python Function',
        language: 'python',
        template: 'def ${function_name}(${param}):\n    """${description}"""\n    ${cursor}',
        icon: '🐍'
      },
      {
        id: 'class-definition',
        name: 'Class Definition',
        language: 'javascript',
        template: '/**\n * ${className}\n */\nclass ${className} {\n  constructor(${params}) {\n    ${cursor}\n  }\n\n  ${methodName}() {\n    \n  }\n}',
        icon: '🏗️'
      },
      {
        id: 'api-endpoint',
        name: 'API Endpoint',
        language: 'javascript',
        template: "app.${method}('${path}', async (req, res) => {\n  try {\n    ${cursor}\n    res.json({ success: true, data });\n  } catch (error) {\n    res.status(500).json({ success: false, error: error.message });\n  }\n});",
        icon: '🌐'
      }
    ];

    defaults.forEach(template => {
      if (!this.snippets.has(template.id)) {
        this.snippets.set(template.id, {
          ...template,
          type: 'snippet',
          usageCount: 0,
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  async createSnippet(params) {
    const {
      name,
      language,
      code,
      description = '',
      tags = [],
      isTemplate = false,
      templateVars = []
    } = params;

    const id = uuidv4();
    const snippet = {
      id,
      name,
      language,
      code,
      description,
      tags,
      isTemplate,
      templateVars,
      usageCount: 0,
      lastUsed: null,
      type: 'snippet',
      createdAt: new Date().toISOString()
    };

    this.snippets.set(id, snippet);
    return snippet;
  }

  async updateSnippet(id, updates) {
    const snippet = this.snippets.get(id);
    if (!snippet) throw new Error(`Snippet not found: ${id}`);

    const updated = { ...snippet, ...updates };
    this.snippets.set(id, updated);
    return updated;
  }

  async deleteSnippet(id) {
    this.snippets.delete(id);
    return { success: true };
  }

  async getSnippet(id) {
    const snippet = this.snippets.get(id);
    if (!snippet) throw new Error(`Snippet not found: ${id}`);

    snippet.usageCount = (snippet.usageCount || 0) + 1;
    snippet.lastUsed = new Date().toISOString();
    this.snippets.set(id, snippet);

    return snippet;
  }

  listSnippets(options = {}) {
    const { language, tags, search, isTemplate } = options;
    let snippets = Array.from(this.snippets.values());

    if (language) snippets = snippets.filter(s => s.language === language);
    if (tags && tags.length > 0) {
      snippets = snippets.filter(s => tags.some(t => s.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      snippets = snippets.filter(s =>
        s.name.toLowerCase().includes(searchLower) ||
        s.code.toLowerCase().includes(searchLower) ||
        s.description.toLowerCase().includes(searchLower)
      );
    }
    if (isTemplate !== undefined) snippets = snippets.filter(s => s.isTemplate === isTemplate);

    return snippets.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }

  generateMarkdown(snippet, options = {}) {
    const { title = null, showLineNumbers = false, highlightLines = [] } = options;

    let md = '';

    if (title) {
      md += `### ${title}\n\n`;
    }

    md += '```' + snippet.language + '\n';
    md += snippet.code;
    md += '\n```\n';

    if (snippet.description) {
      md += '\n' + snippet.description + '\n';
    }

    return md;
  }

  generateHTML(snippet, options = {}) {
    const { theme = 'github', showLineNumbers = true } = options;

    const lines = snippet.code.split('\n');
    let html = `<pre class="language-${snippet.language}"><code>`;

    lines.forEach((line, i) => {
      if (showLineNumbers) {
        html += `<span class="line-number">${i + 1}</span>`;
      }
      html += this.escapeHtml(line);
      if (i < lines.length - 1) html += '\n';
    });

    html += '</code></pre>';
    return html;
  }

  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  async renderTemplate(id, variables = {}) {
    const snippet = this.snippets.get(id);
    if (!snippet) throw new Error(`Snippet not found: ${id}`);
    if (!snippet.isTemplate) throw new Error('Snippet is not a template');

    let code = snippet.code;

    for (const [key, value] of Object.entries(variables)) {
      code = code.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }

    return {
      ...snippet,
      renderedCode: code
    };
  }

  resolveLanguage(input) {
    const inputLower = input.toLowerCase();

    for (const [id, lang] of this.languages) {
      if (id === inputLower || lang.name.toLowerCase() === inputLower) {
        return lang;
      }
      if (lang.aliases && lang.aliases.includes(inputLower)) {
        return lang;
      }
    }

    return null;
  }

  getLanguages() {
    return Array.from(this.languages.values());
  }

  async searchSnippets(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, snippet] of this.snippets) {
      let score = 0;

      if (snippet.name.toLowerCase().includes(queryLower)) score += 10;
      if (snippet.code.toLowerCase().includes(queryLower)) score += 5;
      if (snippet.description.toLowerCase().includes(queryLower)) score += 3;
      if (snippet.tags.some(t => t.toLowerCase().includes(queryLower))) score += 2;

      if (score > 0) {
        results.push({ ...snippet, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getMostUsed(limit = 10) {
    return Array.from(this.snippets.values())
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }

  async getStats() {
    const snippets = Array.from(this.snippets.values());

    return {
      total: snippets.length,
      templates: snippets.filter(s => s.isTemplate).length,
      languages: this.languages.size,
      totalUsage: snippets.reduce((sum, s) => sum + (s.usageCount || 0), 0),
      byLanguage: this.getSnippetsByLanguage()
    };
  }

  getSnippetsByLanguage() {
    const snippets = Array.from(this.snippets.values());
    const byLanguage = {};

    for (const snippet of snippets) {
      byLanguage[snippet.language] = (byLanguage[snippet.language] || 0) + 1;
    }

    return byLanguage;
  }

  async exportSnippets(format = 'json') {
    const snippets = Array.from(this.snippets.values());

    if (format === 'json') {
      return JSON.stringify(snippets, null, 2);
    }

    if (format === 'markdown') {
      return snippets.map(s => this.generateMarkdown(s)).join('\n\n---\n\n');
    }

    return snippets;
  }
}

module.exports = MarkdownCodeEngine;
