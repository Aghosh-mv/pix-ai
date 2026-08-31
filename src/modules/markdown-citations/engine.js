const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownCitationEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.citations = new Map();
    this.bibliographies = new Map();
    this.citationDir = path.join(os.homedir(), '.pix/markdown-citations');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Citation Engine...');
    await fs.ensureDir(this.citationDir);
    await this.loadCitations();
    this.loadCitationStyles();
    this.logger.info('Markdown Citation Engine initialized');
  }

  async loadCitations() {
    try {
      const files = await fs.readdir(this.citationDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.citationDir, file));
          if (data.type === 'citation') this.citations.set(data.id, data);
          else if (data.type === 'bibliography') this.bibliographies.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadCitationStyles() {
    this.styles = [
      { id: 'apa', name: 'APA', icon: '📘', description: 'American Psychological Association' },
      { id: 'mla', name: 'MLA', icon: '📗', description: 'Modern Language Association' },
      { id: 'chicago', name: 'Chicago', icon: '📙', description: 'Chicago Manual of Style' },
      { id: 'harvard', name: 'Harvard', icon: '📕', description: 'Harvard Referencing' },
      { id: 'ieee', name: 'IEEE', icon: '📓', description: 'Institute of Electrical and Electronics Engineers' },
      { id: 'vancouver', name: 'Vancouver', icon: '📔', description: 'Vancouver Style' },
      { id: 'turabian', name: 'Turabian', icon: '📒', description: 'Turabian Style' },
      { id: 'AMA', name: 'AMA', icon: '📕', description: 'American Medical Association' }
    ];
  }

  async createCitation(params) {
    const {
      type = 'article',
      authors = [],
      title,
      journal = '',
      volume = '',
      issue = '',
      pages = '',
      year,
      month = '',
      publisher = '',
      city = '',
      url = '',
      doi = '',
      isbn = '',
      abstract = '',
      tags = []
    } = params;

    const id = uuidv4();
    const citation = {
      id,
      type,
      authors,
      title,
      journal,
      volume,
      issue,
      pages,
      year,
      month,
      publisher,
      city,
      url,
      doi,
      isbn,
      abstract,
      tags,
      type: 'citation',
      createdAt: new Date().toISOString()
    };

    this.citations.set(id, citation);
    return citation;
  }

  async updateCitation(id, updates) {
    const citation = this.citations.get(id);
    if (!citation) throw new Error(`Citation not found: ${id}`);

    const updated = { ...citation, ...updates };
    this.citations.set(id, updated);
    return updated;
  }

  async deleteCitation(id) {
    this.citations.delete(id);
    return { success: true };
  }

  async getCitation(id) {
    return this.citations.get(id);
  }

  listCitations(options = {}) {
    const { type, tags, search, sort = 'date' } = options;
    let citations = Array.from(this.citations.values());

    if (type) citations = citations.filter(c => c.type === type);
    if (tags && tags.length > 0) {
      citations = citations.filter(c => tags.some(t => c.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      citations = citations.filter(c =>
        c.title.toLowerCase().includes(searchLower) ||
        c.authors.some(a => a.toLowerCase().includes(searchLower)) ||
        c.journal.toLowerCase().includes(searchLower)
      );
    }

    if (sort === 'date') citations.sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (sort === 'author') citations.sort((a, b) => (a.authors[0] || '').localeCompare(b.authors[0] || ''));
    else if (sort === 'title') citations.sort((a, b) => a.title.localeCompare(b.title));

    return citations;
  }

  formatAPA(citation) {
    const authors = citation.authors.join(', ');
    let formatted = `${authors} (${citation.year}). ${citation.title}.`;

    if (citation.journal) {
      formatted += ` *${citation.journal}*`;
      if (citation.volume) formatted += `, *${citation.volume}*`;
      if (citation.issue) formatted += `(${citation.issue})`;
      if (citation.pages) formatted += `, ${citation.pages}`;
      formatted += '.';
    }

    if (citation.publisher) {
      formatted += ` ${citation.publisher}.`;
    }

    if (citation.doi) {
      formatted += ` https://doi.org/${citation.doi}`;
    }

    return formatted;
  }

  formatMLA(citation) {
    const authors = citation.authors.join(', ');
    let formatted = `${authors}. "${citation.title}."`;

    if (citation.journal) {
      formatted += ` *${citation.journal}*`;
      if (citation.volume) formatted += `, vol. ${citation.volume}`;
      if (citation.issue) formatted += `, no. ${citation.issue}`;
      formatted += `, ${citation.year}`;
      if (citation.pages) formatted += `, pp. ${citation.pages}`;
      formatted += '.';
    }

    return formatted;
  }

  formatChicago(citation) {
    const authors = citation.authors.join(', ');
    let formatted = `${authors}. "${citation.title}."`;

    if (citation.journal) {
      formatted += ` *${citation.journal}*`;
      if (citation.volume) formatted += ` ${citation.volume}`;
      if (citation.issue) formatted += `, no. ${citation.issue}`;
      formatted += ` (${citation.year})`;
      if (citation.pages) formatted += `: ${citation.pages}`;
      formatted += '.';
    }

    return formatted;
  }

  formatIEEE(citation, index) {
    const authors = citation.authors.join(', ');
    let formatted = `[${index}] ${authors}, "${citation.title},"`;

    if (citation.journal) {
      formatted += ` *${citation.journal}*`;
      if (citation.volume) formatted += `, vol. ${citation.volume}`;
      if (citation.issue) formatted += `, no. ${citation.issue}`;
      formatted += `, pp. ${citation.pages || 'N/A'}`;
      formatted += `, ${citation.year}`;
      formatted += '.';
    }

    return formatted;
  }

  formatCitation(citation, style = 'apa', index = null) {
    switch (style) {
      case 'apa': return this.formatAPA(citation);
      case 'mla': return this.formatMLA(citation);
      case 'chicago': return this.formatChicago(citation);
      case 'ieee': return this.formatIEEE(citation, index);
      default: return this.formatAPA(citation);
    }
  }

  generateInlineCitation(citation, style = 'apa') {
    const authors = citation.authors.map(a => a.split(' ').pop()).join(' & ');
    return `(${authors}, ${citation.year})`;
  }

  generateFootnoteCitation(citation) {
    const authors = citation.authors.join(', ');
    return `${authors}, *${citation.title}* (${citation.year}).`;
  }

  async createBibliography(params) {
    const {
      name,
      citationIds = [],
      style = 'apa',
      title = 'References'
    } = params;

    const id = uuidv4();
    const bibliography = {
      id,
      name,
      citationIds,
      style,
      title,
      type: 'bibliography',
      createdAt: new Date().toISOString()
    };

    this.bibliographies.set(id, bibliography);
    return bibliography;
  }

  async updateBibliography(id, updates) {
    const bibliography = this.bibliographies.get(id);
    if (!bibliography) throw new Error(`Bibliography not found: ${id}`);

    const updated = { ...bibliography, ...updates };
    this.bibliographies.set(id, updated);
    return updated;
  }

  async deleteBibliography(id) {
    this.bibliographies.delete(id);
    return { success: true };
  }

  async getBibliography(id) {
    const bibliography = this.bibliographies.get(id);
    if (!bibliography) throw new Error(`Bibliography not found: ${id}`);

    const citations = bibliography.citationIds
      .map(cid => this.citations.get(cid))
      .filter(Boolean);

    const formatted = citations.map((c, i) =>
      this.formatCitation(c, bibliography.style, i + 1)
    );

    return {
      ...bibliography,
      citations,
      formatted
    };
  }

  listBibliographies() {
    return Array.from(this.bibliographies.values());
  }

  getCitationStyles() {
    return this.styles;
  }

  getCitationTypes() {
    return [
      { id: 'article', name: 'Journal Article', icon: '📄' },
      { id: 'book', name: 'Book', icon: '📚' },
      { id: 'chapter', name: 'Book Chapter', icon: '📖' },
      { id: 'conference', name: 'Conference Paper', icon: '🎤' },
      { id: 'thesis', name: 'Thesis/Dissertation', icon: '🎓' },
      { id: 'website', name: 'Website', icon: '🌐' },
      { id: 'newspaper', name: 'Newspaper', icon: '📰' },
      { id: 'patent', name: 'Patent', icon: '📋' }
    ];
  }

  async searchCitations(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, citation] of this.citations) {
      let score = 0;

      if (citation.title.toLowerCase().includes(queryLower)) score += 10;
      if (citation.authors.some(a => a.toLowerCase().includes(queryLower))) score += 5;
      if (citation.abstract && citation.abstract.toLowerCase().includes(queryLower)) score += 3;

      if (score > 0) {
        results.push({ ...citation, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getStats() {
    const citations = Array.from(this.citations.values());

    return {
      citations: citations.length,
      bibliographies: this.bibliographies.size,
      styles: this.styles.length,
      byType: this.getCitationsByType()
    };
  }

  getCitationsByType() {
    const citations = Array.from(this.citations.values());
    const byType = {};

    for (const citation of citations) {
      byType[citation.type] = (byType[citation.type] || 0) + 1;
    }

    return byType;
  }

  async exportCitations(format = 'json') {
    const data = {
      citations: Array.from(this.citations.values()),
      bibliographies: Array.from(this.bibliographies.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'bibtex') {
      return Array.from(this.citations.values())
        .map(c => this.toBibTeX(c))
        .join('\n\n');
    }

    return data;
  }

  toBibTeX(citation) {
    const key = citation.authors[0]?.split(' ').pop().toLowerCase() + citation.year;
    const type = citation.type === 'article' ? 'article' : 'misc';

    let bib = `@${type}{${key},\n`;
    bib += `  author = {${citation.authors.join(' and ')}},\n`;
    bib += `  title = {${citation.title}},\n`;
    if (citation.journal) bib += `  journal = {${citation.journal}},\n`;
    if (citation.volume) bib += `  volume = {${citation.volume}},\n`;
    if (citation.issue) bib += `  number = {${citation.issue}},\n`;
    if (citation.pages) bib += `  pages = {${citation.pages}},\n`;
    bib += `  year = {${citation.year}},\n`;
    if (citation.publisher) bib += `  publisher = {${citation.publisher}},\n`;
    if (citation.doi) bib += `  doi = {${citation.doi}},\n`;
    if (citation.url) bib += `  url = {${citation.url}}\n`;
    bib += '}';

    return bib;
  }
}

module.exports = MarkdownCitationEngine;
