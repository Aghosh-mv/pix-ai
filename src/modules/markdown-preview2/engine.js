const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownPreviewEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.previews = new Map();
    this.themes = new Map();
    this.previewDir = path.join(os.homedir(), '.pix/markdown-preview');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Preview Engine...');
    await fs.ensureDir(this.previewDir);
    await this.loadPreviews();
    this.loadThemes();
    this.loadExtensions();
    this.logger.info('Markdown Preview Engine initialized');
  }

  async loadPreviews() {
    try {
      const files = await fs.readdir(this.previewDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.previewDir, file));
          if (data.type === 'preview') this.previews.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadThemes() {
    this.themeList = [
      { id: 'github', name: 'GitHub', icon: '🐙', dark: false },
      { id: 'github-dark', name: 'GitHub Dark', icon: '🌑', dark: true },
      { id: 'solarized', name: 'Solarized', icon: '☀️', dark: false },
      { id: 'solarized-dark', name: 'Solarized Dark', icon: '🌙', dark: true },
      { id: 'dracula', name: 'Dracula', icon: '🧛', dark: true },
      { id: 'nord', name: 'Nord', icon: '❄️', dark: true },
      { id: 'monokai', name: 'Monokai', icon: '🎨', dark: true }
    ];

    this.themeList.forEach(theme => {
      this.themes.set(theme.id, { ...theme, type: 'theme' });
    });
  }

  loadExtensions() {
    this.extensionList = [
      { id: 'tables', name: 'Tables', enabled: true, icon: '📊' },
      { id: 'task-lists', name: 'Task Lists', enabled: true, icon: '☑️' },
      { id: 'footnotes', name: 'Footnotes', enabled: true, icon: '📝' },
      { id: 'definition-lists', name: 'Definition Lists', enabled: true, icon: '📖' },
      { id: 'highlight', name: 'Syntax Highlighting', enabled: true, icon: '🎨' },
      { id: 'math', name: 'Math/LaTeX', enabled: false, icon: '🔢' },
      { id: 'mermaid', name: 'Mermaid Diagrams', enabled: false, icon: '📈' },
      { id: 'emoji', name: 'Emoji', enabled: true, icon: '😊' }
    ];
  }

  async createPreview(params) {
    const {
      title,
      content = '',
      theme = 'github',
      wordWrap = true,
      lineNumbers = true,
      fontSize = 14,
      fontFamily = 'monospace'
    } = params;

    const id = uuidv4();
    const preview = {
      id,
      title,
      content,
      theme,
      wordWrap,
      lineNumbers,
      fontSize,
      fontFamily,
      wordCount: this.countWords(content),
      lineCount: content.split('\n').length,
      type: 'preview',
      createdAt: new Date().toISOString()
    };

    this.previews.set(id, preview);
    return preview;
  }

  async updatePreview(id, updates) {
    const preview = this.previews.get(id);
    if (!preview) throw new Error(`Preview not found: ${id}`);

    const updated = { ...preview, ...updates };

    if (updates.content !== undefined) {
      updated.wordCount = this.countWords(updates.content);
      updated.lineCount = updates.content.split('\n').length;
    }

    this.previews.set(id, updated);
    return updated;
  }

  async deletePreview(id) {
    this.previews.delete(id);
    return { success: true };
  }

  async getPreview(id) {
    return this.previews.get(id);
  }

  listPreviews(options = {}) {
    const { search } = options;
    let previews = Array.from(this.previews.values());

    if (search) {
      const searchLower = search.toLowerCase();
      previews = previews.filter(p =>
        p.title.toLowerCase().includes(searchLower) ||
        p.content.toLowerCase().includes(searchLower)
      );
    }

    return previews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  renderMarkdown(content) {
    let html = content;

    html = html.replace(/^```(\w+)?\n([\s\S]*?)```/gm, '<pre><code class="language-$1">$2</code></pre>');

    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    html = html.replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>');

    html = html.replace(/^\- \[x\] (.+)$/gm, '<li><input type="checkbox" checked disabled> $1</li>');
    html = html.replace(/^\- \[ \] (.+)$/gm, '<li><input type="checkbox" disabled> $1</li>');
    html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');

    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%;">');

    html = html.replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.some(c => c.trim().match(/^[-:]+$/))) return '';
      return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
    });

    html = html.replace(/^---$/gm, '<hr>');

    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    html = html.replace(/<p><(h[1-6]|pre|blockquote|ul|ol|li|hr|table|tr)/g, '<$1');
    html = html.replace(/<\/(h[1-6]|pre|blockquote|ul|ol|li|hr|table|tr)><\/p>/g, '</$1>');

    return html;
  }

  getThemes() {
    return Array.from(this.themes.values());
  }

  getExtensions() {
    return this.extensionList;
  }

  async toggleExtension(id) {
    const extension = this.extensionList.find(e => e.id === id);
    if (!extension) throw new Error(`Extension not found: ${id}`);

    extension.enabled = !extension.enabled;
    return extension;
  }

  async searchPreviews(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, preview] of this.previews) {
      let score = 0;

      if (preview.title.toLowerCase().includes(queryLower)) score += 10;
      if (preview.content.toLowerCase().includes(queryLower)) score += 5;

      if (score > 0) {
        results.push({ ...preview, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  async getStats() {
    const previews = Array.from(this.previews.values());

    return {
      previews: previews.length,
      themes: this.themes.size,
      extensions: this.extensionList.length,
      totalWords: previews.reduce((sum, p) => sum + (p.wordCount || 0), 0),
      totalLines: previews.reduce((sum, p) => sum + (p.lineCount || 0), 0)
    };
  }

  async exportPreviews(format = 'json') {
    const previews = Array.from(this.previews.values());

    if (format === 'json') {
      return JSON.stringify(previews, null, 2);
    }

    return previews;
  }
}

module.exports = MarkdownPreviewEngine;
