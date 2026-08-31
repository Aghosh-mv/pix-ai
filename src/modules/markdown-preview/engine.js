const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownPreviewEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.documents = new Map();
    this.themes = new Map();
    this.previewDir = path.join(os.homedir(), '.pix/markdown-preview');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Preview Engine...');
    await fs.ensureDir(this.previewDir);
    await this.loadDocuments();
    this.loadThemes();
    this.loadDefaultSnippets();
    this.logger.info('Markdown Preview Engine initialized');
  }

  async loadDocuments() {
    try {
      const files = await fs.readdir(this.previewDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.previewDir, file));
          if (data.type === 'document') this.documents.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadThemes() {
    this.themeList = [
      { id: 'github', name: 'GitHub', icon: '🐙', css: 'github-markdown.css' },
      { id: 'dark', name: 'Dark', icon: '🌙', css: 'github-markdown-dark.css' },
      { id: 'minimal', name: 'Minimal', icon: '✨', css: 'minimal-markdown.css' },
      { id: 'professional', name: 'Professional', icon: '💼', css: 'professional-markdown.css' }
    ];

    this.themeList.forEach(theme => {
      if (!this.themes.has(theme.id)) {
        this.themes.set(theme.id, {
          ...theme,
          type: 'theme',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  loadDefaultSnippets() {
    this.markdownSnippets = [
      { id: 'heading1', name: 'Heading 1', syntax: '# Heading 1', icon: 'H1' },
      { id: 'heading2', name: 'Heading 2', syntax: '## Heading 2', icon: 'H2' },
      { id: 'heading3', name: 'Heading 3', syntax: '### Heading 3', icon: 'H3' },
      { id: 'bold', name: 'Bold', syntax: '**bold text**', icon: 'B' },
      { id: 'italic', name: 'Italic', syntax: '*italic text*', icon: 'I' },
      { id: 'strikethrough', name: 'Strikethrough', syntax: '~~deleted~~', icon: 'S' },
      { id: 'code', name: 'Inline Code', syntax: '`code`', icon: '</>' },
      { id: 'codeblock', name: 'Code Block', syntax: '```javascript\n// code\n```', icon: '{}' },
      { id: 'link', name: 'Link', syntax: '[text](url)', icon: '🔗' },
      { id: 'image', name: 'Image', syntax: '![alt](url)', icon: '🖼️' },
      { id: 'list', name: 'Unordered List', syntax: '- item 1\n- item 2\n- item 3', icon: '•' },
      { id: 'olist', name: 'Ordered List', syntax: '1. item 1\n2. item 2\n3. item 3', icon: '1.' },
      { id: 'tasklist', name: 'Task List', syntax: '- [ ] unchecked\n- [x] checked', icon: '☑️' },
      { id: 'quote', name: 'Blockquote', syntax: '> quote text', icon: '❝' },
      { id: 'hr', name: 'Horizontal Rule', syntax: '---', icon: '—' },
      { id: 'table', name: 'Table', syntax: '| Header | Header |\n|--------|--------|\n| Cell   | Cell   |', icon: '📊' },
      { id: 'footnote', name: 'Footnote', syntax: 'Text[^1]\n\n[^1]: Footnote content', icon: '¹' },
      { id: 'definition', name: 'Definition List', syntax: 'Term\n: Definition', icon: '📖' }
    ];
  }

  async createDocument(params) {
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
    const document = {
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
      type: 'document',
      createdAt: new Date().toISOString()
    };

    this.documents.set(id, document);
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

    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id) {
    this.documents.delete(id);
    return { success: true };
  }

  async getDocument(id) {
    return this.documents.get(id);
  }

  listDocuments(options = {}) {
    const { search } = options;
    let documents = Array.from(this.documents.values());

    if (search) {
      const searchLower = search.toLowerCase();
      documents = documents.filter(d =>
        d.title.toLowerCase().includes(searchLower) ||
        d.content.toLowerCase().includes(searchLower)
      );
    }

    return documents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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

  getSnippets() {
    return this.markdownSnippets;
  }

  async searchDocuments(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, doc] of this.documents) {
      let score = 0;

      if (doc.title.toLowerCase().includes(queryLower)) score += 10;
      if (doc.content.toLowerCase().includes(queryLower)) score += 5;

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
    const totalWords = documents.reduce((sum, d) => sum + (d.wordCount || 0), 0);

    return {
      documents: documents.length,
      themes: this.themes.size,
      snippets: this.markdownSnippets.length,
      totalWords,
      totalLines: documents.reduce((sum, d) => sum + (d.lineCount || 0), 0)
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

module.exports = MarkdownPreviewEngine;
