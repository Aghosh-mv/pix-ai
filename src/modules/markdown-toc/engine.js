const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownTOCEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.tocs = new Map();
    this.tocDir = path.join(os.homedir(), '.pix/markdown-toc');
  }

  async initialize() {
    this.logger.info('Initializing Markdown TOC Engine...');
    await fs.ensureDir(this.tocDir);
    await this.loadTOCs();
    this.loadStyles();
    this.logger.info('Markdown TOC Engine initialized');
  }

  async loadTOCs() {
    try {
      const files = await fs.readdir(this.tocDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.tocDir, file));
          if (data.type === 'toc') this.tocs.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadStyles() {
    this.styles = [
      { id: 'bulleted', name: 'Bulleted List', icon: '•', prefix: '- ' },
      { id: 'numbered', name: 'Numbered List', icon: '1.', prefix: '1. ' },
      { id: 'dotted', name: 'Dotted List', icon: '·', prefix: '  - ' },
      { id: 'arrow', name: 'Arrow List', icon: '→', prefix: '  → ' },
      { id: 'dash', name: 'Dash List', icon: '—', prefix: '  — ' }
    ];
  }

  async createTOC(params) {
    const {
      documentId,
      content,
      style = 'bulleted',
      maxDepth = 3,
      minDepth = 1,
      title = 'Table of Contents'
    } = params;

    const id = uuidv4();
    const headings = this.extractHeadings(content);
    const tocContent = this.generateTOC(headings, { style, maxDepth, minDepth });

    const toc = {
      id,
      documentId,
      content: tocContent,
      rawContent: tocContent,
      style,
      maxDepth,
      minDepth,
      title,
      headings,
      type: 'toc',
      createdAt: new Date().toISOString()
    };

    this.tocs.set(id, toc);
    return toc;
  }

  async updateTOC(id, updates) {
    const toc = this.tocs.get(id);
    if (!toc) throw new Error(`TOC not found: ${id}`);

    if (updates.content) {
      const headings = this.extractHeadings(updates.content);
      updates.headings = headings;
      updates.rawContent = this.generateTOC(headings, {
        style: updates.style || toc.style,
        maxDepth: updates.maxDepth || toc.maxDepth,
        minDepth: updates.minDepth || toc.minDepth
      });
    }

    const updated = { ...toc, ...updates };
    this.tocs.set(id, updated);
    return updated;
  }

  async deleteTOC(id) {
    this.tocs.delete(id);
    return { success: true };
  }

  async getTOC(id) {
    return this.tocs.get(id);
  }

  listTOCs(options = {}) {
    const { documentId, style } = options;
    let tocs = Array.from(this.tocs.values());

    if (documentId) tocs = tocs.filter(t => t.documentId === documentId);
    if (style) tocs = tocs.filter(t => t.style === style);

    return tocs;
  }

  extractHeadings(content) {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      headings.push({
        level,
        text,
        id,
        anchor: `#${id}`
      });
    }

    return headings;
  }

  generateTOC(headings, options = {}) {
    const { style = 'bulleted', maxDepth = 3, minDepth = 1 } = options;
    const filtered = headings.filter(h => h.level >= minDepth && h.level <= maxDepth);

    if (filtered.length === 0) return '';

    const styleConfig = this.styles.find(s => s.id === style) || this.styles[0];
    let toc = '';

    for (const heading of filtered) {
      const indent = '  '.repeat(heading.level - minDepth);
      toc += `${indent}${styleConfig.prefix}[${heading.text}](${heading.anchor})\n`;
    }

    return toc.trim();
  }

  generateNumberedTOC(headings, options = {}) {
    const { maxDepth = 3, minDepth = 1 } = options;
    const filtered = headings.filter(h => h.level >= minDepth && h.level <= maxDepth);

    if (filtered.length === 0) return '';

    const counters = new Array(maxDepth).fill(0);
    let toc = '';

    for (const heading of filtered) {
      counters[heading.level - 1]++;
      for (let i = heading.level; i < maxDepth; i++) {
        counters[i] = 0;
      }

      const number = counters.slice(minDepth - 1, heading.level).join('.');
      const indent = '  '.repeat(heading.level - minDepth);
      toc += `${indent}${number}. [${heading.text}](${heading.anchor})\n`;
    }

    return toc.trim();
  }

  async regenerateTOC(id, content) {
    const toc = this.tocs.get(id);
    if (!toc) throw new Error(`TOC not found: ${id}`);

    const headings = this.extractHeadings(content);
    const newContent = this.generateTOC(headings, {
      style: toc.style,
      maxDepth: toc.maxDepth,
      minDepth: toc.minDepth
    });

    toc.content = newContent;
    toc.rawContent = newContent;
    toc.headings = headings;
    this.tocs.set(id, toc);

    return toc;
  }

  async validateTOC(id, content) {
    const toc = this.tocs.get(id);
    if (!toc) throw new Error(`TOC not found: ${id}`);

    const currentHeadings = this.extractHeadings(content);
    const tocHeadings = toc.headings;

    const missing = currentHeadings.filter(h =>
      !tocHeadings.some(th => th.text === h.text)
    );

    const extra = tocHeadings.filter(h =>
      !currentHeadings.some(th => th.text === h.text)
    );

    return {
      valid: missing.length === 0 && extra.length === 0,
      missing,
      extra,
      stats: {
        currentHeadings: currentHeadings.length,
        tocHeadings: tocHeadings.length
      }
    };
  }

  getStyles() {
    return this.styles;
  }

  async searchTOCs(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, toc] of this.tocs) {
      let score = 0;

      if (toc.title.toLowerCase().includes(queryLower)) score += 5;
      if (toc.content.toLowerCase().includes(queryLower)) score += 3;

      if (score > 0) {
        results.push({ ...toc, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getStats() {
    const tocs = Array.from(this.tocs.values());

    return {
      total: tocs.length,
      styles: this.styles.length,
      totalHeadings: tocs.reduce((sum, t) => sum + (t.headings ? t.headings.length : 0), 0)
    };
  }

  async exportTOCs(format = 'json') {
    const tocs = Array.from(this.tocs.values());

    if (format === 'json') {
      return JSON.stringify(tocs, null, 2);
    }

    if (format === 'markdown') {
      return tocs.map(t => `## ${t.title}\n\n${t.content}`).join('\n\n---\n\n');
    }

    return tocs;
  }
}

module.exports = MarkdownTOCEngine;
