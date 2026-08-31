const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ReadingEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.books = new Map();
    this.articles = new Map();
    this.readingLists = new Map();
    this.notes = new Map();
    this.readingDir = path.join(os.homedir(), '.pix/reading');
  }

  async initialize() {
    this.logger.info('Initializing Reading Engine...');
    await fs.ensureDir(this.readingDir);
    await this.loadReading();
    this.loadCategories();
    this.logger.info('Reading Engine initialized');
  }

  async loadReading() {
    try {
      const files = await fs.readdir(this.readingDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.readingDir, file));
          if (data.type === 'book') this.books.set(data.id, data);
          else if (data.type === 'article') this.articles.set(data.id, data);
          else if (data.type === 'readingList') this.readingLists.set(data.id, data);
          else if (data.type === 'note') this.notes.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadCategories() {
    this.categories = [
      { id: 'fiction', name: 'Fiction', icon: '📖' },
      { id: 'non-fiction', name: 'Non-Fiction', icon: '📚' },
      { id: 'technical', name: 'Technical', icon: '💻' },
      { id: 'business', name: 'Business', icon: '💼' },
      { id: 'self-help', name: 'Self Help', icon: '💪' },
      { id: 'biography', name: 'Biography', icon: '👤' },
      { id: 'history', name: 'History', icon: '📜' },
      { id: 'science', name: 'Science', icon: '🔬' },
      { id: 'other', name: 'Other', icon: '✨' }
    ];
  }

  async addBook(params) {
    const {
      title,
      author,
      isbn = '',
      category = 'other',
      pages = 0,
      currentPage = 0,
      rating = 0,
      review = '',
      notes = '',
      status = 'to-read',
      coverImage = null,
      publisher = '',
      publishYear = null,
      tags = []
    } = params;

    const id = uuidv4();
    const book = {
      id,
      title,
      author,
      isbn,
      category,
      pages,
      currentPage,
      percentageRead: pages > 0 ? Math.round((currentPage / pages) * 100) : 0,
      rating,
      review,
      notes,
      status,
      coverImage,
      publisher,
      publishYear,
      tags,
      startedReading: status === 'reading' ? new Date().toISOString() : null,
      finishedReading: status === 'finished' ? new Date().toISOString() : null,
      type: 'book',
      createdAt: new Date().toISOString()
    };

    this.books.set(id, book);
    return book;
  }

  async updateBook(id, updates) {
    const book = this.books.get(id);
    if (!book) throw new Error(`Book not found: ${id}`);

    const updated = {
      ...book,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    if (updates.currentPage !== undefined && book.pages > 0) {
      updated.percentageRead = Math.round((updated.currentPage / book.pages) * 100);
    }

    if (updates.status === 'reading' && !book.startedReading) {
      updated.startedReading = new Date().toISOString();
    }

    if (updates.status === 'finished' && !book.finishedReading) {
      updated.finishedReading = new Date().toISOString();
      updated.currentPage = book.pages;
      updated.percentageRead = 100;
    }

    this.books.set(id, updated);
    return updated;
  }

  async deleteBook(id) {
    this.books.delete(id);
    return { success: true };
  }

  async getBook(id) {
    return this.books.get(id);
  }

  listBooks(options = {}) {
    const { category, status, author, rating, search } = options;
    let books = Array.from(this.books.values());

    if (category) books = books.filter(b => b.category === category);
    if (status) books = books.filter(b => b.status === status);
    if (author) {
      const authorLower = author.toLowerCase();
      books = books.filter(b => b.author.toLowerCase().includes(authorLower));
    }
    if (rating) books = books.filter(b => b.rating >= rating);
    if (search) {
      const searchLower = search.toLowerCase();
      books = books.filter(b =>
        b.title.toLowerCase().includes(searchLower) ||
        b.author.toLowerCase().includes(searchLower)
      );
    }

    return books;
  }

  async addArticle(params) {
    const {
      title,
      url = '',
      content = '',
      source = '',
      author = '',
      category = 'other',
      readTime = 5,
      tags = []
    } = params;

    const id = uuidv4();
    const article = {
      id,
      title,
      url,
      content,
      source,
      author,
      category,
      readTime,
      tags,
      read: false,
      readAt: null,
      notes: '',
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

  async markArticleRead(id) {
    const article = this.articles.get(id);
    if (!article) throw new Error(`Article not found: ${id}`);

    article.read = true;
    article.readAt = new Date().toISOString();
    this.articles.set(id, article);
    return article;
  }

  async deleteArticle(id) {
    this.articles.delete(id);
    return { success: true };
  }

  listArticles(options = {}) {
    const { category, read, search } = options;
    let articles = Array.from(this.articles.values());

    if (category) articles = articles.filter(a => a.category === category);
    if (read !== undefined) articles = articles.filter(a => a.read === read);
    if (search) {
      const searchLower = search.toLowerCase();
      articles = articles.filter(a => a.title.toLowerCase().includes(searchLower));
    }

    return articles;
  }

  async createReadingList(params) {
    const { name, description = '', bookIds = [] } = params;
    const id = uuidv4();

    const list = {
      id,
      name,
      description,
      bookIds,
      type: 'readingList',
      createdAt: new Date().toISOString()
    };

    this.readingLists.set(id, list);
    return list;
  }

  async addToReadingList(listId, bookId) {
    const list = this.readingLists.get(listId);
    if (!list) throw new Error(`Reading list not found: ${listId}`);

    if (!list.bookIds.includes(bookId)) {
      list.bookIds.push(bookId);
    }

    return list;
  }

  async removeFromReadingList(listId, bookId) {
    const list = this.readingLists.get(listId);
    if (!list) throw new Error(`Reading list not found: ${listId}`);

    list.bookIds = list.bookIds.filter(id => id !== bookId);
    return list;
  }

  listReadingLists() {
    return Array.from(this.readingLists.values());
  }

  async addNote(params) {
    const { bookId, page, content, highlight = '' } = params;
    const id = uuidv4();

    const note = {
      id,
      bookId,
      page,
      content,
      highlight,
      type: 'note',
      createdAt: new Date().toISOString()
    };

    this.notes.set(id, note);
    return note;
  }

  async getNotes(bookId) {
    return Array.from(this.notes.values())
      .filter(n => n.bookId === bookId)
      .sort((a, b) => a.page - b.page);
  }

  async deleteNote(id) {
    this.notes.delete(id);
    return { success: true };
  }

  async getReadingStats() {
    const books = Array.from(this.books.values());
    const articles = Array.from(this.articles.values());
    const totalPages = books.reduce((sum, b) => sum + (b.currentPage || 0), 0);

    return {
      totalBooks: books.length,
      reading: books.filter(b => b.status === 'reading').length,
      finished: books.filter(b => b.status === 'finished').length,
      toRead: books.filter(b => b.status === 'to-read').length,
      totalPages,
      articles: articles.length,
      articlesRead: articles.filter(a => a.read).length,
      readingLists: this.readingLists.size,
      notes: this.notes.size
    };
  }

  getCategories() {
    return this.categories;
  }

  async searchReading(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, book] of this.books) {
      if (book.title.toLowerCase().includes(queryLower) ||
          book.author.toLowerCase().includes(queryLower)) {
        results.push({ ...book, type: 'book', score: 10 });
      }
    }

    for (const [, article] of this.articles) {
      if (article.title.toLowerCase().includes(queryLower)) {
        results.push({ ...article, score: 5 });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async exportReading(format = 'json') {
    const data = {
      books: Array.from(this.books.values()),
      articles: Array.from(this.articles.values()),
      readingLists: Array.from(this.readingLists.values()),
      notes: Array.from(this.notes.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = ReadingEngine;
