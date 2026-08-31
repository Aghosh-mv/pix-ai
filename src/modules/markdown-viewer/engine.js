const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownViewerEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.documents = new Map();
    this.favorites = new Set();
    this.viewerDir = path.join(os.homedir(), '.pix/markdown-viewer');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Viewer Engine...');
    await fs.ensureDir(this.viewerDir);
    await this.loadDocuments();
    this.loadThemes();
    this.loadExtensions();
    this.logger.info('Markdown Viewer Engine initialized');
  }

  async loadDocuments() {
    try {
      const files = await fs.readdir(this.viewerDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.viewerDir, file));
          if (data.type === 'document') {
            this.documents.set(data.id, data);
            if (data.favorite) this.favorites.add(data.id);
          }
        }
      }
    } catch (e) {}
  }

  loadThemes() {
    this.themes = [
      { id: 'github', name: 'GitHub', icon: '🐙', dark: false },
      { id: 'github-dark', name: 'GitHub Dark', icon: '🌑', dark: true },
      { id: 'solarized', name: 'Solarized', icon: '☀️', dark: false },
      { id: 'solarized-dark', name: 'Solarized Dark', icon: '🌙', dark: true },
      { id: 'dracula', name: 'Dracula', icon: '🧛', dark: true },
      { id: 'nord', name: 'Nord', icon: '❄️', dark: true },
      { id: 'monokai', name: 'Monokai', icon: '🎨', dark: true }
    ];
  }

  loadExtensions() {
    this.extensions = [
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

  async createDocument(params) {
    const {
      title,
      content = '',
      source = 'local',
      favorite = false,
      tags = []
    } = params;

    const id = uuidv4();
    const document = {
      id,
      title,
      content,
      source,
      favorite,
      tags,
      wordCount: this.countWords(content),
      lineCount: content.split('\n').length,
      lastViewed: new Date().toISOString(),
      viewCount: 0,
      type: 'document',
      createdAt: new Date().toISOString()
    };

    this.documents.set(id, document);
    if (favorite) this.favorites.add(id);

    return document;
  }

  async updateDocument(id, updates) {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Document not found: ${id}`);

    const updated = { ...document, ...updates };

    if (updates.content !== undefined) {
      updated.wordCount = this.countWords(updates.content);
      updated.lineCount = updates.content.split('\n').length;
    }

    if (updates.favorite !== undefined) {
      if (updates.favorite) this.favorites.add(id);
      else this.favorites.delete(id);
    }

    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id) {
    this.documents.delete(id);
    this.favorites.delete(id);
    return { success: true };
  }

  async viewDocument(id) {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Document not found: ${id}`);

    document.viewCount = (document.viewCount || 0) + 1;
    document.lastViewed = new Date().toISOString();
    this.documents.set(id, document);

    return document;
  }

  async toggleFavorite(id) {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Document not found: ${id}`);

    document.favorite = !document.favorite;
    this.documents.set(id, document);

    if (document.favorite) this.favorites.add(id);
    else this.favorites.delete(id);

    return document;
  }

  listDocuments(options = {}) {
    const { favorite, tags, search, sort = 'date' } = options;
    let documents = Array.from(this.documents.values());

    if (favorite !== undefined) documents = documents.filter(d => d.favorite === favorite);
    if (tags && tags.length > 0) {
      documents = documents.filter(d => tags.some(t => d.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      documents = documents.filter(d =>
        d.title.toLowerCase().includes(searchLower) ||
        d.content.toLowerCase().includes(searchLower)
      );
    }

    if (sort === 'date') documents.sort((a, b) => new Date(b.lastViewed || b.createdAt) - new Date(a.lastViewed || a.createdAt));
    else if (sort === 'title') documents.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'views') documents.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

    return documents;
  }

  async getDocument(id) {
    return this.documents.get(id);
  }

  renderMarkdown(content, options = {}) {
    const { theme = 'github', lineNumbers = true } = options;
    let html = content;

    html = html.replace(/^```(\w+)?\n([\s\S]*?)```/gm, (match, lang, code) => {
      const language = lang || 'text';
      return `<pre class="language-${language}"><code>${this.escapeHtml(code.trim())}</code></pre>`;
    });

    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    html = html.replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>');

    html = html.replace(/^\- \[x\] (.+)$/gm, '<li class="task-item"><input type="checkbox" checked disabled> $1</li>');
    html = html.replace(/^\- \[ \] (.+)$/gm, '<li class="task-item"><input type="checkbox" disabled> $1</li>');
    html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');

    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ordered">$1</li>');

    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="markdown-image">');

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

    if (lineNumbers) {
      html = html.split('\n').map((line, i) =>
        `<span class="line-number">${i + 1}</span>${line}`
      ).join('\n');
    }

    return html;
  }

  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  getThemes() {
    return this.themes;
  }

  getExtensions() {
    return this.extensions;
  }

  async toggleExtension(id) {
    const extension = this.extensions.find(e => e.id === id);
    if (!extension) throw new Error(`Extension not found: ${id}`);

    extension.enabled = !extension.enabled;
    return extension;
  }

  async searchDocuments(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, doc] of this.documents) {
      let score = 0;

      if (doc.title.toLowerCase().includes(queryLower)) score += 10;
      if (doc.content.toLowerCase().includes(queryLower)) score += 5;
      if (doc.tags.some(t => t.toLowerCase().includes(queryLower))) score += 3;

      if (score > 0) {
        results.push({ ...doc, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  async getStats() {
    const documents = Array.from(this.documents.values());

    return {
      documents: documents.length,
      favorites: this.favorites.size,
      themes: this.themes.length,
      extensions: this.extensions.length,
      totalViews: documents.reduce((sum, d) => sum + (d.viewCount || 0), 0),
      totalWords: documents.reduce((sum, d) => sum + (d.wordCount || 0), 0)
    };
  }

  async exportDocuments(format = 'json') {
    const documents = Array.from(this.documents.values());

    if (format === 'json') {
      return JSON.stringify(documents, null, 2);
    }

    return documents;
  }
}

module.exports = MarkdownViewerEngine;
