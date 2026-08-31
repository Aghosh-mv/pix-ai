const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class NoteTakingEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.notes = new Map();
    this.folders = new Map();
    this.tags = new Map();
    this.templates = new Map();
    this.noteDir = path.join(os.homedir(), '.pix/notes');
  }

  async initialize() {
    this.logger.info('Initializing Note Taking Engine...');
    await fs.ensureDir(this.noteDir);
    await this.loadNotes();
    this.loadDefaultFolders();
    this.loadDefaultTemplates();
    this.logger.info('Note Taking Engine initialized');
  }

  async loadNotes() {
    try {
      const files = await fs.readdir(this.noteDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.noteDir, file));
          if (data.type === 'note') this.notes.set(data.id, data);
          else if (data.type === 'folder') this.folders.set(data.id, data);
          else if (data.type === 'template') this.templates.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadDefaultFolders() {
    const defaults = [
      { id: 'personal', name: 'Personal', icon: '📁', color: '#4CAF50' },
      { id: 'work', name: 'Work', icon: '💼', color: '#2196F3' },
      { id: 'ideas', name: 'Ideas', icon: '💡', color: '#FFC107' },
      { id: 'projects', name: 'Projects', icon: '🚀', color: '#9C27B0' },
      { id: 'recipes', name: 'Recipes', icon: '🍳', color: '#FF5722' }
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
        id: 'meeting-notes',
        name: 'Meeting Notes',
        content: '# Meeting Notes\n\n**Date:** \n**Attendees:** \n\n## Agenda\n\n## Discussion\n\n## Action Items\n\n## Next Meeting\n',
        icon: '📝'
      },
      {
        id: 'daily-journal',
        name: 'Daily Journal',
        content: '# Daily Journal - {{date}}\n\n## Mood\n\n## Gratitude\n\n\n## Highlights\n\n\n## Lessons Learned\n\n',
        icon: '📔'
      },
      {
        id: 'project-plan',
        name: 'Project Plan',
        content: '# Project Plan\n\n## Overview\n\n## Goals\n\n\n## Timeline\n\n| Phase | Start | End | Status |\n|-------|-------|-----|--------|\n| | | | |\n\n## Resources\n\n## Risks\n\n',
        icon: '📊'
      },
      {
        id: 'book-notes',
        name: 'Book Notes',
        content: '# Book Notes\n\n**Title:** \n**Author:** \n**Rating:** ⭐⭐⭐⭐⭐\n\n## Summary\n\n## Key Takeaways\n\n\n## Quotes\n\n\n## How I Will Apply This\n\n',
        icon: '📚'
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

  async createNote(params) {
    const {
      title,
      content = '',
      folderId = null,
      tags = [],
      template = null,
      pinned = false,
      starred = false
    } = params;

    const id = uuidv4();
    let noteContent = content;

    if (template) {
      const templateObj = this.templates.get(template);
      if (templateObj) {
        noteContent = templateObj.content
          .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
          .replace(/\{\{time\}\}/g, new Date().toLocaleTimeString());
      }
    }

    const note = {
      id,
      title,
      content: noteContent,
      folderId,
      tags,
      pinned,
      starred,
      wordCount: this.countWords(noteContent),
      characterCount: noteContent.length,
      lastEdited: new Date().toISOString(),
      type: 'note',
      createdAt: new Date().toISOString()
    };

    this.notes.set(id, note);
    for (const tag of tags) {
      this.tags.set(tag, (this.tags.get(tag) || 0) + 1);
    }

    return note;
  }

  async updateNote(id, updates) {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note not found: ${id}`);

    const updated = {
      ...note,
      ...updates,
      id,
      lastEdited: new Date().toISOString()
    };

    if (updates.content !== undefined) {
      updated.wordCount = this.countWords(updates.content);
      updated.characterCount = updates.content.length;
    }

    if (updates.tags) {
      for (const tag of note.tags) {
        const count = (this.tags.get(tag) || 1) - 1;
        if (count <= 0) this.tags.delete(tag);
        else this.tags.set(tag, count);
      }
      for (const tag of updates.tags) {
        this.tags.set(tag, (this.tags.get(tag) || 0) + 1);
      }
    }

    this.notes.set(id, updated);
    return updated;
  }

  async deleteNote(id) {
    const note = this.notes.get(id);
    if (note) {
      for (const tag of note.tags) {
        const count = (this.tags.get(tag) || 1) - 1;
        if (count <= 0) this.tags.delete(tag);
        else this.tags.set(tag, count);
      }
    }

    this.notes.delete(id);
    return { success: true };
  }

  async getNote(id) {
    return this.notes.get(id);
  }

  listNotes(options = {}) {
    const { folderId, tag, starred, pinned, search, sort = 'date' } = options;
    let notes = Array.from(this.notes.values());

    if (folderId) notes = notes.filter(n => n.folderId === folderId);
    if (tag) notes = notes.filter(n => n.tags.includes(tag));
    if (starred !== undefined) notes = notes.filter(n => n.starred === starred);
    if (pinned !== undefined) notes = notes.filter(n => n.pinned === pinned);
    if (search) {
      const searchLower = search.toLowerCase();
      notes = notes.filter(n =>
        n.title.toLowerCase().includes(searchLower) ||
        n.content.toLowerCase().includes(searchLower)
      );
    }

    if (sort === 'date') notes.sort((a, b) => new Date(b.lastEdited) - new Date(a.lastEdited));
    else if (sort === 'title') notes.sort((a, b) => a.title.localeCompare(b.title));

    return notes;
  }

  async searchNotes(query) {
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

  async createFolder(params) {
    const { name, icon = '📁', color = '#2196F3', parentId = null } = params;
    const id = uuidv4();

    const folder = {
      id,
      name,
      icon,
      color,
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

  getTags() {
    return Array.from(this.tags.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  async getStats() {
    const notes = Array.from(this.notes.values());
    const totalWords = notes.reduce((sum, n) => sum + (n.wordCount || 0), 0);

    return {
      totalNotes: notes.length,
      totalFolders: this.folders.size,
      totalTemplates: this.templates.size,
      totalWords,
      starred: notes.filter(n => n.starred).length,
      pinned: notes.filter(n => n.pinned).length,
      tags: this.tags.size
    };
  }

  async exportNotes(format = 'json') {
    const data = {
      notes: Array.from(this.notes.values()),
      folders: Array.from(this.folders.values()),
      templates: Array.from(this.templates.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'markdown') {
      return notes.map(n => `# ${n.title}\n\n${n.content}\n\n---\n`).join('\n');
    }

    return data;
  }
}

module.exports = NoteTakingEngine;
