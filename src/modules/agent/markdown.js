const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownObsidianEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.vaults = new Map();
    this.notes = new Map();
    this.templates = new Map();
    this.tags = new Map();
    this.backlinks = new Map();
    this.mdDir = path.join(os.homedir(), '.pix/markdown');

    this.vaultTypes = [
      { id: 'local', name: 'Local Folder', icon: '📁', description: 'Standard local folder with markdown files' },
      { id: 'obsidian', name: 'Obsidian Vault', icon: '🔷', description: 'Full Obsidian vault support with backlinks and graph' },
      { id: 'logseq', name: 'Logseq', icon: '📝', description: 'Logseq-style block-based notes' },
      { id: 'notion', name: 'Notion Export', icon: '📋', description: 'Notion exported markdown' },
      { id: 'github', name: 'GitHub Wiki', icon: '🐙', description: 'GitHub wiki format' },
      { id: 'gitbook', name: 'GitBook', icon: '📖', description: 'GitBook format markdown' }
    ];

    this.noteTypes = [
      { id: 'note', name: 'Note', icon: '📝', color: '#4A90D9' },
      { id: 'daily', name: 'Daily Note', icon: '📅', color: '#4CAF50' },
      { id: 'meeting', name: 'Meeting Notes', icon: '🤝', color: '#FF9800' },
      { id: 'project', name: 'Project Note', icon: '📂', color: '#9C27B0' },
      { id: 'concept', name: 'Concept', icon: '💡', color: '#E91E63' },
      { id: 'reference', name: 'Reference', icon: '📖', color: '#00BCD4' },
      { id: 'task', name: 'Task', icon: '✅', color: '#8BC34A' },
      { id: 'journal', name: 'Journal', icon: '📔', color: '#795548' },
      { id: 'code', name: 'Code Snippet', icon: '💻', color: '#607D8B' },
      { id: 'book', name: 'Book Note', icon: '📚', color: '#FF5722' }
    ];

    this.markdownExtensions = [
      { id: 'yaml', name: 'YAML Frontmatter', icon: '📋', description: 'Metadata in YAML format', builtin: true },
      { id: 'wikilinks', name: 'Wiki Links', icon: '🔗', description: '[[Note Name]] style links', builtin: false },
      { id: 'backlinks', name: 'Backlinks', icon: '↩️', description: 'Automatic backlink generation', builtin: false },
      { id: 'graph', name: 'Graph View', icon: '🕸️', description: 'Visual note graph', builtin: false },
      { id: 'tags', name: 'Tags', icon: '#️⃣', description: 'Tag system with hierarchy', builtin: true },
      { id: 'callouts', name: 'Callouts', icon: '💬', description: 'Colored callout boxes', builtin: false },
      { id: 'mermaid', name: 'Mermaid Diagrams', icon: '📊', description: 'Diagram support', builtin: false },
      { id: 'math', name: 'Math (LaTeX)', icon: '🔢', description: 'Mathematical notation', builtin: false },
      { id: 'checklist', name: 'Checklists', icon: '☑️', description: 'Task checklists', builtin: true },
      { id: 'embeds', name: 'Embeds', icon: '📎', description: 'Embed files and notes', builtin: false }
    ];

    this.folderStructures = [
      { id: 'flat', name: 'Flat', icon: '📄', description: 'All notes in one folder', structure: ['notes/'] },
      { id: 'daily', name: 'Daily Notes', icon: '📅', structure: ['daily/', 'daily/{year}/', 'daily/{year}/{month}/'] },
      { id: 'zettelkasten', name: 'Zettelkasten', icon: '🗃️', structure: ['fleeting/', 'literature/', 'permanent/', 'index/'] },
      { id: 'para', name: 'PARA', icon: '📊', structure: ['projects/', 'areas/', 'resources/', 'archive/'] },
      { id: 'pkm', name: 'PKM', icon: '🧠', structure: ['inbox/', 'notes/', 'projects/', 'archive/', 'templates/'] },
      { id: 'custom', name: 'Custom', icon: '⚙️', structure: [] }
    ];

    this.searchStrategies = [
      { id: 'exact', name: 'Exact Match', icon: '🎯', description: 'Find exact text matches' },
      { id: 'fuzzy', name: 'Fuzzy Search', icon: '🔍', description: 'Approximate text matching' },
      { id: 'semantic', name: 'Semantic Search', icon: '🧠', description: 'Meaning-based search' },
      { id: 'tag', name: 'Tag Search', icon: '#️⃣', description: 'Search by tags' },
      { id: 'link', name: 'Link Search', icon: '🔗', description: 'Search by connections' },
      { id: 'regex', name: 'Regex Search', icon: ' pattern', description: 'Regular expression search' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Markdown & Obsidian Engine...');
    await fs.ensureDir(this.mdDir);
    await fs.ensureDir(path.join(this.mdDir, 'vaults'));
    await this.loadData();
    this.loadNoteTemplates();
    this.logger.info('Markdown & Obsidian Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(path.join(this.mdDir, 'vaults'));
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.mdDir, 'vaults', file));
          if (data.type === 'vault') this.vaults.set(data.id, data);
          else if (data.type === 'note') this.notes.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadNoteTemplates() {
    const defaults = [
      {
        id: 'daily-note',
        name: 'Daily Note',
        icon: '📅',
        content: '---\ndate: {{date}}\ntags: [daily]\n---\n\n# {{date}}\n\n## Tasks\n- [ ] \n\n## Notes\n\n\n## Reflections\n\n',
        type: 'daily'
      },
      {
        id: 'meeting-note',
        name: 'Meeting Notes',
        icon: '🤝',
        content: '---\ndate: {{date}}\ntags: [meeting]\nattendees: []\n---\n\n# Meeting: {{title}}\n\n**Date:** {{date}}\n**Attendees:** \n\n## Agenda\n1. \n\n## Discussion\n\n\n## Action Items\n- [ ] \n\n## Next Steps\n\n',
        type: 'meeting'
      },
      {
        id: 'project-note',
        name: 'Project Note',
        icon: '📂',
        content: '---\ntags: [project]\nstatus: active\ndeadline: \n---\n\n# Project: {{title}}\n\n## Overview\n\n\n## Goals\n- [ ] \n\n## Tasks\n- [ ] \n\n## Resources\n\n\n## Progress\n\n',
        type: 'project'
      },
      {
        id: 'concept-note',
        name: 'Concept Note',
        icon: '💡',
        content: '---\ntags: [concept]\naliases: []\n---\n\n# {{title}}\n\n## Definition\n\n\n## Key Concepts\n\n\n## Examples\n\n\n## Related Notes\n\n\n## References\n\n',
        type: 'concept'
      },
      {
        id: 'code-snippet',
        name: 'Code Snippet',
        icon: '💻',
        content: '---\ntags: [code, {{language}}]\nlanguage: {{language}}\n---\n\n# {{title}}\n\n## Description\n\n\n## Code\n\n```{{language}}\n\n```\n\n## Usage\n\n\n## Notes\n\n',
        type: 'code'
      }
    ];

    defaults.forEach(template => {
      this.templates.set(template.id, { ...template, type: 'template' });
    });
  }

  async createVault(params) {
    const {
      name,
      path: vaultPath,
      type = 'obsidian',
      structure = 'pkm',
      enableBacklinks = true,
      enableGraph = true,
      enableTags = true,
      extensions = ['yaml', 'tags', 'checklist']
    } = params;

    const id = uuidv4();
    const resolvedPath = vaultPath || path.join(this.mdDir, 'vaults', name.replace(/\s+/g, '-').toLowerCase());

    await fs.ensureDir(resolvedPath);

    if (structure !== 'flat') {
      const structureData = this.folderStructures.find(s => s.id === structure);
      if (structureData && structureData.structure) {
        for (const folder of structureData.structure) {
          const folderPath = path.join(resolvedPath, folder.replace(/\{.*?\}/g, ''));
          await fs.ensureDir(folderPath);
        }
      }
    }

    const vault = {
      id,
      name,
      path: resolvedPath,
      type,
      structure,
      enableBacklinks,
      enableGraph,
      enableTags,
      extensions,
      noteCount: 0,
      lastModified: null,
      status: 'active',
      type: 'vault',
      createdAt: new Date().toISOString()
    };

    this.vaults.set(id, vault);
    await this.saveVault(vault);

    return vault;
  }

  async detectExistingVaults(searchPaths = []) {
    const defaultPaths = [
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'iCloudDrive'),
      path.join(os.homedir(), 'Dropbox'),
      path.join(os.homedir(), 'OneDrive'),
      path.join(os.homedir(), 'Obsidian')
    ];

    const allPaths = [...searchPaths, ...defaultPaths];
    const detected = [];

    for (const searchPath of allPaths) {
      if (!await fs.pathExists(searchPath)) continue;

      try {
        const items = await fs.readdir(searchPath);
        for (const item of items) {
          const itemPath = path.join(searchPath, item);
          const stat = await fs.stat(itemPath);

          if (stat.isDirectory()) {
            const hasObsidianConfig = await fs.pathExists(path.join(itemPath, '.obsidian'));
            const hasMarkdownFiles = await this.hasMarkdownFiles(itemPath);

            if (hasObsidianConfig || hasMarkdownFiles) {
              detected.push({
                path: itemPath,
                name: item,
                type: hasObsidianConfig ? 'obsidian' : 'local',
                hasConfig: hasObsidianConfig,
                noteCount: await this.countMarkdownFiles(itemPath)
              });
            }
          }
        }
      } catch (e) {}
    }

    return detected;
  }

  async hasMarkdownFiles(dirPath) {
    try {
      const items = await fs.readdir(dirPath);
      for (const item of items) {
        if (item.endsWith('.md')) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  async countMarkdownFiles(dirPath) {
    let count = 0;
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      for (const item of items) {
        if (item.isFile() && item.name.endsWith('.md')) count++;
        else if (item.isDirectory()) {
          count += await this.countMarkdownFiles(path.join(dirPath, item.name));
        }
      }
    } catch (e) {}
    return count;
  }

  async createNote(params) {
    const {
      vaultId,
      title,
      content = '',
      type = 'note',
      template = null,
      tags = [],
      folder = null,
      frontmatter = {}
    } = params;

    const vault = this.vaults.get(vaultId);
    if (!vault) throw new Error(`Vault not found: ${vaultId}`);

    const id = uuidv4();
    const noteType = this.noteTypes.find(n => n.id === type) || this.noteTypes[0];

    let finalContent = content;
    if (template) {
      const templateData = this.templates.get(template);
      if (templateData) {
        finalContent = templateData.content
          .replace(/\{\{title\}\}/g, title)
          .replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0])
          .replace(/\{\{time\}\}/g, new Date().toTimeString().split(' ')[0]);
      }
    }

    const frontmatterData = {
      title,
      tags,
      type,
      created: new Date().toISOString(),
      ...frontmatter
    };

    const frontmatterYaml = '---\n' +
      Object.entries(frontmatterData)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? JSON.stringify(value) : value}`)
        .join('\n') +
      '\n---\n\n';

    const fullContent = finalContent.startsWith('---') ? finalContent : frontmatterYaml + finalContent;

    const notePath = folder
      ? path.join(vault.path, folder, `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`)
      : path.join(vault.path, `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`);

    await fs.ensureDir(path.dirname(notePath));
    await fs.writeFile(notePath, fullContent, 'utf-8');

    const note = {
      id,
      vaultId,
      title,
      path: notePath,
      type: noteType,
      content: fullContent,
      tags,
      frontmatter: frontmatterData,
      wordCount: fullContent.split(/\s+/).length,
      links: this.extractWikiLinks(fullContent),
      backlinks: [],
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };

    this.notes.set(id, note);
    vault.noteCount++;
    vault.lastModified = new Date().toISOString();
    this.vaults.set(vaultId, vault);

    await this.saveNote(note);
    await this.saveVault(vault);

    return note;
  }

  extractWikiLinks(content) {
    const links = [];
    const regex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      links.push({
        target: match[1],
        index: match.index,
        raw: match[0]
      });
    }

    return links;
  }

  async updateNote(id, updates) {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note not found: ${id}`);

    let newContent = note.content;

    if (updates.content !== undefined) {
      newContent = updates.content;
    } else if (updates.append) {
      newContent += '\n' + updates.append;
    } else if (updates.prepend) {
      newContent = updates.prepend + '\n' + newContent;
    }

    await fs.writeFile(note.path, newContent, 'utf-8');

    const updated = {
      ...note,
      content: newContent,
      wordCount: newContent.split(/\s+/).length,
      links: this.extractWikiLinks(newContent),
      tags: updates.tags || note.tags,
      modifiedAt: new Date().toISOString()
    };

    if (updates.tags) {
      for (const tag of updates.tags) {
        if (!this.tags.has(tag)) {
          this.tags.set(tag, { name: tag, noteIds: [id] });
        } else {
          const tagData = this.tags.get(tag);
          if (!tagData.noteIds.includes(id)) {
            tagData.noteIds.push(id);
          }
        }
      }
    }

    this.notes.set(id, updated);
    await this.saveNote(updated);

    return updated;
  }

  async deleteNote(id) {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note not found: ${id}`);

    await fs.remove(note.path).catch(() => {});
    this.notes.delete(id);

    const vault = this.vaults.get(note.vaultId);
    if (vault) {
      vault.noteCount = Math.max(0, vault.noteCount - 1);
      this.vaults.set(note.vaultId, vault);
      await this.saveVault(vault);
    }

    return { success: true };
  }

  async getNote(id) {
    return this.notes.get(id);
  }

  async readNote(id) {
    const note = this.notes.get(id);
    if (!note) throw new Error(`Note not found: ${id}`);

    const content = await fs.readFile(note.path, 'utf-8');
    note.content = content;

    return note;
  }

  async searchNotes(vaultId, query, options = {}) {
    const { strategy = 'exact', tags: filterTags, limit = 50 } = options;
    let notes = Array.from(this.notes.values()).filter(n => n.vaultId === vaultId);

    const results = [];

    for (const note of notes) {
      let score = 0;
      const contentLower = note.content.toLowerCase();
      const titleLower = note.title.toLowerCase();
      const queryLower = query.toLowerCase();

      switch (strategy) {
        case 'exact':
          if (titleLower.includes(queryLower)) score += 10;
          if (contentLower.includes(queryLower)) score += 5;
          break;

        case 'fuzzy':
          if (this.fuzzyMatch(titleLower, queryLower)) score += 10;
          if (this.fuzzyMatch(contentLower, queryLower)) score += 5;
          break;

        case 'tag':
          if (note.tags.some(t => t.toLowerCase().includes(queryLower))) score += 10;
          break;

        case 'regex':
          try {
            const regex = new RegExp(query, 'i');
            if (regex.test(note.title)) score += 10;
            if (regex.test(note.content)) score += 5;
          } catch (e) {}
          break;
      }

      if (filterTags && filterTags.length > 0) {
        if (!filterTags.some(t => note.tags.includes(t))) score = 0;
      }

      if (score > 0) {
        results.push({ ...note, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  fuzzyMatch(str, pattern) {
    let patternIdx = 0;
    let strIdx = 0;
    let score = 0;
    let consecutive = 0;

    while (strIdx < str.length && patternIdx < pattern.length) {
      if (str[strIdx] === pattern[patternIdx]) {
        score += 1 + consecutive;
        consecutive++;
        patternIdx++;
      } else {
        consecutive = 0;
      }
      strIdx++;
    }

    return patternIdx === pattern.length && score > pattern.length * 0.5;
  }

  async getBacklinks(noteId) {
    const note = this.notes.get(noteId);
    if (!note) throw new Error(`Note not found: ${noteId}`);

    const backlinks = [];
    const noteTitle = note.title;

    for (const [, otherNote] of this.notes) {
      if (otherNote.id === noteId) continue;

      const links = otherNote.links.filter(l => l.target === noteTitle);
      if (links.length > 0) {
        backlinks.push({
          noteId: otherNote.id,
          title: otherNote.title,
          linkCount: links.length
        });
      }
    }

    return backlinks;
  }

  async getGraphData(vaultId) {
    const notes = Array.from(this.notes.values()).filter(n => n.vaultId === vaultId);
    const nodes = notes.map(n => ({
      id: n.id,
      label: n.title,
      type: n.type?.id || 'note',
      size: Math.min(20, 5 + n.wordCount / 100)
    }));

    const edges = [];
    for (const note of notes) {
      for (const link of note.links) {
        const target = notes.find(n => n.title === link.target);
        if (target) {
          edges.push({
            source: note.id,
            target: target.id,
            type: 'link'
          });
        }
      }
    }

    return { nodes, edges };
  }

  async getVaultStats(vaultId) {
    const notes = Array.from(this.notes.values()).filter(n => n.vaultId === vaultId);
    const allTags = new Set();
    notes.forEach(n => n.tags.forEach(t => allTags.add(t)));

    return {
      notes: notes.length,
      totalWords: notes.reduce((sum, n) => sum + n.wordCount, 0),
      tags: allTags.size,
      links: notes.reduce((sum, n) => sum + n.links.length, 0),
      byType: this.noteTypes.map(type => ({
        ...type,
        count: notes.filter(n => n.type?.id === type.id).length
      }))
    };
  }

  getVaultTypes() {
    return this.vaultTypes;
  }

  getNoteTypes() {
    return this.noteTypes;
  }

  getTemplates() {
    return Array.from(this.templates.values());
  }

  getExtensions() {
    return this.markdownExtensions;
  }

  getFolderStructures() {
    return this.folderStructures;
  }

  async getStats() {
    const vaults = Array.from(this.vaults.values());
    const notes = Array.from(this.notes.values());

    return {
      vaults: vaults.length,
      notes: notes.length,
      totalWords: notes.reduce((sum, n) => sum + n.wordCount, 0),
      totalLinks: notes.reduce((sum, n) => sum + n.links.length, 0),
      templates: this.templates.size,
      uniqueTags: new Set(notes.flatMap(n => n.tags)).size
    };
  }

  async saveVault(vault) {
    const filePath = path.join(this.mdDir, 'vaults', `vault-${vault.id}.json`);
    await fs.writeJson(filePath, vault, { spaces: 2 });
  }

  async saveNote(note) {
    const filePath = path.join(this.mdDir, 'vaults', `note-${note.id}.json`);
    await fs.writeJson(filePath, note, { spaces: 2 });
  }

  async exportMarkdown(format = 'json') {
    const data = {
      vaults: Array.from(this.vaults.values()),
      notes: Array.from(this.notes.values()),
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = MarkdownObsidianEngine;
