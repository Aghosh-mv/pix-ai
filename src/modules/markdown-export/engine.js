const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownExportEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.exports = new Map();
    this.exportDir = path.join(os.homedir(), '.pix/markdown-export');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Export Engine...');
    await fs.ensureDir(this.exportDir);
    await this.loadExports();
    this.loadFormats();
    this.loadTemplates();
    this.logger.info('Markdown Export Engine initialized');
  }

  async loadExports() {
    try {
      const files = await fs.readdir(this.exportDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.exportDir, file));
          if (data.type === 'export') this.exports.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadFormats() {
    this.formats = [
      { id: 'html', name: 'HTML', icon: '🌐', extension: '.html', mimeType: 'text/html' },
      { id: 'pdf', name: 'PDF', icon: '📄', extension: '.pdf', mimeType: 'application/pdf' },
      { id: 'docx', name: 'Word Document', icon: '📝', extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { id: 'txt', name: 'Plain Text', icon: '📃', extension: '.txt', mimeType: 'text/plain' },
      { id: 'rtf', name: 'Rich Text', icon: '📋', extension: '.rtf', mimeType: 'text/rtf' },
      { id: 'latex', name: 'LaTeX', icon: '📐', extension: '.tex', mimeType: 'application/x-latex' },
      { id: 'org', name: 'Org Mode', icon: '📋', extension: '.org', mimeType: 'text/org' },
      { id: 'asciidoc', name: 'AsciiDoc', icon: '📝', extension: '.adoc', mimeType: 'text/asciidoc' },
      { id: 'json', name: 'JSON', icon: '📋', extension: '.json', mimeType: 'application/json' },
      { id: 'csv', name: 'CSV (Tables)', icon: '📊', extension: '.csv', mimeType: 'text/csv' }
    ];
  }

  loadTemplates() {
    const defaults = [
      {
        id: 'html-basic',
        name: 'Basic HTML',
        format: 'html',
        content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{title}}</title>\n  <style>{{styles}}</style>\n</head>\n<body>\n  <div class="container">{{content}}</div>\n</body>\n</html>',
        icon: '🌐'
      },
      {
        id: 'html-styled',
        name: 'Styled HTML',
        format: 'html',
        content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{title}}</title>\n  <style>\n    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }\n    h1, h2, h3 { color: #333; }\n    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }\n    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }\n    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }\n  </style>\n</head>\n<body>\n  <article>{{content}}</article>\n</body>\n</html>',
        icon: '🎨'
      }
    ];

    defaults.forEach(template => {
      if (!this.exports.has(template.id)) {
        this.exports.set(template.id, {
          ...template,
          type: 'export',
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  async exportDocument(params) {
    const {
      content,
      title = 'Document',
      format = 'html',
      template = null,
      options = {}
    } = params;

    let output;

    switch (format) {
      case 'html':
        output = this.exportToHTML(content, title, template, options);
        break;
      case 'txt':
        output = this.exportToText(content);
        break;
      case 'json':
        output = this.exportToJSON(content, title);
        break;
      case 'csv':
        output = this.exportToCSV(content);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const id = uuidv4();
    const exportRecord = {
      id,
      title,
      format,
      template,
      inputLength: content.length,
      outputLength: output.length,
      type: 'export',
      timestamp: new Date().toISOString()
    };

    this.exports.set(id, exportRecord);

    return { id, output, format };
  }

  exportToHTML(content, title, templateId = null, options = {}) {
    const template = templateId ? this.exports.get(templateId) : null;
    let html = this.markdownToHTML(content);

    if (template && template.format === 'html') {
      const styles = options.styles || this.getDefaultStyles();
      html = template.content
        .replace(/\{\{title\}\}/g, title)
        .replace(/\{\{content\}\}/g, html)
        .replace(/\{\{styles\}\}/g, styles);
    } else {
      html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${this.getDefaultStyles()}</style>
</head>
<body>
  <article class="markdown-body">${html}</article>
</body>
</html>`;
    }

    return html;
  }

  exportToText(content) {
    let text = content;

    text = text.replace(/#{1,6}\s/g, '');
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');
    text = text.replace(/\*(.+?)\*/g, '$1');
    text = text.replace(/~~(.+?)~~/g, '$1');
    text = text.replace(/`(.+?)`/g, '$1');
    text = text.replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').replace(/```/g, ''));
    text = text.replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)');
    text = text.replace(/!\[(.+?)\]\((.+?)\)/g, '[Image: $1]');
    text = text.replace(/^[-*]\s/gm, '• ');
    text = text.replace(/^\d+\.\s/gm, (match) => match);

    return text;
  }

  exportToJSON(content, title) {
    return JSON.stringify({
      title,
      content,
      wordCount: content.trim().split(/\s+/).filter(Boolean).length,
      lineCount: content.split('\n').length,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  exportToCSV(content) {
    const lines = content.split('\n');
    const rows = [];

    for (const line of lines) {
      if (line.includes('|')) {
        const cells = line.split('|').filter(c => c.trim());
        if (!cells.some(c => c.trim().match(/^[-:]+$/))) {
          rows.push(cells.map(c => `"${c.trim().replace(/"/g, '""')}"`).join(','));
        }
      }
    }

    return rows.join('\n');
  }

  markdownToHTML(content) {
    let html = content;

    html = html.replace(/^```(\w+)?\n([\s\S]*?)```/gm, '<pre><code class="language-$1">$2</code></pre>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    html = html.replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/^---$/gm, '<hr>');

    return html;
  }

  getDefaultStyles() {
    return `
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
      h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
      h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
      h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
      h3 { font-size: 1.25em; }
      code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 85%; }
      pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
      pre code { background: none; padding: 0; }
      blockquote { border-left: 4px solid #dfe2e5; margin: 0; padding: 0 16px; color: #6a737d; }
      img { max-width: 100%; }
      a { color: #0366d6; text-decoration: none; }
      a:hover { text-decoration: underline; }
      hr { height: 2px; padding: 0; margin: 24px 0; background-color: #e1e4e8; border: 0; }
      ul, ol { padding-left: 2em; }
      li + li { margin-top: 0.25em; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
      tr:nth-child(2n) { background: #f6f8fa; }
    `;
  }

  getFormats() {
    return this.formats;
  }

  listTemplates(options = {}) {
    const { format } = options;
    let templates = Array.from(this.exports.values()).filter(t => t.type === 'export' && t.format);

    if (format) templates = templates.filter(t => t.format === format);

    return templates;
  }

  async getStats() {
    return {
      exports: Array.from(this.exports.values()).filter(e => e.type === 'export').length,
      formats: this.formats.length
    };
  }

  async exportAll(format = 'json') {
    const data = {
      exports: Array.from(this.exports.values()).filter(e => e.type === 'export')
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = MarkdownExportEngine;
