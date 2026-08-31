const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownFootnoteEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.footnotes = new Map();
    this.footnoteDir = path.join(os.homedir(), '.pix/markdown-footnotes');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Footnote Engine...');
    await fs.ensureDir(this.footnoteDir);
    await this.loadFootnotes();
    this.logger.info('Markdown Footnote Engine initialized');
  }

  async loadFootnotes() {
    try {
      const files = await fs.readdir(this.footnoteDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.footnoteDir, file));
          if (data.type === 'footnote') this.footnotes.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  async createFootnote(params) {
    const {
      content,
      documentId = null,
      marker = null
    } = params;

    const id = uuidv4();
    const footnote = {
      id,
      content,
      documentId,
      marker: marker || this.generateMarker(),
      type: 'footnote',
      createdAt: new Date().toISOString()
    };

    this.footnotes.set(id, footnote);
    return footnote;
  }

  async updateFootnote(id, updates) {
    const footnote = this.footnotes.get(id);
    if (!footnote) throw new Error(`Footnote not found: ${id}`);

    const updated = { ...footnote, ...updates };
    this.footnotes.set(id, updated);
    return updated;
  }

  async deleteFootnote(id) {
    this.footnotes.delete(id);
    return { success: true };
  }

  async getFootnote(id) {
    return this.footnotes.get(id);
  }

  listFootnotes(options = {}) {
    const { documentId, search } = options;
    let footnotes = Array.from(this.footnotes.values());

    if (documentId) footnotes = footnotes.filter(f => f.documentId === documentId);
    if (search) {
      const searchLower = search.toLowerCase();
      footnotes = footnotes.filter(f =>
        f.content.toLowerCase().includes(searchLower)
      );
    }

    return footnotes.sort((a, b) => {
      const aNum = parseInt(a.marker);
      const bNum = parseInt(b.marker);
      return aNum - bNum;
    });
  }

  generateMarker() {
    const markers = Array.from(this.footnotes.values())
      .map(f => parseInt(f.marker))
      .filter(n => !isNaN(n));

    const nextNum = markers.length > 0 ? Math.max(...markers) + 1 : 1;
    return String(nextNum);
  }

  renderInlineFootnote(footnote) {
    return `[^${footnote.marker}]`;
  }

  renderFootnoteDefinition(footnote) {
    return `[^${footnote.marker}]: ${footnote.content}`;
  }

  renderAllFootnotes(documentId) {
    const footnotes = this.listFootnotes({ documentId });
    return footnotes.map(f => this.renderFootnoteDefinition(f)).join('\n\n');
  }

  parseFootnotes(content) {
    const inlineRegex = /\[\^(\w+)\]/g;
    const definitionRegex = /^\[\^(\w+)\]:\s*(.+)$/gm;

    const inline = [];
    let match;

    while ((match = inlineRegex.exec(content)) !== null) {
      if (!inline.includes(match[1])) {
        inline.push(match[1]);
      }
    }

    const definitions = [];
    while ((match = definitionRegex.exec(content)) !== null) {
      definitions.push({
        marker: match[1],
        content: match[2]
      });
    }

    return { inline, definitions };
  }

  validateFootnotes(content) {
    const { inline, definitions } = this.parseFootnotes(content);
    const errors = [];
    const warnings = [];

    const defMarkers = definitions.map(d => d.marker);

    for (const marker of inline) {
      if (!defMarkers.includes(marker)) {
        errors.push({
          marker,
          message: `Footnote [^${marker}] has no definition`,
          type: 'missing-definition'
        });
      }
    }

    for (const marker of defMarkers) {
      if (!inline.includes(marker)) {
        warnings.push({
          marker,
          message: `Footnote definition [^${marker}] is not referenced`,
          type: 'unused-definition'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        inlineCount: inline.length,
        definitionCount: definitions.length,
        orphaned: errors.length,
        unused: warnings.length
      }
    };
  }

  async searchFootnotes(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, footnote] of this.footnotes) {
      let score = 0;

      if (footnote.content.toLowerCase().includes(queryLower)) score += 10;

      if (score > 0) {
        results.push({ ...footnote, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getStats() {
    const footnotes = Array.from(this.footnotes.values());

    return {
      total: footnotes.length,
      withDocuments: footnotes.filter(f => f.documentId).length,
      withoutDocuments: footnotes.filter(f => !f.documentId).length
    };
  }

  async exportFootnotes(format = 'json') {
    const footnotes = Array.from(this.footnotes.values());

    if (format === 'json') {
      return JSON.stringify(footnotes, null, 2);
    }

    if (format === 'markdown') {
      return footnotes.map(f => this.renderFootnoteDefinition(f)).join('\n\n');
    }

    return footnotes;
  }
}

module.exports = MarkdownFootnoteEngine;
