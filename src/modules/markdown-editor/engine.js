const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownEditorEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.documents = new Map();
    this.folders = new Map();
    this.templates = new Map();
    this.editorDir = path.join(os.homedir(), '.pix/markdown-editor');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Editor Engine...');
    await fs.ensureDir(this.editorDir);
    await this.loadDocuments();
    this.loadDefaultFolders();
    this.loadDefaultTemplates();
    this.loadSnippets();
    this.logger.info('Markdown Editor Engine initialized');
  }

  async loadDocuments() {
    try {
      const files = await fs.readdir(this.editorDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.editorDir, file));
          if (data.type === 'document') this.documents.set(data.id, data);
          else if (data.type === 'folder') this.folders.set(data.id, data);
          else if (data.type === 'template') this.templates.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadDefaultFolders() {
    const defaults = [
      { id: 'docs', name: 'Documentation', icon: '📚' },
      { id: 'notes', name: 'Notes', icon: '📝' },
      { id: 'tutorials', name: 'Tutorials', icon: '🎓' },
      { id: 'readme', name: 'READMEs', icon: '📖' }
    ];

    defaults.forEach(folder => {
      if (!this.folders.has(folder.id)) {
        this.folders.set(folder.id, {
          ...folder,
          type: 'folder',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  loadDefaultTemplates() {
    const defaults = [
      {
        id: 'readme',
        name: 'README',
        content: '# Project Name\n\n## Description\n\nBrief description of the project.\n\n## Installation\n\n```bash\nnpm install project-name\n```\n\n## Usage\n\n```javascript\nconst project = require(\'project-name\');\n```\n\n## Features\n\n- Feature 1\n- Feature 2\n- Feature 3\n\n## Contributing\n\n1. Fork the repository\n2. Create your feature branch\n3. Commit your changes\n4. Push to the branch\n5. Create a Pull Request\n\n## License\n\nMIT',
        icon: '📖'
      },
      {
        id: 'api-doc',
        name: 'API Documentation',
        content: '# API Documentation\n\n## Endpoints\n\n### GET /api/resource\n\nReturns a list of resources.\n\n**Response:**\n```json\n{\n  "data": [],\n  "total": 0\n}\n```\n\n### POST /api/resource\n\nCreates a new resource.\n\n**Request Body:**\n```json\n{\n  "name": "string"\n}\n```',
        icon: '🌐'
      },
      {
        id: 'changelog',
        name: 'Changelog',
        content: '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).\n\n## [1.0.0] - YYYY-MM-DD\n\n### Added\n\n- Initial release\n\n### Changed\n\n- Updated documentation\n\n### Fixed\n\n- Bug fixes',
        icon: '📋'
      }
    ];

    defaults.forEach(template => {
      if (!this.templates.has(template.id)) {
        this.templates.set(template.id, {
          ...template,
          type: 'template',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  loadSnippets() {
    this.markdownSnippets = [
      { id: 'bold', name: 'Bold', syntax: '**text**', icon: 'B' },
      { id: 'italic', name: 'Italic', syntax: '*text*', icon: 'I' },
      { id: 'heading1', name: 'Heading 1', syntax: '# Heading 1', icon: 'H1' },
      { id: 'heading2', name: 'Heading 2', syntax: '## Heading 2', icon: 'H2' },
      { id: 'heading3', name: 'Heading 3', syntax: '### Heading 3', icon: 'H3' },
      { id: 'link', name: 'Link', syntax: '[text](url)', icon: '🔗' },
      { id: 'image', name: 'Image', syntax: '![alt](url)', icon: '🖼️' },
      { id: 'code', name: 'Code Block', syntax: '```\ncode\n```', icon: '💻' },
      { id: 'list', name: 'List', syntax: '- item', icon: '📝' },
      { id: 'numbered', name: 'Numbered List', syntax: '1. item', icon: '🔢' },
      { id: 'quote', name: 'Quote', syntax: '> quote', icon: '💬' },
      { id: 'hr', name: 'Horizontal Rule', syntax: '---', icon: '➖' },
      { id: 'table', name: 'Table', syntax: '| Header | Header |\n|--------|--------|\n| Cell   | Cell   |', icon: '📊' },
      { id: 'task', name: 'Task List', syntax: '- [ ] Task\n- [x] Completed', icon: '☑️' }
    ];
  }

  async createDocument(params) {
    const {
      title,
      content = '',
      folderId = null,
      tags = [],
      isPublic = false
    } = params;

    const id = uuidv4();
    const document = {
      id,
      title,
      content,
      folderId,
      tags,
      isPublic,
      wordCount: this.countWords(content),
      characterCount: content.length,
      lineCount: content.split('\n').length,
      lastEdited: new Date().toISOString(),
      versions: [],
      type: 'document',
      createdAt: new Date().toISOString()
    };

    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id, updates) {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Document not found: ${id}`);

    if (updates.content && updates.content !== document.content) {
      document.versions.push({
        content: document.content,
        savedAt: new Date().toISOString()
      });

      if (document.versions.length > 50) {
        document.versions = document.versions.slice(-50);
      }
    }

    const updated = {
      ...document,
      ...updates,
      id,
      lastEdited: new Date().toISOString()
    };

    if (updates.content !== undefined) {
      updated.wordCount = this.countWords(updates.content);
      updated.characterCount = updates.content.length;
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

  async getVersion(id, versionIndex) {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Document not found: ${id}`);

    if (versionIndex < 0 || versionIndex >= document.versions.length) {
      throw new Error('Version not found');
    }

    return document.versions[versionIndex];
  }

  async restoreVersion(id, versionIndex) {
    const document = this.documents.get(id);
    if (!document) throw new Error(`Document not found: ${id}`);

    if (versionIndex < 0 || versionIndex >= document.versions.length) {
      throw new Error('Version not found');
    }

    const version = document.versions[versionIndex];
    document.versions.push({
      content: document.content,
      savedAt: new Date().toISOString()
    });

    document.content = version.content;
    document.lastEdited = new Date().toISOString();

    this.documents.set(id, document);
    return document;
  }

  listDocuments(options = {}) {
    const { folderId, tags, search, sort = 'date' } = options;
    let documents = Array.from(this.documents.values());

    if (folderId) documents = documents.filter(d => d.folderId === folderId);
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

    if (sort === 'date') documents.sort((a, b) => new Date(b.lastEdited) - new Date(a.lastEdited));
    else if (sort === 'title') documents.sort((a, b) => a.title.localeCompare(b.title));

    return documents;
  }

  async createFolder(params) {
    const { name, icon = '📁', parentId = null } = params;
    const id = uuidv4();

    const folder = {
      id,
      name,
      icon,
      parentId,
      type: 'folder',
      createdAt: new Date().toISOString()
    };

    this.folders.set(id, folder);
    return folder;
  }

  async updateFolder(id, updates) {
    const folder = this.folders.get(id);
    if (!folder) throw new Error(`Folder not found: ${id}`);

    const updated = { ...folder, ...updates };
    this.folders.set(id, updated);
    return updated;
  }

  async deleteFolder(id) {
    this.folders.delete(id);
    return { success: true };
  }

  listFolders() {
    return Array.from(this.folders.values());
  }

  async createTemplate(params) {
    const { name, content, icon = '📝' } = params;
    const id = uuidv4();

    const template = {
      id,
      name,
      content,
      icon,
      type: 'template',
      createdAt: new Date().toISOString()
    };

    this.templates.set(id, template);
    return template;
  }

  listTemplates() {
    return Array.from(this.templates.values());
  }

  getSnippets() {
    return this.markdownSnippets;
  }

  renderMarkdown(content) {
    let html = content;

    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

    html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

    html = html.replace(/^---$/gm, '<hr>');

    html = html.replace(/\n/g, '<br>');

    return html;
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
    const totalWords = documents.reduce((sum, d) => sum + (d.wordCount || 0), 0);

    return {
      total: documents.length,
      folders: this.folders.size,
      templates: this.templates.size,
      snippets: this.markdownSnippets.length,
      totalWords,
      totalCharacters: documents.reduce((sum, d) => sum + (d.characterCount || 0), 0),
      totalLines: documents.reduce((sum, d) => sum + (d.lineCount || 0), 0),
      totalVersions: documents.reduce((sum, d) => sum + (d.versions ? d.versions.length : 0), 0)
    };
  }

  async exportDocuments(format = 'json') {
    const data = {
      documents: Array.from(this.documents.values()),
      folders: Array.from(this.folders.values()),
      templates: Array.from(this.templates.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = MarkdownEditorEngine;
