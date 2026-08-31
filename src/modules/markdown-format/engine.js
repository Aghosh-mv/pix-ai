const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownFormatEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.formats = new Map();
    this.formatDir = path.join(os.homedir(), '.pix/markdown-format');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Format Engine...');
    await fs.ensureDir(this.formatDir);
    await this.loadFormats();
    this.loadPresets();
    this.loadRules();
    this.logger.info('Markdown Format Engine initialized');
  }

  async loadFormats() {
    try {
      const files = await fs.readdir(this.formatDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.formatDir, file));
          if (data.type === 'preset') this.formats.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadPresets() {
    const defaults = [
      {
        id: 'standard',
        name: 'Standard',
        description: 'Standard Markdown formatting',
        icon: '📝',
        rules: {
          headingSpacing: true,
          listIndentation: 2,
          blankLineBeforeHeading: true,
          blankLineBeforeList: false,
          maxLineLength: 0,
          trimTrailingWhitespace: true,
          ensureFinalNewline: true
        }
      },
      {
        id: 'strict',
        name: 'Strict',
        description: 'Strict CommonMark formatting',
        icon: '📋',
        rules: {
          headingSpacing: true,
          listIndentation: 2,
          blankLineBeforeHeading: true,
          blankLineBeforeList: true,
          maxLineLength: 80,
          trimTrailingWhitespace: true,
          ensureFinalNewline: true,
          noTrailingPunctuation: true
        }
      },
      {
        id: 'github',
        name: 'GitHub Style',
        description: 'GitHub-flavored Markdown formatting',
        icon: '🐙',
        rules: {
          headingSpacing: true,
          listIndentation: 2,
          blankLineBeforeHeading: true,
          blankLineBeforeList: false,
          maxLineLength: 0,
          trimTrailingWhitespace: true,
          ensureFinalNewline: true,
          fencedCodeBlockLanguage: true
        }
      }
    ];

    defaults.forEach(preset => {
      if (!this.formats.has(preset.id)) {
        this.formats.set(preset.id, {
          ...preset,
          type: 'preset',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  loadRules() {
    this.formatRules = [
      { id: 'headingSpacing', name: 'Heading Spacing', description: 'Add blank lines around headings', icon: '📏' },
      { id: 'listIndentation', name: 'List Indentation', description: 'Indent list items consistently', icon: '📋' },
      { id: 'blankLineBeforeHeading', name: 'Blank Line Before Heading', description: 'Add blank line before headings', icon: '⬆️' },
      { id: 'blankLineBeforeList', name: 'Blank Line Before List', description: 'Add blank line before lists', icon: '📝' },
      { id: 'maxLineLength', name: 'Max Line Length', description: 'Wrap lines at specified length', icon: '↔️' },
      { id: 'trimTrailingWhitespace', name: 'Trim Trailing Whitespace', description: 'Remove trailing spaces', icon: '✂️' },
      { id: 'ensureFinalNewline', name: 'Ensure Final Newline', description: 'Add newline at end of file', icon: '↩️' },
      { id: 'consistentEmphasis', name: 'Consistent Emphasis', description: 'Use consistent emphasis markers', icon: '🔤' },
      { id: 'fencedCodeBlockLanguage', name: 'Fenced Code Block Language', description: 'Add language to fenced code blocks', icon: '💻' }
    ];
  }

  async formatMarkdown(content, presetId = 'standard') {
    const preset = this.formats.get(presetId) || this.formats.get('standard');
    let formatted = content;
    const rules = preset.rules;

    if (rules.trimTrailingWhitespace) {
      formatted = formatted.replace(/[ \t]+$/gm, '');
    }

    if (rules.headingSpacing) {
      formatted = formatted.replace(/^(#{1,6}\s.+)$/gm, '\n$1\n');
      formatted = formatted.replace(/\n{3,}/g, '\n\n');
    }

    if (rules.blankLineBeforeHeading) {
      formatted = formatted.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
    }

    if (rules.listIndentation) {
      formatted = formatted.replace(/^(\s*)[-*]\s/gm, (match, indent) => {
        const spaces = ' '.repeat(rules.listIndentation);
        return `${spaces}- `;
      });
    }

    if (rules.maxLineLength > 0) {
      const lines = formatted.split('\n');
      const wrappedLines = [];

      for (const line of lines) {
        if (line.length > rules.maxLineLength && !line.startsWith('#') && !line.startsWith('```')) {
          const words = line.split(' ');
          let currentLine = '';

          for (const word of words) {
            if ((currentLine + ' ' + word).length > rules.maxLineLength) {
              wrappedLines.push(currentLine.trim());
              currentLine = word;
            } else {
              currentLine += ' ' + word;
            }
          }
          wrappedLines.push(currentLine.trim());
        } else {
          wrappedLines.push(line);
        }
      }

      formatted = wrappedLines.join('\n');
    }

    if (rules.ensureFinalNewline && !formatted.endsWith('\n')) {
      formatted += '\n';
    }

    return formatted;
  }

  async createPreset(params) {
    const { name, description = '', rules = {}, icon = '📝' } = params;

    const id = uuidv4();
    const preset = {
      id,
      name,
      description,
      rules: {
        headingSpacing: true,
        listIndentation: 2,
        blankLineBeforeHeading: true,
        blankLineBeforeList: false,
        maxLineLength: 0,
        trimTrailingWhitespace: true,
        ensureFinalNewline: true,
        ...rules
      },
      icon,
      type: 'preset',
      createdAt: new Date().toISOString()
    };

    this.formats.set(id, preset);
    return preset;
  }

  async updatePreset(id, updates) {
    const preset = this.formats.get(id);
    if (!preset) throw new Error(`Preset not found: ${id}`);

    const updated = { ...preset, ...updates };
    this.formats.set(id, updated);
    return updated;
  }

  async deletePreset(id) {
    this.formats.delete(id);
    return { success: true };
  }

  listPresets() {
    return Array.from(this.formats.values());
  }

  getRules() {
    return this.formatRules;
  }

  async validateMarkdown(content) {
    const issues = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (line.endsWith(' ') || line.endsWith('\t')) {
        issues.push({ line: lineNum, type: 'warning', message: 'Trailing whitespace' });
      }

      if (line.length > 80) {
        issues.push({ line: lineNum, type: 'info', message: `Line exceeds 80 characters (${line.length})` });
      }

      if (line.match(/^#{1,6}\s/) && i > 0 && lines[i - 1].trim() !== '') {
        issues.push({ line: lineNum, type: 'warning', message: 'No blank line before heading' });
      }

      if (line.match(/^[-*]\s/) && i > 0 && lines[i - 1].trim() !== '' && !lines[i - 1].match(/^[-*]\s/)) {
        issues.push({ line: lineNum, type: 'info', message: 'Consider adding blank line before list' });
      }
    }

    return {
      valid: issues.filter(i => i.type === 'error').length === 0,
      issues,
      stats: {
        errors: issues.filter(i => i.type === 'error').length,
        warnings: issues.filter(i => i.type === 'warning').length,
        info: issues.filter(i => i.type === 'info').length
      }
    };
  }

  async getStats() {
    return {
      presets: this.formats.size,
      rules: this.formatRules.length
    };
  }

  async exportPresets(format = 'json') {
    const presets = Array.from(this.formats.values());

    if (format === 'json') {
      return JSON.stringify(presets, null, 2);
    }

    return presets;
  }
}

module.exports = MarkdownFormatEngine;
