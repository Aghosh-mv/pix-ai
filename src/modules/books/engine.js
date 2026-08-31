const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class BookEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.books = new Map();
    this.readingLists = new Map();
    this.highlights = new Map();
    this.bookDir = path.join(os.homedir(), '.pix/books');
  }

  async initialize() {
    this.logger.info('Initializing Book Engine...');
    await fs.ensureDir(this.bookDir);
    await this.loadBooks();
    this.loadDefaultCategories();
    this.logger.info('Book Engine initialized');
  }

  async loadBooks() {
    try {
      const files = await fs.readdir(this.bookDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const book = await fs.readJson(path.join(this.bookDir, file));
          this.books.set(book.id, book);
        }
      }
    } catch (e) {}
  }

  loadDefaultCategories() {
    this.categories = [
      { id: 'fiction', name: 'Fiction', icon: '📖' },
      { id: 'non-fiction', name: 'Non-Fiction', icon: '📚' },
      { id: 'sci-fi', name: 'Science Fiction', icon: '🚀' },
      { id: 'fantasy', name: 'Fantasy', icon: '🧙' },
      { id: 'mystery', name: 'Mystery', icon: '🔍' },
      { id: 'romance', name: 'Romance', icon: '💕' },
      { id: 'self-help', name: 'Self Help', icon: '💪' },
      { id: 'business', name: 'Business', icon: '💼' },
      { id: 'technology', name: 'Technology', icon: '💻' },
      { id: 'history', name: 'History', icon: '📜' }
    ];
  }

  async createBook(params) {
    const {
      title,
      author,
      isbn = '',
      category = 'fiction',
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.books.set(id, book);
    await this.saveBook(book);

    this.logger.info(`Book added: ${title}`);
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
    await this.saveBook(updated);

    return updated;
  }

  async deleteBook(id) {
    this.books.delete(id);
    await fs.remove(path.join(this.bookDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getBook(id) {
    return this.books.get(id);
  }

  listBooks(options = {}) {
    const { category, status, author, rating, search, limit = 50 } = options;

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

    return books.slice(0, limit);
  }

  async addHighlight(params) {
    const { bookId, page, text, note = '', color = '#fff176' } = params;

    const id = uuidv4();
    const highlight = {
      id,
      bookId,
      page,
      text,
      note,
      color,
      createdAt: new Date().toISOString()
    };

    this.highlights.set(id, highlight);
    return highlight;
  }

  async getHighlights(bookId) {
    return Array.from(this.highlights.values())
      .filter(h => h.bookId === bookId)
      .sort((a, b) => a.page - b.page);
  }

  async deleteHighlight(id) {
    this.highlights.delete(id);
    return { success: true };
  }

  async createReadingList(params) {
    const { name, description = '', bookIds = [] } = params;
    const id = uuidv4();

    const readingList = {
      id,
      name,
      description,
      bookIds,
      createdAt: new Date().toISOString()
    };

    this.readingLists.set(id, readingList);
    return readingList;
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

  getReadingLists() {
    return Array.from(this.readingLists.values());
  }

  getCategories() {
    return this.categories;
  }

  async getReadingStats() {
    const books = Array.from(this.books.values());
    const finished = books.filter(b => b.status === 'finished');
    const reading = books.filter(b => b.status === 'reading');
    const totalPages = finished.reduce((sum, b) => sum + b.pages, 0);

    return {
      totalBooks: books.length,
      finished: finished.length,
      reading: reading.length,
      toRead: books.filter(b => b.status === 'to-read').length,
      totalPages,
      averageRating: finished.length > 0
        ? (finished.reduce((sum, b) => sum + b.rating, 0) / finished.length).toFixed(1)
        : 0,
      byCategory: this.getBooksByCategory()
    };
  }

  getBooksByCategory() {
    const books = Array.from(this.books.values());
    const byCategory = {};

    for (const book of books) {
      byCategory[book.category] = (byCategory[book.category] || 0) + 1;
    }

    return byCategory;
  }

  async searchBooks(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, book] of this.books) {
      let score = 0;

      if (book.title.toLowerCase().includes(queryLower)) score += 10;
      if (book.author.toLowerCase().includes(queryLower)) score += 8;
      if (book.isbn.includes(query)) score += 6;

      if (score > 0) {
        results.push({ ...book, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async saveBook(book) {
    const filePath = path.join(this.bookDir, `${book.id}.json`);
    await fs.writeJson(filePath, book, { spaces: 2 });
  }

  async exportBooks(format = 'json') {
    const books = Array.from(this.books.values());

    if (format === 'json') {
      return JSON.stringify(books, null, 2);
    }

    if (format === 'csv') {
      const headers = ['title', 'author', 'category', 'pages', 'rating', 'status'];
      const rows = books.map(b => [
        b.title,
        b.author,
        b.category,
        b.pages,
        b.rating,
        b.status
      ]);
      return [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    }

    return books;
  }
}

module.exports = BookEngine;
