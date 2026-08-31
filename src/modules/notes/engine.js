const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class NotesEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.notes = new Map();
    this.tags = new Set();
    this.folders = new Map();
    this.notesDir = path.join(os.homedir(), '.pix/notes');
  }

  async initialize() {
    this.logger.info('Initializing Notes Engine...');
    await fs.ensureDir(this.notesDir);
    await this.loadNotes();
    this.loadDefaultFolders();
    this.logger.info('Notes Engine initialized');
  }

  async loadNotes() {
    try {
      const files = await fs.readdir(this.notesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const note = await fs.readJson(path.join(this.notesDir, file));
          this.notes.set(note.id, note);
          if (note.tags) {
            note.tags.forEach(t => this.tags.add(t));
          }
        }
      }
    } catch (e) {}
  }

  loadDefaultFolders() {
    const folders = [
      { id: 'default', name: 'Notes', icon: '📝' },
      { id: 'work', name: 'Work', icon: '💼' },
      { id: 'personal', name: 'Personal', icon: '🏠' },
      { id: 'ideas', name: 'Ideas', icon: '💡' },
      { id: 'archive', name: 'Archive', icon: '📦' }
    ];

    folders.forEach(folder => {
      this.folders.set(folder.id, folder);
    });
  }

  async create(params) {
    const {
      title,
      content = '',
      folderId = 'default',
      tags = [],
      pinned = false,
      color = null
    } = params;

    const id = uuidv4();
    const note = {
      id,
      title,
      content,
      folderId,
      tags,
      pinned,
      color,
      wordCount: this.countWords(content),
      characterCount: content.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpened: null
    };

    this.notes.set(id, note);
    tags.forEach(t => this.tags.add(t));

    await this.saveNote(note);

    this.logger.info(`Note created: ${title}`);
    return note;
  }

  async update(id, updates) {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note not found: ${id}`);

    const updated = {
      ...note,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    if (updates.content !== undefined) {
      updated.wordCount = this.countWords(updates.content);
      updated.characterCount = updates.content.length;
    }

    if (updates.tags) {
      updates.tags.forEach(t => this.tags.add(t));
    }

    this.notes.set(id, updated);
    await this.saveNote(updated);

    return updated;
  }

  async delete(id) {
    this.notes.delete(id);
    await fs.remove(path.join(this.notesDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async get(id) {
    const note = this.notes.get(id);
    if (note) {
      note.lastOpened = new Date().toISOString();
      this.notes.set(id, note);
      await this.saveNote(note);
    }
    return note;
  }

  list(options = {}) {
    const { folderId, tags, pinned, limit = 100, offset = 0 } = options;

    let notes = Array.from(this.notes.values());

    if (folderId) notes = notes.filter(n => n.folderId === folderId);
    if (tags && tags.length > 0) notes = notes.filter(n => tags.some(t => n.tags.includes(t)));
    if (pinned !== undefined) notes = notes.filter(n => n.pinned === pinned);

    notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    return {
      notes: notes.slice(offset, offset + limit),
      total: notes.length
    };
  }

  async search(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, note] of this.notes) {
      let score = 0;

      if (note.title.toLowerCase().includes(queryLower)) score += 10;
      if (note.content.toLowerCase().includes(queryLower)) score += 5;
      if (note.tags.some(t => t.toLowerCase().includes(queryLower))) score += 3;

      if (score > 0) {
        results.push({ ...note, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async pin(id) {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note not found: ${id}`);

    note.pinned = !note.pinned;
    note.updatedAt = new Date().toISOString();
    this.notes.set(id, note);
    await this.saveNote(note);

    return note;
  }

  async moveToFolder(id, folderId) {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note not found: ${id}`);

    note.folderId = folderId;
    note.updatedAt = new Date().toISOString();
    this.notes.set(id, note);
    await this.saveNote(note);

    return note;
  }

  async addTag(id, tag) {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note not found: ${id}`);

    if (!note.tags.includes(tag)) {
      note.tags.push(tag);
      this.tags.add(tag);
      note.updatedAt = new Date().toISOString();
      this.notes.set(id, note);
      await this.saveNote(note);
    }

    return note;
  }

  async removeTag(id, tag) {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note not found: ${id}`);

    note.tags = note.tags.filter(t => t !== tag);
    note.updatedAt = new Date().toISOString();
    this.notes.set(id, note);
    await this.saveNote(note);

    return note;
  }

  createFolder(params) {
    const { id, name, icon = '📁' } = params;
    const folder = { id, name, icon };
    this.folders.set(id, folder);
    return folder;
  }

  updateFolder(id, updates) {
    const folder = this.folders.get(id);
    if (!folder) throw new Error(`Folder not found: ${id}`);

    const updated = { ...folder, ...updates };
    this.folders.set(id, updated);
    return updated;
  }

  deleteFolder(id) {
    this.folders.delete(id);
    return { success: true };
  }

  listFolders() {
    return Array.from(this.folders.values());
  }

  getAllTags() {
    return Array.from(this.tags);
  }

  async getRecentNotes(limit = 10) {
    return Array.from(this.notes.values())
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, limit);
  }

  async getPinnedNotes() {
    return Array.from(this.notes.values())
      .filter(n => n.pinned)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async duplicate(id) {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note not found: ${id}`);

    return this.create({
      title: `${note.title} (Copy)`,
      content: note.content,
      folderId: note.folderId,
      tags: [...note.tags],
      pinned: false,
      color: note.color
    });
  }

  async exportNote(id, format = 'markdown') {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note not found: ${id}`);

    if (format === 'markdown') {
      let md = `# ${note.title}\n\n`;
      if (note.tags.length > 0) {
        md += `Tags: ${note.tags.join(', ')}\n\n`;
      }
      md += note.content;
      return md;
    }

    if (format === 'html') {
      let html = `<h1>${note.title}</h1>\n`;
      if (note.tags.length > 0) {
        html += `<p><em>Tags: ${note.tags.join(', ')}</em></p>\n`;
      }
      html += `<div>${note.content.replace(/\n/g, '<br>')}</div>`;
      return html;
    }

    return JSON.stringify(note, null, 2);
  }

  async import(content, format = 'markdown') {
    if (format === 'markdown') {
      const lines = content.split('\n');
      const title = lines[0].replace(/^#\s*/, '') || 'Imported Note';
      const body = lines.slice(1).join('\n').trim();

      return this.create({ title, content: body });
    }

    const data = JSON.parse(content);
    return this.create({
      title: data.title,
      content: data.content,
      tags: data.tags || [],
      folderId: data.folderId || 'default'
    });
  }

  countWords(text) {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  async getStats() {
    const notes = Array.from(this.notes.values());
    const totalWords = notes.reduce((sum, n) => sum + n.wordCount, 0);
    const totalChars = notes.reduce((sum, n) => sum + n.characterCount, 0);

    return {
      totalNotes: notes.length,
      totalWords,
      totalCharacters: totalChars,
      folders: this.folders.size,
      tags: this.tags.size,
      pinned: notes.filter(n => n.pinned).length
    };
  }

  async saveNote(note) {
    const filePath = path.join(this.notesDir, `${note.id}.json`);
    await fs.writeJson(filePath, note, { spaces: 2 });
  }

  async exportAll(format = 'json') {
    const notes = Array.from(this.notes.values());

    if (format === 'json') {
      return JSON.stringify(notes, null, 2);
    }

    if (format === 'markdown') {
      return notes.map(n => this.exportNote(n.id, 'markdown')).join('\n\n---\n\n');
    }

    return notes;
  }

  async importAll(data) {
    const notes = Array.isArray(data) ? data : JSON.parse(data);
    let imported = 0;

    for (const note of notes) {
      await this.create({
        title: note.title,
        content: note.content,
        folderId: note.folderId,
        tags: note.tags || [],
        pinned: note.pinned || false,
        color: note.color
      });
      imported++;
    }

    return { imported };
  }
}

module.exports = NotesEngine;
