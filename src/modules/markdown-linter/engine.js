const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownLinterEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.reports = new Map();
    this.rules = new Map();
    this.lintDir = path.join(os.homedir(), '.pix/markdown-lint');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Linter Engine...');
    await fs.ensureDir(this.lintDir);
    await this.loadReports();
    this.loadDefaultRules();
    this.logger.info('Markdown Linter Engine initialized');
  }

  async loadReports() {
    try {
      const files = await fs.readdir(this.lintDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.lintDir, file));
          if (data.type === 'report') this.reports.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadDefaultRules() {
    const defaultRules = [
      { id: 'MD001', name: 'heading-increment', description: 'Heading levels should only increment by one level at a time', severity: 'error', enabled: true },
      { id: 'MD003', name: 'heading-style', description: 'Heading style should be consistent', severity: 'error', enabled: true },
      { id: 'MD009', name: 'no-trailing-spaces', description: 'Trailing spaces', severity: 'warning', enabled: true },
      { id: 'MD010', name: 'no-hard-tabs', description: 'Hard tabs', severity: 'error', enabled: true },
      { id: 'MD011', name: 'no-reversed-links', description: 'Reversed link syntax', severity: 'error', enabled: true },
      { id: 'MD012', name: 'no-multiple-blanks', description: 'Multiple consecutive blank lines', severity: 'warning', enabled: true },
      { id: 'MD013', name: 'line-length', description: 'Line length', severity: 'warning', enabled: true, configuration: { line_length: 80 } },
      { id: 'MD018', name: 'no-missing-space-atx', description: 'No space after hash on atx style heading', severity: 'error', enabled: true },
      { id: 'MD019', name: 'no-multiple-space-atx', description: 'Multiple spaces after hash on atx style heading', severity: 'error', enabled: true },
      { id: 'MD020', name: 'no-missing-space-closed-atx', description: 'No space inside closed atx heading', severity: 'error', enabled: true },
      { id: 'MD021', name: 'no-multiple-space-closed-atx', description: 'Multiple spaces inside closed atx heading', severity: 'error', enabled: true },
      { id: 'MD022', name: 'blanks-around-headings', description: 'Headings should be surrounded by blank lines', severity: 'warning', enabled: true },
      { id: 'MD023', name: 'heading-start-left', description: 'Headings must start at the beginning of the line', severity: 'error', enabled: true },
      { id: 'MD024', name: 'no-duplicate-heading', description: 'Multiple headings with the same content', severity: 'warning', enabled: true },
      { id: 'MD025', name: 'single-title', description: 'Multiple top level headings', severity: 'error', enabled: true },
      { id: 'MD026', name: 'no-trailing-punctuation', description: 'Trailing punctuation in heading', severity: 'warning', enabled: true },
      { id: 'MD027', name: 'no-multiple-space-blockquote', description: 'Multiple spaces after blockquote', severity: 'error', enabled: true },
      { id: 'MD028', name: 'no-blanks-blockquote', description: 'Blank line inside blockquote', severity: 'warning', enabled: true },
      { id: 'MD029', name: 'ol-prefix', description: 'Ordered list item prefix', severity: 'error', enabled: true },
      { id: 'MD030', name: 'list-marker-space', description: 'Spaces after list markers', severity: 'error', enabled: true },
      { id: 'MD031', name: 'blanks-around-fences', description: 'Fenced code blocks should be surrounded by blank lines', severity: 'warning', enabled: true },
      { id: 'MD032', name: 'blanks-around-lists', description: 'Lists should be surrounded by blank lines', severity: 'warning', enabled: true },
      { id: 'MD033', name: 'no-inline-html', description: 'Inline HTML', severity: 'warning', enabled: false },
      { id: 'MD034', name: 'no-bare-urls', description: 'Bare URL used', severity: 'warning', enabled: true },
      { id: 'MD035', name: 'hr-style', description: 'Horizontal rule style', severity: 'warning', enabled: true },
      { id: 'MD036', name: 'no-emphasis-as-heading', description: 'Emphasis used instead of a heading', severity: 'warning', enabled: true },
      { id: 'MD037', name: 'no-space-in-emphasis', description: 'Spaces inside emphasis markers', severity: 'error', enabled: true },
      { id: 'MD038', name: 'no-space-in-code', description: 'Spaces inside code span elements', severity: 'error', enabled: true },
      { id: 'MD039', name: 'no-space-in-links', description: 'Spaces inside link text', severity: 'error', enabled: true },
      { id: 'MD040', name: 'fenced-code-language', description: 'Fenced code blocks should have a language specified', severity: 'warning', enabled: true },
      { id: 'MD041', name: 'first-line-heading', description: 'First line in file should be a heading', severity: 'warning', enabled: false },
      { id: 'MD042', name: 'no-empty-links', description: 'No empty links', severity: 'error', enabled: true },
      { id: 'MD043', name: 'required-headings', description: 'Required heading structure', severity: 'warning', enabled: false },
      { id: 'MD044', name: 'proper-names', description: 'Proper names should have the correct capitalization', severity: 'warning', enabled: false },
      { id: 'MD045', name: 'no-alt-text', description: 'Images should have alternate text', severity: 'warning', enabled: true },
      { id: 'MD046', name: 'code-block-style', description: 'Code block style', severity: 'warning', enabled: true },
      { id: 'MD047', name: 'single-trailing-newline', description: 'Files should end with a single trailing newline', severity: 'warning', enabled: true },
      { id: 'MD048', name: 'code-fence-style', description: 'Code fence style', severity: 'warning', enabled: true },
      { id: 'MD049', name: 'emphasis-style', description: 'Emphasis style', severity: 'warning', enabled: true },
      { id: 'MD050', name: 'strong-style', description: 'Strong style', severity: 'warning', enabled: true },
      { id: 'MD051', name: 'link-fragments', description: 'Link fragments should be valid', severity: 'warning', enabled: true },
      { id: 'MD052', name: 'reference-links-images', description: 'Reference links and images should use a label that matches the definition', severity: 'warning', enabled: true },
      { id: 'MD053', name: 'link-image-reference-definitions', description: 'Link and image reference definitions should be needed', severity: 'warning', enabled: true }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, { ...rule, type: 'rule' });
    });
  }

  async lint(content, options = {}) {
    const { filename = 'untitled.md', rules: enabledRules = null } = options;
    const lines = content.split('\n');
    const results = [];

    const checkRules = enabledRules
      ? Array.from(this.rules.values()).filter(r => enabledRules.includes(r.id))
      : Array.from(this.rules.values()).filter(r => r.enabled);

    for (const rule of checkRules) {
      const ruleResults = this.applyRule(rule, lines, content);
      results.push(...ruleResults);
    }

    const id = uuidv4();
    const report = {
      id,
      filename,
      timestamp: new Date().toISOString(),
      results,
      stats: {
        errors: results.filter(r => r.severity === 'error').length,
        warnings: results.filter(r => r.severity === 'warning').length,
        info: results.filter(r => r.severity === 'info').length
      },
      type: 'report'
    };

    this.reports.set(id, report);
    return report;
  }

  applyRule(rule, lines, content) {
    const results = [];

    switch (rule.id) {
      case 'MD009':
        lines.forEach((line, i) => {
          if (line.match(/[ \t]+$/)) {
            results.push({
              rule: rule.id,
              message: rule.description,
              line: i + 1,
              column: line.length - line.trimEnd().length + 1,
              severity: rule.severity
            });
          }
        });
        break;

      case 'MD010':
        lines.forEach((line, i) => {
          if (line.match(/\t/)) {
            results.push({
              rule: rule.id,
              message: rule.description,
              line: i + 1,
              column: line.indexOf('\t') + 1,
              severity: rule.severity
            });
          }
        });
        break;

      case 'MD012':
        let blankCount = 0;
        lines.forEach((line, i) => {
          if (line.trim() === '') {
            blankCount++;
            if (blankCount > 1) {
              results.push({
                rule: rule.id,
                message: rule.description,
                line: i + 1,
                severity: rule.severity
              });
            }
          } else {
            blankCount = 0;
          }
        });
        break;

      case 'MD013':
        const maxLen = rule.configuration?.line_length || 80;
        lines.forEach((line, i) => {
          if (line.length > maxLen) {
            results.push({
              rule: rule.id,
              message: `${rule.description} (${line.length} > ${maxLen})`,
              line: i + 1,
              severity: rule.severity
            });
          }
        });
        break;

      case 'MD022':
        lines.forEach((line, i) => {
          if (line.match(/^#{1,6}\s/) && i > 0 && lines[i - 1].trim() !== '') {
            results.push({
              rule: rule.id,
              message: rule.description,
              line: i + 1,
              severity: rule.severity
            });
          }
        });
        break;

      case 'MD025':
        let h1Count = 0;
        lines.forEach((line, i) => {
          if (line.match(/^# [^#]/)) {
            h1Count++;
            if (h1Count > 1) {
              results.push({
                rule: rule.id,
                message: rule.description,
                line: i + 1,
                severity: rule.severity
              });
            }
          }
        });
        break;

      case 'MD034':
        lines.forEach((line, i) => {
          const urlMatch = line.match(/(?<!\()https?:\/\/[^\s)]+/g);
          if (urlMatch) {
            urlMatch.forEach(url => {
              if (!line.includes(`[${url}]`) && !line.includes(`](${url})`)) {
                results.push({
                  rule: rule.id,
                  message: `${rule.description}: ${url}`,
                  line: i + 1,
                  severity: rule.severity
                });
              }
            });
          }
        });
        break;

      case 'MD042':
        lines.forEach((line, i) => {
          if (line.match(/\[\]\(/)) {
            results.push({
              rule: rule.id,
              message: rule.description,
              line: i + 1,
              severity: rule.severity
            });
          }
        });
        break;

      case 'MD047':
        if (!content.endsWith('\n') || content.endsWith('\n\n')) {
          results.push({
            rule: rule.id,
            message: rule.description,
            line: lines.length,
            severity: rule.severity
          });
        }
        break;
    }

    return results;
  }

  getRules() {
    return Array.from(this.rules.values());
  }

  async toggleRule(id) {
    const rule = this.rules.get(id);
    if (!rule) throw new Error(`Rule not found: ${id}`);

    rule.enabled = !rule.enabled;
    return rule;
  }

  async getReport(id) {
    return this.reports.get(id);
  }

  listReports(limit = 50) {
    return Array.from(this.reports.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async getStats() {
    return {
      rules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      reports: this.reports.size
    };
  }

  async exportReports(format = 'json') {
    const data = {
      rules: Array.from(this.rules.values()),
      reports: Array.from(this.reports.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = MarkdownLinterEngine;
