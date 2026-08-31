const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class NewsEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.sources = new Map();
    this.articles = new Map();
    this.bookmarks = new Map();
    this.readHistory = new Map();
    this.newsDir = path.join(os.homedir(), '.pix/news');
  }

  async initialize() {
    this.logger.info('Initializing News Engine...');
    await fs.ensureDir(this.newsDir);
    await this.loadNews();
    this.loadDefaultSources();
    this.logger.info('News Engine initialized');
  }

  async loadNews() {
    try {
      const files = await fs.readdir(this.newsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.newsDir, file));
          if (data.type === 'source') this.sources.set(data.id, data);
          else if (data.type === 'article') this.articles.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadDefaultSources() {
    const defaults = [
      { id: 'bbc', name: 'BBC News', url: 'https://bbc.com/news', category: 'world', icon: '📰' },
      { id: 'cnn', name: 'CNN', url: 'https://cnn.com', category: 'world', icon: '📺' },
      { id: 'techcrunch', name: 'TechCrunch', url: 'https://techcrunch.com', category: 'technology', icon: '💻' },
      { id: 'verge', name: 'The Verge', url: 'https://theverge.com', category: 'technology', icon: '📱' },
      { id: 'reuters', name: 'Reuters', url: 'https://reuters.com', category: 'world', icon: '🌐' },
      { id: 'guardian', name: 'The Guardian', url: 'https://theguardian.com', category: 'world', icon: '📖' }
    ];

    defaults.forEach(source => {
      if (!this.sources.has(source.id)) {
        this.sources.set(source.id, {
          ...source,
          type: 'source',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  async addSource(params) {
    const {
      name,
      url,
      category = 'general',
      icon = '📰',
      description = ''
    } = params;

    const id = uuidv4();
    const source = {
      id,
      name,
      url,
      category,
      icon,
      description,
      type: 'source',
      enabled: true,
      createdAt: new Date().toISOString()
    };

    this.sources.set(id, source);
    return source;
  }

  async updateSource(id, updates) {
    const source = this.sources.get(id);
    if (!source) throw new Error(`Source not found: ${id}`);

    const updated = { ...source, ...updates };
    this.sources.set(id, updated);
    return updated;
  }

  async deleteSource(id) {
    this.sources.delete(id);
    return { success: true };
  }

  listSources(options = {}) {
    const { category, enabled, search } = options;
    let sources = Array.from(this.sources.values());

    if (category) sources = sources.filter(s => s.category === category);
    if (enabled !== undefined) sources = sources.filter(s => s.enabled === enabled);
    if (search) {
      const searchLower = search.toLowerCase();
      sources = sources.filter(s => s.name.toLowerCase().includes(searchLower));
    }

    return sources;
  }

  async addArticle(params) {
    const {
      sourceId,
      title,
      summary = '',
      content = '',
      url = '',
      author = '',
      publishedDate = new Date().toISOString(),
      category = 'general',
      imageUrl = '',
      tags = []
    } = params;

    const id = uuidv4();
    const article = {
      id,
      sourceId,
      title,
      summary,
      content,
      url,
      author,
      publishedDate: new Date(publishedDate).toISOString(),
      category,
      imageUrl,
      tags,
      read: false,
      bookmarked: false,
      readTime: Math.ceil(content.length / 200),
      type: 'article',
      createdAt: new Date().toISOString()
    };

    this.articles.set(id, article);
    return article;
  }

  async updateArticle(id, updates) {
    const article = this.articles.get(id);
    if (!article) throw new Error(`Article not found: ${id}`);

    const updated = { ...article, ...updates };
    this.articles.set(id, updated);
    return updated;
  }

  async markRead(id) {
    const article = this.articles.get(id);
    if (!article) throw new Error(`Article not found: ${id}`);

    article.read = true;
    article.readAt = new Date().toISOString();
    this.articles.set(id, article);
    this.readHistory.set(id, { articleId: id, readAt: article.readAt });

    return article;
  }

  async markUnread(id) {
    const article = this.articles.get(id);
    if (!article) throw new Error(`Article not found: ${id}`);

    article.read = false;
    article.readAt = null;
    this.articles.set(id, article);
    this.readHistory.delete(id);

    return article;
  }

  async toggleBookmark(id) {
    const article = this.articles.get(id);
    if (!article) throw new Error(`Article not found: ${id}`);

    article.bookmarked = !article.bookmarked;
    this.articles.set(id, article);

    if (article.bookmarked) {
      this.bookmarks.set(id, { articleId: id, createdAt: new Date().toISOString() });
    } else {
      this.bookmarks.delete(id);
    }

    return article;
  }

  listArticles(options = {}) {
    const { sourceId, category, read, bookmarked, search, limit = 50 } = options;
    let articles = Array.from(this.articles.values());

    if (sourceId) articles = articles.filter(a => a.sourceId === sourceId);
    if (category) articles = articles.filter(a => a.category === category);
    if (read !== undefined) articles = articles.filter(a => a.read === read);
    if (bookmarked !== undefined) articles = articles.filter(a => a.bookmarked === bookmarked);
    if (search) {
      const searchLower = search.toLowerCase();
      articles = articles.filter(a =>
        a.title.toLowerCase().includes(searchLower) ||
        a.summary.toLowerCase().includes(searchLower)
      );
    }

    return articles
      .sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate))
      .slice(0, limit);
  }

  async getArticle(id) {
    return this.articles.get(id);
  }

  async deleteArticle(id) {
    this.articles.delete(id);
    this.bookmarks.delete(id);
    this.readHistory.delete(id);
    return { success: true };
  }

  async getBookmarks() {
    return Array.from(this.bookmarks.values())
      .map(b => this.articles.get(b.articleId))
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getReadHistory() {
    return Array.from(this.readHistory.values())
      .sort((a, b) => new Date(b.readAt) - new Date(a.readAt));
  }

  async searchArticles(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, article] of this.articles) {
      let score = 0;

      if (article.title.toLowerCase().includes(queryLower)) score += 10;
      if (article.summary.toLowerCase().includes(queryLower)) score += 5;
      if (article.tags.some(tag => tag.toLowerCase().includes(queryLower))) score += 3;

      if (score > 0) {
        results.push({ ...article, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getStats() {
    const articles = Array.from(this.articles.values());
    const sources = Array.from(this.sources.values());

    return {
      sources: sources.length,
      totalArticles: articles.length,
      read: articles.filter(a => a.read).length,
      unread: articles.filter(a => !a.read).length,
      bookmarked: articles.filter(a => a.bookmarked).length,
      byCategory: this.getArticlesByCategory()
    };
  }

  getArticlesByCategory() {
    const articles = Array.from(this.articles.values());
    const byCategory = {};

    for (const article of articles) {
      byCategory[article.category] = (byCategory[article.category] || 0) + 1;
    }

    return byCategory;
  }

  async saveItem(item) {
    const filePath = path.join(this.newsDir, `${item.id}.json`);
    await fs.writeJson(filePath, item, { spaces: 2 });
  }

  async exportNews(format = 'json') {
    const data = {
      sources: Array.from(this.sources.values()),
      articles: Array.from(this.articles.values()),
      bookmarks: Array.from(this.bookmarks.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = NewsEngine;
