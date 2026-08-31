const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class JournalEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.entries = new Map();
    this.prompts = new Map();
    this.journalDir = path.join(os.homedir(), '.pix/journal');
  }

  async initialize() {
    this.logger.info('Initializing Journal Engine...');
    await fs.ensureDir(this.journalDir);
    await this.loadEntries();
    this.loadDefaultPrompts();
    this.logger.info('Journal Engine initialized');
  }

  async loadEntries() {
    try {
      const files = await fs.readdir(this.journalDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const entry = await fs.readJson(path.join(this.journalDir, file));
          this.entries.set(entry.id, entry);
        }
      }
    } catch (e) {}
  }

  loadDefaultPrompts() {
    const prompts = [
      { id: 'gratitude', category: 'gratitude', text: 'What are you grateful for today?' },
      { id: 'mood', category: 'reflection', text: 'How are you feeling right now? Why?' },
      { id: 'goals', category: 'goals', text: 'What are your top 3 goals for today?' },
      { id: 'challenge', category: 'reflection', text: 'What challenged you today? How did you handle it?' },
      { id: 'win', category: 'reflection', text: 'What was your biggest win today?' },
      { id: 'learn', category: 'learning', text: 'What did you learn today?' },
      { id: 'tomorrow', category: 'planning', text: 'What do you want to accomplish tomorrow?' },
      { id: 'stress', category: 'wellness', text: 'What is causing you stress? How can you address it?' },
      { id: 'health', category: 'wellness', text: 'How did you take care of your health today?' },
      { id: 'relationship', category: 'relationships', text: 'How did you connect with others today?' },
      { id: 'creative', category: 'creativity', text: 'What creative idea came to you today?' },
      { id: 'fear', category: 'reflection', text: 'What are you afraid of? Why?' },
      { id: 'success', category: 'reflection', text: 'What made today successful?' },
      { id: 'improve', category: 'goals', text: 'What could you do better tomorrow?' },
      { id: 'highlight', category: 'reflection', text: 'What was the highlight of your day?' }
    ];

    prompts.forEach(prompt => {
      this.prompts.set(prompt.id, prompt);
    });
  }

  async create(params) {
    const {
      title,
      content = '',
      mood = null,
      tags = [],
      date = new Date().toISOString(),
      weather = null,
      location = null,
      activities = [],
      gratitude = [],
      rating = null
    } = params;

    const id = uuidv4();
    const entry = {
      id,
      title,
      content,
      mood,
      tags,
      date: new Date(date).toISOString(),
      weather,
      location,
      activities,
      gratitude,
      rating,
      wordCount: this.countWords(content),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.entries.set(id, entry);
    await this.saveEntry(entry);

    this.logger.info(`Journal entry created: ${title}`);
    return entry;
  }

  async update(id, updates) {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Journal entry not found: ${id}`);

    const updated = {
      ...entry,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    if (updates.content !== undefined) {
      updated.wordCount = this.countWords(updates.content);
    }

    this.entries.set(id, updated);
    await this.saveEntry(updated);

    return updated;
  }

  async delete(id) {
    this.entries.delete(id);
    await fs.remove(path.join(this.journalDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async get(id) {
    return this.entries.get(id);
  }

  list(options = {}) {
    const { startDate, endDate, mood, tags, limit = 100, offset = 0 } = options;

    let entries = Array.from(this.entries.values());

    if (startDate) entries = entries.filter(e => new Date(e.date) >= new Date(startDate));
    if (endDate) entries = entries.filter(e => new Date(e.date) <= new Date(endDate));
    if (mood) entries = entries.filter(e => e.mood === mood);
    if (tags && tags.length > 0) entries = entries.filter(e => tags.some(t => e.tags.includes(t)));

    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      entries: entries.slice(offset, offset + limit),
      total: entries.length
    };
  }

  async search(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, entry] of this.entries) {
      let score = 0;

      if (entry.title.toLowerCase().includes(queryLower)) score += 10;
      if (entry.content.toLowerCase().includes(queryLower)) score += 5;
      if (entry.tags.some(t => t.toLowerCase().includes(queryLower))) score += 3;

      if (score > 0) {
        results.push({ ...entry, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getEntryForDate(date) {
    const d = new Date(date);
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

    const entries = Array.from(this.entries.values());
    return entries.find(e => {
      const entryDate = new Date(e.date);
      return entryDate >= startOfDay && entryDate <= endOfDay;
    });
  }

  async getStreak() {
    const entries = Array.from(this.entries.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (entries.length === 0) return 0;

    let streak = 1;
    let currentDate = new Date(entries[0].date);

    for (let i = 1; i < entries.length; i++) {
      const entryDate = new Date(entries[i].date);
      const diffDays = Math.floor((currentDate - entryDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        streak++;
        currentDate = entryDate;
      } else if (diffDays > 1) {
        break;
      }
    }

    return streak;
  }

  async getMoodStats() {
    const entries = Array.from(this.entries.values());
    const moodCounts = {};

    for (const entry of entries) {
      if (entry.mood) {
        moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
      }
    }

    return moodCounts;
  }

  async getWordCountStats() {
    const entries = Array.from(this.entries.values());
    const totalWords = entries.reduce((sum, e) => sum + e.wordCount, 0);
    const avgWords = entries.length > 0 ? Math.round(totalWords / entries.length) : 0;

    return {
      totalWords,
      averageWords: avgWords,
      totalEntries: entries.length
    };
  }

  getRandomPrompt() {
    const prompts = Array.from(this.prompts.values());
    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  getPrompts(category = null) {
    const prompts = Array.from(this.prompts.values());
    if (category) {
      return prompts.filter(p => p.category === category);
    }
    return prompts;
  }

  async getStats() {
    const entries = Array.from(this.entries.values());
    const totalWords = entries.reduce((sum, e) => sum + e.wordCount, 0);
    const moods = await this.getMoodStats();
    const streak = await this.getStreak();

    return {
      totalEntries: entries.length,
      totalWords,
      streak,
      moods,
      averageWordsPerEntry: entries.length > 0 ? Math.round(totalWords / entries.length) : 0
    };
  }

  async exportEntries(format = 'json') {
    const entries = Array.from(this.entries.values());

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    if (format === 'markdown') {
      return entries.map(e => {
        let md = `# ${e.title}\n\n`;
        md += `Date: ${new Date(e.date).toLocaleDateString()}\n`;
        if (e.mood) md += `Mood: ${e.mood}\n`;
        if (e.rating) md += `Rating: ${e.rating}/5\n`;
        md += '\n';
        md += e.content;
        return md;
      }).join('\n\n---\n\n');
    }

    return entries;
  }

  async importEntries(data) {
    const entries = Array.isArray(data) ? data : JSON.parse(data);
    let imported = 0;

    for (const entry of entries) {
      await this.create({
        title: entry.title,
        content: entry.content,
        mood: entry.mood,
        tags: entry.tags || [],
        date: entry.date,
        rating: entry.rating
      });
      imported++;
    }

    return { imported };
  }

  countWords(text) {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  async saveEntry(entry) {
    const filePath = path.join(this.journalDir, `${entry.id}.json`);
    await fs.writeJson(filePath, entry, { spaces: 2 });
  }
}

module.exports = JournalEngine;
