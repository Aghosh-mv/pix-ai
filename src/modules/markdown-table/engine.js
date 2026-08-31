const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownTableEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.tables = new Map();
    this.tableDir = path.join(os.homedir(), '.pix/markdown-tables');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Table Engine...');
    await fs.ensureDir(this.tableDir);
    await this.loadTables();
    this.loadAlignments();
    this.loadTemplates();
    this.logger.info('Markdown Table Engine initialized');
  }

  async loadTables() {
    try {
      const files = await fs.readdir(this.tableDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.tableDir, file));
          if (data.type === 'table') this.tables.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadAlignments() {
    this.alignments = [
      { id: 'left', name: 'Left', icon: '⬅️', syntax: ':---' },
      { id: 'center', name: 'Center', icon: '↔️', syntax: ':---:' },
      { id: 'right', name: 'Right', icon: '➡️', syntax: '---:' },
      { id: 'none', name: 'None', icon: '➖', syntax: '---' }
    ];
  }

  loadTemplates() {
    this.tableTemplates = [
      {
        id: 'basic',
        name: 'Basic Table',
        columns: 3,
        rows: 3,
        icon: '📊'
      },
      {
        id: 'comparison',
        name: 'Comparison Table',
        columns: 3,
        rows: 4,
        headers: ['Feature', 'Basic', 'Pro'],
        icon: '⚖️'
      },
      {
        id: 'pricing',
        name: 'Pricing Table',
        columns: 4,
        rows: 4,
        headers: ['Plan', 'Price', 'Features', 'Support'],
        icon: '💰'
      },
      {
        id: 'schedule',
        name: 'Schedule Table',
        columns: 3,
        rows: 5,
        headers: ['Time', 'Monday', 'Tuesday'],
        icon: '📅'
      }
    ];
  }

  async createTable(params) {
    const {
      name,
      headers = [],
      rows = [],
      alignments = [],
      caption = ''
    } = params;

    const id = uuidv4();
    const table = {
      id,
      name,
      headers,
      rows,
      alignments: alignments.length > 0 ? alignments : headers.map(() => 'left'),
      caption,
      type: 'table',
      createdAt: new Date().toISOString()
    };

    this.tables.set(id, table);
    return table;
  }

  async updateTable(id, updates) {
    const table = this.tables.get(id);
    if (!table) throw new Error(`Table not found: ${id}`);

    const updated = { ...table, ...updates };
    this.tables.set(id, updated);
    return updated;
  }

  async deleteTable(id) {
    this.tables.delete(id);
    return { success: true };
  }

  async getTable(id) {
    return this.tables.get(id);
  }

  listTables() {
    return Array.from(this.tables.values());
  }

  generateMarkdown(table) {
    const { headers, rows, alignments, caption } = table;

    if (headers.length === 0) return '';

    let md = '| ' + headers.join(' | ') + ' |\n';

    const separator = headers.map((_, i) => {
      const align = alignments[i] || 'left';
      switch (align) {
        case 'left': return ':---';
        case 'center': return ':---:';
        case 'right': return '---:';
        default: return '---';
      }
    });

    md += '| ' + separator.join(' | ') + ' |\n';

    for (const row of rows) {
      const paddedRow = headers.map((_, i) => row[i] || '');
      md += '| ' + paddedRow.join(' | ') + ' |\n';
    }

    if (caption) {
      md += '\n*' + caption + '*';
    }

    return md;
  }

  parseMarkdown(markdown) {
    const lines = markdown.trim().split('\n');
    if (lines.length < 2) return null;

    const headers = lines[0].split('|').filter(c => c.trim()).map(c => c.trim());
    const alignments = lines[1].split('|').filter(c => c.trim()).map(c => {
      const cell = c.trim();
      if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
      if (cell.endsWith(':')) return 'right';
      if (cell.startsWith(':')) return 'left';
      return 'none';
    });

    const rows = [];
    for (let i = 2; i < lines.length; i++) {
      if (lines[i].trim()) {
        const row = lines[i].split('|').filter(c => c.trim()).map(c => c.trim());
        rows.push(row);
      }
    }

    return { headers, alignments, rows };
  }

  async addRow(tableId, rowData) {
    const table = this.tables.get(tableId);
    if (!table) throw new Error(`Table not found: ${tableId}`);

    const paddedRow = table.headers.map((_, i) => rowData[i] || '');
    table.rows.push(paddedRow);
    this.tables.set(tableId, table);
    return table;
  }

  async insertRow(tableId, rowIndex, rowData) {
    const table = this.tables.get(tableId);
    if (!table) throw new Error(`Table not found: ${tableId}`);

    const paddedRow = table.headers.map((_, i) => rowData[i] || '');
    table.rows.splice(rowIndex, 0, paddedRow);
    this.tables.set(tableId, table);
    return table;
  }

  async deleteRow(tableId, rowIndex) {
    const table = this.tables.get(tableId);
    if (!table) throw new Error(`Table not found: ${tableId}`);

    table.rows.splice(rowIndex, 1);
    this.tables.set(tableId, table);
    return table;
  }

  async addColumn(tableId, header, alignment = 'left') {
    const table = this.tables.get(tableId);
    if (!table) throw new Error(`Table not found: ${tableId}`);

    table.headers.push(header);
    table.alignments.push(alignment);
    table.rows.forEach(row => row.push(''));
    this.tables.set(tableId, table);
    return table;
  }

  async deleteColumn(tableId, columnIndex) {
    const table = this.tables.get(tableId);
    if (!table) throw new Error(`Table not found: ${tableId}`);

    table.headers.splice(columnIndex, 1);
    table.alignments.splice(columnIndex, 1);
    table.rows.forEach(row => row.splice(columnIndex, 1));
    this.tables.set(tableId, table);
    return table;
  }

  async sortRows(tableId, columnIndex, ascending = true) {
    const table = this.tables.get(tableId);
    if (!table) throw new Error(`Table not found: ${tableId}`);

    table.rows.sort((a, b) => {
      const aVal = a[columnIndex] || '';
      const bVal = b[columnIndex] || '';

      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return ascending ? aNum - bNum : bNum - aNum;
      }

      return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    this.tables.set(tableId, table);
    return table;
  }

  async filterRows(tableId, columnIndex, query) {
    const table = this.tables.get(tableId);
    if (!table) throw new Error(`Table not found: ${tableId}`);

    const queryLower = query.toLowerCase();
    const filteredRows = table.rows.filter(row =>
      (row[columnIndex] || '').toLowerCase().includes(queryLower)
    );

    return { ...table, rows: filteredRows };
  }

  async getTableStats(tableId) {
    const table = this.tables.get(tableId);
    if (!table) throw new Error(`Table not found: ${tableId}`);

    return {
      columns: table.headers.length,
      rows: table.rows.length,
      cells: table.headers.length * table.rows.length
    };
  }

  getAlignments() {
    return this.alignments;
  }

  getTemplates() {
    return this.tableTemplates;
  }

  async createFromTemplate(templateId, customizations = {}) {
    const template = this.tableTemplates.find(t => t.id === templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    const headers = customizations.headers || template.headers || Array(template.columns).fill('').map((_, i) => `Column ${i + 1}`);
    const rows = customizations.rows || Array(template.rows).fill('').map(() => Array(template.columns).fill(''));

    return this.createTable({
      name: template.name,
      headers,
      rows,
      ...customizations
    });
  }

  async getStats() {
    return {
      tables: this.tables.size,
      templates: this.tableTemplates.length,
      alignments: this.alignments.length
    };
  }

  async exportTables(format = 'json') {
    const tables = Array.from(this.tables.values());

    if (format === 'json') {
      return JSON.stringify(tables, null, 2);
    }

    if (format === 'markdown') {
      return tables.map(t => this.generateMarkdown(t)).join('\n\n');
    }

    return tables;
  }
}

module.exports = MarkdownTableEngine;
