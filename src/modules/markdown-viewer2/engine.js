const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownViewerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.views = new Map();
    this.viewerDir = path.join(os.homedir(), '.pix/markdown-viewer');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Viewer Engine...');
    await fs.ensureDir(this.viewerDir);
    await this.loadViews();
    this.loadThemes();
    this.loadExtensions();
    this.logger.info('Markdown Viewer Engine initialized');
  }

  async loadViews() {
    try {
      const files = await fs.readdir(this.viewerDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.viewerDir, file));
          if (data.type === 'view') this.views.set(data.id, data);
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
      { id: 'monokai', name: 'Monokai', icon: '🎨', dark: true },
      { id: 'material', name: 'Material', icon: 'Ⓜ️', dark: true }
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
      { id: 'emoji', name: 'Emoji', enabled: true, icon: '😊' },
      { id: 'toc', name: 'Table of Contents', enabled: true, icon: '📑' },
      { id: 'anchors', name: 'Heading Anchors', enabled: true, icon: '⚓' }
    ];
  }

  async createView(params) {
    const {
      title,
      content = '',
      theme = 'github',
      fontSize = 16,
      lineHeight = 1.6,
      maxWidth = 800,
      scrollPosition = 0,
      zoom = 100
    } = params;

    const id = uuidv4();
    const view = {
      id,
      title,
      content,
      theme,
      fontSize,
      lineHeight,
      maxWidth,
      scrollPosition,
      zoom,
      wordCount: this.countWords(content),
      lineCount: content.split('\n').length,
      readingTime: this.calculateReadingTime(content),
      type: 'view',
      createdAt: new Date().toISOString(),
      lastViewed: new Date().toISOString()
    };

    this.views.set(id, view);
    return view;
  }

  async updateView(id, updates) {
    const view = this.views.get(id);
    if (!view) throw new Error(`View not found: ${id}`);

    const updated = {
      ...view,
      ...updates,
      id,
      lastViewed: new Date().toISOString()
    };

    if (updates.content !== undefined) {
      updated.wordCount = this.countWords(updates.content);
      updated.lineCount = updates.content.split('\n').length;
      updated.readingTime = this.calculateReadingTime(updates.content);
    }

    this.views.set(id, updated);
    return updated;
  }

  async deleteView(id) {
    this.views.delete(id);
    return { success: true };
  }

  async getView(id) {
    const view = this.views.get(id);
    if (!view) throw new Error(`View not found: ${id}`);

    view.lastViewed = new Date().toISOString();
    this.views.set(id, view);

    return view;
  }

  listViews(options = {}) {
    const { search } = options;
    let views = Array.from(this.views.values());

    if (search) {
      const searchLower = search.toLowerCase();
      views = views.filter(v =>
        v.title.toLowerCase().includes(searchLower) ||
        v.content.toLowerCase().includes(searchLower)
      );
    }

    return views.sort((a, b) => new Date(b.lastViewed) - new Date(a.lastViewed));
  }

  renderMarkdown(content) {
    let html = content;

    html = html.replace(/^```(\w+)?\n([\s\S]*?)```/gm, '<pre><code class="language-$1">$2</code></pre>');
    html = html.replace(/^### (.+)$/gm, '<h3 id="$1">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 id="$1">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 id="$1">$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    html = html.replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^\- \[x\] (.+)$/gm, '<li class="task-item"><input type="checkbox" checked disabled> $1</li>');
    html = html.replace(/^\- \[ \] (.+)$/gm, '<li class="task-item"><input type="checkbox" disabled> $1</li>');
    html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ordered">$1</li>');
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%;">');
    html = html.replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.some(c => c.trim().match(/^[-:]+$/))) return '';
      return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
    });
    html = html.replace(/^---$/gm, '<hr>');

    return html;
  }

  generateTOC(content) {
    const headings = [];
    const regex = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

      headings.push({ level, text, id });
    }

    let toc = '';
    for (const heading of headings) {
      const indent = '  '.repeat(heading.level - 1);
      toc += `${indent}- [${heading.text}](#${heading.id})\n`;
    }

    return toc;
  }

  async searchViews(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, view] of this.views) {
      let score = 0;

      if (view.title.toLowerCase().includes(queryLower)) score += 10;
      if (view.content.toLowerCase().includes(queryLower)) score += 5;

      if (score > 0) {
        results.push({ ...view, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  calculateReadingTime(content) {
    const words = this.countWords(content);
    const wordsPerMinute = 200;
    return Math.ceil(words / wordsPerMinute);
  }

  getThemes() {
    return this.themeList;
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

  async getStats() {
    const views = Array.from(this.views.values());

    return {
      views: views.length,
      themes: this.themeList.length,
      extensions: this.extensionList.length,
      totalWords: views.reduce((sum, v) => sum + (v.wordCount || 0), 0),
      totalReadingTime: views.reduce((sum, v) => sum + (v.readingTime || 0), 0)
    };
  }

  async exportViews(format = 'json') {
    const views = Array.from(this.views.values());

    if (format === 'json') {
      return JSON.stringify(views, null, 2);
    }

    return views;
  }
}

module.exports = MarkdownViewerEngine;
