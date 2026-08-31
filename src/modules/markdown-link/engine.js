const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownLinkEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.links = new Map();
    this.linkDir = path.join(os.homedir(), '.pix/markdown-links');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Link Engine...');
    await fs.ensureDir(this.linkDir);
    await this.loadLinks();
    this.loadLinkTypes();
    this.logger.info('Markdown Link Engine initialized');
  }

  async loadLinks() {
    try {
      const files = await fs.readdir(this.linkDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.linkDir, file));
          if (data.type === 'link') this.links.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadLinkTypes() {
    this.linkTypes = [
      { id: 'inline', name: 'Inline Link', syntax: '[text](url)', icon: '🔗' },
      { id: 'reference', name: 'Reference Link', syntax: '[text][ref]\n\n[ref]: url', icon: '📚' },
      { id: 'shortcut', name: 'Shortcut Link', syntax: '[ref]', icon: '⚡' },
      { id: 'collapsible', name: 'Collapsible', syntax: '<details><summary>Title</summary>Content</details>', icon: '🔽' },
      { id: 'image', name: 'Image Link', syntax: '![alt](url)', icon: '🖼️' },
      { id: 'anchor', name: 'Anchor Link', syntax: '[text](#heading)', icon: '⚓' },
      { id: 'email', name: 'Email Link', syntax: '[text](mailto:user@example.com)', icon: '📧' },
      { id: 'phone', name: 'Phone Link', syntax: '[text](tel:+1234567890)', icon: '📞' }
    ];
  }

  async createLink(params) {
    const {
      text,
      url,
      type = 'inline',
      title = '',
      description = '',
      tags = []
    } = params;

    const id = uuidv4();
    const link = {
      id,
      text,
      url,
      type,
      title,
      description,
      tags,
      visitCount: 0,
      lastVisited: null,
      valid: true,
      type: 'link',
      createdAt: new Date().toISOString()
    };

    this.links.set(id, link);
    return link;
  }

  async updateLink(id, updates) {
    const link = this.links.get(id);
    if (!link) throw new Error(`Link not found: ${id}`);

    const updated = { ...link, ...updates };
    this.links.set(id, updated);
    return updated;
  }

  async deleteLink(id) {
    this.links.delete(id);
    return { success: true };
  }

  async getLink(id) {
    const link = this.links.get(id);
    if (!link) throw new Error(`Link not found: ${id}`);

    link.visitCount = (link.visitCount || 0) + 1;
    link.lastVisited = new Date().toISOString();
    this.links.set(id, link);

    return link;
  }

  listLinks(options = {}) {
    const { type, tags, search, valid } = options;
    let links = Array.from(this.links.values());

    if (type) links = links.filter(l => l.type === type);
    if (tags && tags.length > 0) {
      links = links.filter(l => tags.some(t => l.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      links = links.filter(l =>
        l.text.toLowerCase().includes(searchLower) ||
        l.url.toLowerCase().includes(searchLower) ||
        l.description.toLowerCase().includes(searchLower)
      );
    }
    if (valid !== undefined) links = links.filter(l => l.valid === valid);

    return links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  generateMarkdown(link) {
    switch (link.type) {
      case 'inline':
        return link.title ? `[${link.text}](${link.url} "${link.title}")` : `[${link.text}](${link.url})`;
      case 'reference':
        return `[${link.text}][${link.id}]`;
      case 'shortcut':
        return `[${link.text}]`;
      case 'image':
        return `![${link.text}](${link.url})`;
      case 'anchor':
        return `[${link.text}](${link.url})`;
      case 'email':
        return `[${link.text}](mailto:${link.url})`;
      case 'phone':
        return `[${link.text}](tel:${link.url})`;
      default:
        return `[${link.text}](${link.url})`;
    }
  }

  generateReferenceDefinitions(links) {
    return links
      .filter(l => l.type === 'reference')
      .map(l => `[${l.id}]: ${l.url}${l.title ? ` "${l.title}"` : ''}`)
      .join('\n');
  }

  async validateLink(url) {
    try {
      new URL(url);
      return { valid: true, url };
    } catch {
      return { valid: false, url, error: 'Invalid URL format' };
    }
  }

  async validateAllLinks() {
    const results = [];

    for (const [id, link] of this.links) {
      const validation = await this.validateLink(link.url);
      link.valid = validation.valid;
      this.links.set(id, link);
      results.push({ id, ...validation });
    }

    return results;
  }

  async findBrokenLinks() {
    return Array.from(this.links.values())
      .filter(l => !l.valid);
  }

  async searchLinks(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, link] of this.links) {
      let score = 0;

      if (link.text.toLowerCase().includes(queryLower)) score += 10;
      if (link.url.toLowerCase().includes(queryLower)) score += 5;
      if (link.description.toLowerCase().includes(queryLower)) score += 3;
      if (link.tags.some(t => t.toLowerCase().includes(queryLower))) score += 2;

      if (score > 0) {
        results.push({ ...link, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getMostVisited(limit = 10) {
    return Array.from(this.links.values())
      .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
      .slice(0, limit);
  }

  getLinkTypes() {
    return this.linkTypes;
  }

  async getStats() {
    const links = Array.from(this.links.values());

    return {
      total: links.length,
      valid: links.filter(l => l.valid).length,
      broken: links.filter(l => !l.valid).length,
      byType: this.getLinksByType(),
      totalVisits: links.reduce((sum, l) => sum + (l.visitCount || 0), 0)
    };
  }

  getLinksByType() {
    const links = Array.from(this.links.values());
    const byType = {};

    for (const link of links) {
      byType[link.type] = (byType[link.type] || 0) + 1;
    }

    return byType;
  }

  async exportLinks(format = 'json') {
    const links = Array.from(this.links.values());

    if (format === 'json') {
      return JSON.stringify(links, null, 2);
    }

    if (format === 'markdown') {
      const inlineLinks = links.filter(l => l.type !== 'reference');
      const refLinks = links.filter(l => l.type === 'reference');

      let md = inlineLinks.map(l => this.generateMarkdown(l)).join('\n\n');
      if (refLinks.length > 0) {
        md += '\n\n' + this.generateReferenceDefinitions(refLinks);
      }
      return md;
    }

    return links;
  }
}

module.exports = MarkdownLinkEngine;
