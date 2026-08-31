const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownEditorEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.documents = new Map();
    this.snippets = new Map();
    this.editorDir = path.join(os.homedir(), '.pix/markdown-editor');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Editor Engine...');
    await fs.ensureDir(this.editorDir);
    await this.loadDocuments();
    this.loadSnippets();
    this.loadThemes();
    this.loadKeybindings();
    this.logger.info('Markdown Editor Engine initialized');
  }

  async loadDocuments() {
    try {
      const files = await fs.readdir(this.editorDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.editorDir, file));
          if (data.type === 'document') this.documents.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadSnippets() {
    this.markdownSnippets = [
      { id: 'bold', name: 'Bold', syntax: '**text**', icon: 'B', shortcut: 'Ctrl+B' },
      { id: 'italic', name: 'Italic', syntax: '*text*', icon: 'I', shortcut: 'Ctrl+I' },
      { id: 'strikethrough', name: 'Strikethrough', syntax: '~~text~~', icon: 'S', shortcut: 'Ctrl+Shift+X' },
      { id: 'heading1', name: 'Heading 1', syntax: '# Heading 1', icon: 'H1', shortcut: 'Ctrl+1' },
      { id: 'heading2', name: 'Heading 2', syntax: '## Heading 2', icon: 'H2', shortcut: 'Ctrl+2' },
      { id: 'heading3', name: 'Heading 3', syntax: '### Heading 3', icon: 'H3', shortcut: 'Ctrl+3' },
      { id: 'link', name: 'Link', syntax: '[text](url)', icon: '🔗', shortcut: 'Ctrl+K' },
      { id: 'image', name: 'Image', syntax: '![alt](url)', icon: '🖼️', shortcut: 'Ctrl+Shift+I' },
      { id: 'code', name: 'Inline Code', syntax: '`code`', icon: '</>', shortcut: 'Ctrl+E' },
      { id: 'codeblock', name: 'Code Block', syntax: '```\ncode\n```', icon: '{}', shortcut: 'Ctrl+Shift+K' },
      { id: 'list', name: 'Unordered List', syntax: '- item', icon: '•', shortcut: 'Ctrl+Shift+U' },
      { id: 'olist', name: 'Ordered List', syntax: '1. item', icon: '1.', shortcut: 'Ctrl+Shift+O' },
      { id: 'tasklist', name: 'Task List', syntax: '- [ ] task', icon: '☑️', shortcut: 'Ctrl+Shift+T' },
      { id: 'quote', name: 'Blockquote', syntax: '> quote', icon: '❝', shortcut: 'Ctrl+Shift+.' },
      { id: 'hr', name: 'Horizontal Rule', syntax: '---', icon: '—', shortcut: 'Ctrl+Shift+H' },
      { id: 'table', name: 'Table', syntax: '| Col | Col |\n|---|---|\n| | |', icon: '📊' },
      { id: 'footnote', name: 'Footnote', syntax: 'Text[^1]\n\n[^1]: footnote', icon: '¹' },
      { id: 'definition', name: 'Definition', syntax: 'Term\n: definition', icon: '📖' }
    ];
  }

  loadThemes() {
    this.editorThemes = [
      { id: 'default', name: 'Default', icon: '📝', dark: false },
      { id: 'dark', name: 'Dark', icon: '🌙', dark: true },
      { id: 'monokai', name: 'Monokai', icon: '🎨', dark: true },
      { id: 'dracula', name: 'Dracula', icon: '🧛', dark: true },
      { id: 'nord', name: 'Nord', icon: '❄️', dark: true },
      { id: 'solarized', name: 'Solarized', icon: '☀️', dark: false },
      { id: 'github', name: 'GitHub', icon: '🐙', dark: false }
    ];
  }

  loadKeybindings() {
    this.keybindings = [
      { id: 'save', name: 'Save', keys: 'Ctrl+S', action: 'save' },
      { id: 'undo', name: 'Undo', keys: 'Ctrl+Z', action: 'undo' },
      { id: 'redo', name: 'Redo', keys: 'Ctrl+Shift+Z', action: 'redo' },
      { id: 'bold', name: 'Bold', keys: 'Ctrl+B', action: 'bold' },
      { id: 'italic', name: 'Italic', keys: 'Ctrl+I', action: 'italic' },
      { id: 'heading1', name: 'Heading 1', keys: 'Ctrl+1', action: 'heading1' },
      { id: 'heading2', name: 'Heading 2', keys: 'Ctrl+2', action: 'heading2' },
      { id: 'heading3', name: 'Heading 3', keys: 'Ctrl+3', action: 'heading3' },
      { id: 'link', name: 'Insert Link', keys: 'Ctrl+K', action: 'link' },
      { id: 'image', name: 'Insert Image', keys: 'Ctrl+Shift+I', action: 'image' },
      { id: 'code', name: 'Inline Code', keys: 'Ctrl+E', action: 'code' },
      { id: 'codeblock', name: 'Code Block', keys: 'Ctrl+Shift+K', action: 'codeblock' },
      { id: 'list', name: 'Unordered List', keys: 'Ctrl+Shift+U', action: 'list' },
      { id: 'olist', name: 'Ordered List', keys: 'Ctrl+Shift+O', action: 'olist' },
      { id: 'tasklist', name: 'Task List', keys: 'Ctrl+Shift+T', action: 'tasklist' },
      { id: 'quote', name: 'Blockquote', keys: 'Ctrl+Shift+.', action: 'quote' },
      { id: 'hr', name: 'Horizontal Rule', keys: 'Ctrl+Shift+H', action: 'hr' },
      { id: 'find', name: 'Find', keys: 'Ctrl+F', action: 'find' },
      { id: 'replace', name: 'Find and Replace', keys: 'Ctrl+H', action: 'replace' },
      { id: 'preview', name: 'Toggle Preview', keys: 'Ctrl+Shift+P', action: 'preview' },
      { id: 'fullscreen', name: 'Fullscreen', keys: 'F11', action: 'fullscreen' }
    ];
  }

  async createDocument(params) {
    const {
      title,
      content = '',
      folder = null,
      tags = [],
      wordWrap = true,
      lineNumbers = true,
      fontSize = 14,
      fontFamily = 'monospace',
      theme = 'default'
    } = params;

    const id = uuidv4();
    const document = {
      id,
      title,
      content,
      folder,
      tags,
      wordWrap,
      lineNumbers,
      fontSize,
      fontFamily,
      theme,
      wordCount: this.countWords(content),
      lineCount: content.split('\n').length,
      history: [],
      historyIndex: -1,
      saved: true,
      type: 'document',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };

    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id, updates) {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Document not found: ${id}`);

    if (updates.content !== undefined && updates.content !== document.content) {
      if (document.historyIndex < document.history.length - 1) {
        document.history = document.history.slice(0, document.historyIndex + 1);
      }

      document.history.push({
        content: document.content,
        timestamp: new Date().toISOString()
      });

      if (document.history.length > 100) {
        document.history.shift();
      } else {
        document.historyIndex++;
      }

      document.wordCount = this.countWords(updates.content);
      document.lineCount = updates.content.split('\n').length;
      document.saved = false;
    }

    const updated = {
      ...document,
      ...updates,
      id,
      modifiedAt: new Date().toISOString()
    };

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

  async undo(id) {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Document not found: ${id}`);

    if (document.historyIndex <= 0) {
      throw new Error('Nothing to undo');
    }

    document.historyIndex--;
    document.content = document.history[document.historyIndex].content;
    document.wordCount = this.countWords(document.content);
    document.lineCount = document.content.split('\n').length;

    this.documents.set(id, document);
    return document;
  }

  async redo(id) {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Document not found: ${id}`);

    if (document.historyIndex >= document.history.length - 1) {
      throw new Error('Nothing to redo');
    }

    document.historyIndex++;
    document.content = document.history[document.historyIndex].content;
    document.wordCount = this.countWords(document.content);
    document.lineCount = document.content.split('\n').length;

    this.documents.set(id, document);
    return document;
  }

  async findReplace(id, find, replace, options = {}) {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Document not found: ${id}`);

    const { caseSensitive = false, wholeWord = false, regex = false } = options;
    let flags = caseSensitive ? 'g' : 'gi';
    if (wholeWord) flags += 'b';

    let pattern;
    if (regex) {
      pattern = new RegExp(find, flags);
    } else {
      const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern = wholeWord ? new RegExp(`\\b${escaped}\\b`, flags) : new RegExp(escaped, flags);
    }

    const newContent = document.content.replace(pattern, replace);
    const count = (document.content.match(pattern) || []).length;

    if (count > 0) {
      await this.updateDocument(id, { content: newContent });
    }

    return { count, content: newContent };
  }

  listDocuments(options = {}) {
    const { folder, tags, search } = options;
    let documents = Array.from(this.documents.values());

    if (folder) documents = documents.filter(d => d.folder === folder);
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

    return documents.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
  }

  getSnippets() {
    return this.markdownSnippets;
  }

  getThemes() {
    return this.editorThemes;
  }

  getKeybindings() {
    return this.keybindings;
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
    html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/^---$/gm, '<hr>');

    return html;
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
      snippets: this.markdownSnippets.length,
      themes: this.editorThemes.length,
      keybindings: this.keybindings.length,
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

module.exports = MarkdownEditorEngine;
