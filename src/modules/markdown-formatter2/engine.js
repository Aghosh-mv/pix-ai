const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownFormatterEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.formatters = new Map();
    this.formatDir = path.join(os.homedir(), '.pix/markdown-formatter');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Formatter Engine...');
    await fs.ensureDir(this.formatDir);
    await this.loadFormatters();
    this.loadPresets();
    this.loadRules();
    this.logger.info('Markdown Formatter Engine initialized');
  }

  async loadFormatters() {
    try {
      const files = await fs.readdir(this.formatDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.formatDir, file));
          if (data.type === 'formatter') this.formatters.set(data.id, data);
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
      },
      {
        id: 'prettier',
        name: 'Prettier Style',
        description: 'Prettier-inspired formatting',
        icon: '✨',
        rules: {
          headingSpacing: true,
          listIndentation: 2,
          blankLineBeforeHeading: true,
          blankLineBeforeList: true,
          maxLineLength: 80,
          trimTrailingWhitespace: true,
          ensureFinalNewline: true,
          consistentQuoteStyle: true
        }
      }
    ];

    defaults.forEach(preset => {
      if (!this.formatters.has(preset.id)) {
        this.formatters.set(preset.id, {
          ...preset,
          type: 'formatter',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  loadRules() {
    this.formatRules = [
      { id: 'headingSpacing', name: 'Heading Spacing', description: 'Add blank lines around headings', icon: '📏', enabled: true },
      { id: 'listIndentation', name: 'List Indentation', description: 'Indent list items consistently', icon: '📋', enabled: true },
      { id: 'blankLineBeforeHeading', name: 'Blank Line Before Heading', description: 'Add blank line before headings', icon: '⬆️', enabled: true },
      { id: 'blankLineBeforeList', name: 'Blank Line Before List', description: 'Add blank line before lists', icon: '📝', enabled: true },
      { id: 'maxLineLength', name: 'Max Line Length', description: 'Wrap lines at specified length', icon: '↔️', enabled: false },
      { id: 'trimTrailingWhitespace', name: 'Trim Trailing Whitespace', description: 'Remove trailing spaces', icon: '✂️', enabled: true },
      { id: 'ensureFinalNewline', name: 'Ensure Final Newline', description: 'Add newline at end of file', icon: '↩️', enabled: true },
      { id: 'consistentEmphasis', name: 'Consistent Emphasis', description: 'Use consistent emphasis markers', icon: '🔤', enabled: true },
      { id: 'fencedCodeBlockLanguage', name: 'Fenced Code Block Language', description: 'Add language to fenced code blocks', icon: '💻', enabled: true },
      { id: 'consistentQuoteStyle', name: 'Consistent Quote Style', description: 'Use consistent quote marks', icon: '💬', enabled: true },
      { id: 'noTrailingPunctuation', name: 'No Trailing Punctuation', description: 'Remove trailing punctuation from headings', icon: '🚫', enabled: false }
    ];
  }

  async formatMarkdown(content, formatterId = 'standard') {
    const formatter = this.formatters.get(formatterId) || this.formatters.get('standard');
    let formatted = content;
    const rules = formatter.rules;

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

    if (rules.blankLineBeforeList) {
      formatted = formatted.replace(/([^\n])\n([-*]\s)/g, '$1\n\n$2');
      formatted = formatted.replace(/([^\n])\n(\d+\.\s)/g, '$1\n\n$2');
    }

    if (rules.listIndentation) {
      const indent = ' '.repeat(rules.listIndentation);
      formatted = formatted.replace(/^(\s*)[-*]\s/gm, (match, space) => {
        return `${indent}- `;
      });
    }

    if (rules.maxLineLength > 0) {
      const lines = formatted.split('\n');
      const wrappedLines = [];

      for (const line of lines) {
        if (line.length > rules.maxLineLength && !line.startsWith('#') && !line.startsWith('```') && !line.startsWith('|')) {
          const words = line.split(' ');
          let currentLine = '';

          for (const word of words) {
            if ((currentLine + ' ' + word).length > rules.maxLineLength && currentLine.length > 0) {
              wrappedLines.push(currentLine.trim());
              currentLine = word;
            } else {
              currentLine += (currentLine ? ' ' : '') + word;
            }
          }
          if (currentLine) wrappedLines.push(currentLine.trim());
        } else {
          wrappedLines.push(line);
        }
      }

      formatted = wrappedLines.join('\n');
    }

    if (rules.consistentEmphasis) {
      formatted = formatted.replace(/\*\*(.+?)\*\*/g, '**$1**');
      formatted = formatted.replace(/__(.+?)__/g, '**$1**');
    }

    if (rules.consistentQuoteStyle) {
      formatted = formatted.replace(/"([^"]+)"/g, '"$1"');
    }

    if (rules.noTrailingPunctuation) {
      formatted = formatted.replace(/^(#{1,6}\s.+)[.,;:!?]$/gm, '$1');
    }

    if (rules.ensureFinalNewline && !formatted.endsWith('\n')) {
      formatted += '\n';
    }

    return formatted;
  }

  async createFormatter(params) {
    const { name, description = '', rules = {}, icon = '📝' } = params;

    const id = uuidv4();
    const formatter = {
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
      type: 'formatter',
      createdAt: new Date().toISOString()
    };

    this.formatters.set(id, formatter);
    return formatter;
  }

  async updateFormatter(id, updates) {
    const formatter = this.formatters.get(id);
    if (!formatter) throw new Error(`Formatter not found: ${id}`);

    const updated = { ...formatter, ...updates };
    this.formatters.set(id, updated);
    return updated;
  }

  async deleteFormatter(id) {
    this.formatters.delete(id);
    return { success: true };
  }

  listFormatters() {
    return Array.from(this.formatters.values());
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

      if (line.match(/^```/) && !line.match(/^```\w+/) && line !== '```') {
        issues.push({ line: lineNum, type: 'info', message: 'Consider adding language to fenced code block' });
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
      formatters: this.formatters.size,
      rules: this.formatRules.length,
      enabledRules: this.formatRules.filter(r => r.enabled).length
    };
  }

  async exportFormatters(format = 'json') {
    const formatters = Array.from(this.formatters.values());

    if (format === 'json') {
      return JSON.stringify(formatters, null, 2);
    }

    return formatters;
  }
}

module.exports = MarkdownFormatterEngine;
