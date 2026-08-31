const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownSearchEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.index = new Map();
    this.queries = new Map();
    this.searchDir = path.join(os.homedir(), '.pix/markdown-search');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Search Engine...');
    await fs.ensureDir(this.searchDir);
    await this.loadIndex();
    this.loadSearchOptions();
    this.logger.info('Markdown Search Engine initialized');
  }

  async loadIndex() {
    try {
      const files = await fs.readdir(this.searchDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.searchDir, file));
          if (data.type === 'query') this.queries.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadSearchOptions() {
    this.searchOptions = {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      includeCode: true,
      includeHeadings: true,
      includeComments: true,
      maxResults: 100,
      contextLines: 2
    };

    this.searchTypes = [
      { id: 'text', name: 'Plain Text', icon: '📝', description: 'Simple text search' },
      { id: 'regex', name: 'Regular Expression', icon: '🔧', description: 'Pattern-based search' },
      { id: 'fuzzy', name: 'Fuzzy Search', icon: '🔍', description: 'Approximate matching' },
      { id: 'semantic', name: 'Semantic Search', icon: '🧠', description: 'Meaning-based search' },
      { id: 'tag', name: 'Tag Search', icon: '🏷️', description: 'Search by tags' },
      { id: 'heading', name: 'Heading Search', icon: '📑', description: 'Search in headings only' },
      { id: 'link', name: 'Link Search', icon: '🔗', description: 'Search for links' },
      { id: 'code', name: 'Code Search', icon: '💻', description: 'Search in code blocks' }
    ];
  }

  async searchDocuments(params) {
    const {
      query,
      documents = [],
      options = {}
    } = params;

    const searchOptions = { ...this.searchOptions, ...options };
    const results = [];

    for (const doc of documents) {
      const matches = this.searchDocument(doc, query, searchOptions);
      if (matches.length > 0) {
        results.push({
          document: doc,
          matches,
          score: this.calculateScore(matches, doc)
        });
      }
    }

    const id = uuidv4();
    const searchQuery = {
      id,
      query,
      options: searchOptions,
      resultCount: results.length,
      timestamp: new Date().toISOString(),
      type: 'query'
    };

    this.queries.set(id, searchQuery);

    return results.sort((a, b) => b.score - a.score);
  }

  searchDocument(doc, query, options) {
    const matches = [];
    const lines = doc.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineMatches = this.searchLine(line, i + 1, query, options);
      matches.push(...lineMatches);
    }

    return matches;
  }

  searchLine(line, lineNumber, query, options) {
    const matches = [];
    let searchLine = line;
    let searchQuery = query;

    if (!options.caseSensitive) {
      searchLine = line.toLowerCase();
      searchQuery = query.toLowerCase();
    }

    if (options.regex) {
      try {
        const regex = new RegExp(searchQuery, options.caseSensitive ? 'g' : 'gi');
        let match;
        while ((match = regex.exec(line)) !== null) {
          matches.push({
            line: lineNumber,
            column: match.index + 1,
            match: match[0],
            context: this.getContext(line, match.index, options.contextLines)
          });
        }
      } catch (e) {}
    } else if (options.wholeWord) {
      const regex = new RegExp(`\\b${this.escapeRegex(searchQuery)}\\b`, options.caseSensitive ? 'g' : 'gi');
      let match;
      while ((match = regex.exec(searchLine)) !== null) {
        matches.push({
          line: lineNumber,
          column: match.index + 1,
          match: match[0],
          context: this.getContext(line, match.index, options.contextLines)
        });
      }
    } else {
      let startIndex = 0;
      let index;
      while ((index = searchLine.indexOf(searchQuery, startIndex)) !== -1) {
        matches.push({
          line: lineNumber,
          column: index + 1,
          match: line.substring(index, index + query.length),
          context: this.getContext(line, index, options.contextLines)
        });
        startIndex = index + 1;
      }
    }

    return matches;
  }

  getContext(line, index, contextLines) {
    const start = Math.max(0, index - 20);
    const end = Math.min(line.length, index + query.length + 20);
    return line.substring(start, end);
  }

  calculateScore(matches, doc) {
    let score = matches.length * 10;

    for (const match of matches) {
      if (doc.content.startsWith('#')) score += 5;
      if (match.line <= 10) score += 3;
    }

    return score;
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async fuzzySearch(query, documents, threshold = 0.6) {
    const results = [];

    for (const doc of documents) {
      const score = this.fuzzyMatch(query, doc.title + ' ' + doc.content);
      if (score >= threshold) {
        results.push({ document: doc, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  fuzzyMatch(pattern, str) {
    const patternLower = pattern.toLowerCase();
    const strLower = str.toLowerCase();

    if (strLower.includes(patternLower)) return 1;

    let score = 0;
    let patternIndex = 0;

    for (let i = 0; i < strLower.length && patternIndex < patternLower.length; i++) {
      if (strLower[i] === patternLower[patternIndex]) {
        score += 1;
        patternIndex++;
      }
    }

    return score / patternLower.length;
  }

  async searchByTag(tag, documents) {
    return documents.filter(doc =>
      doc.tags && doc.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );
  }

  async searchByHeading(query, documents) {
    const results = [];

    for (const doc of documents) {
      const headings = doc.content.match(/^#{1,6}\s+.+$/gm) || [];
      const matchingHeadings = headings.filter(h =>
        h.toLowerCase().includes(query.toLowerCase())
      );

      if (matchingHeadings.length > 0) {
        results.push({
          document: doc,
          headings: matchingHeadings
        });
      }
    }

    return results;
  }

  async searchByLink(query, documents) {
    const results = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    for (const doc of documents) {
      let match;
      const links = [];

      while ((match = linkRegex.exec(doc.content)) !== null) {
        if (match[1].toLowerCase().includes(query.toLowerCase()) ||
            match[2].toLowerCase().includes(query.toLowerCase())) {
          links.push({ text: match[1], url: match[2] });
        }
      }

      if (links.length > 0) {
        results.push({ document: doc, links });
      }
    }

    return results;
  }

  async searchInCode(query, documents) {
    const results = [];
    const codeBlockRegex = /```[\s\S]*?```/g;

    for (const doc of documents) {
      let match;
      const codeBlocks = [];

      while ((match = codeBlockRegex.exec(doc.content)) !== null) {
        if (match[0].toLowerCase().includes(query.toLowerCase())) {
          codeBlocks.push(match[0]);
        }
      }

      if (codeBlocks.length > 0) {
        results.push({ document: doc, codeBlocks });
      }
    }

    return results;
  }

  getSearchTypes() {
    return this.searchTypes;
  }

  getSearchOptions() {
    return this.searchOptions;
  }

  async getSearchHistory(limit = 50) {
    return Array.from(this.queries.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async clearSearchHistory() {
    this.queries.clear();
    return { success: true };
  }

  async getStats() {
    return {
      searchTypes: this.searchTypes.length,
      queries: this.queries.size,
      options: Object.keys(this.searchOptions).length
    };
  }

  async exportSearches(format = 'json') {
    const queries = Array.from(this.queries.values());

    if (format === 'json') {
      return JSON.stringify(queries, null, 2);
    }

    return queries;
  }
}

module.exports = MarkdownSearchEngine;
