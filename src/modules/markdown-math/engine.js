const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownMathEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.expressions = new Map();
    this.macros = new Map();
    this.mathDir = path.join(os.homedir(), '.pix/markdown-math');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Math Engine...');
    await fs.ensureDir(this.mathDir);
    await this.loadExpressions();
    this.loadMacros();
    this.loadSymbols();
    this.logger.info('Markdown Math Engine initialized');
  }

  async loadExpressions() {
    try {
      const files = await fs.readdir(this.mathDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.mathDir, file));
          if (data.type === 'expression') this.expressions.set(data.id, data);
          else if (data.type === 'macro') this.macros.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadMacros() {
    const defaults = [
      { id: 'reals', name: 'Reals', command: '\\mathbb{R}', description: 'Real numbers' },
      { id: 'integers', name: 'Integers', command: '\\mathbb{Z}', description: 'Integer numbers' },
      { id: 'naturals', name: 'Naturals', command: '\\mathbb{N}', description: 'Natural numbers' },
      { id: 'rationals', name: 'Rationals', command: '\\mathbb{Q}', description: 'Rational numbers' },
      { id: 'complex', name: 'Complex', command: '\\mathbb{C}', description: 'Complex numbers' },
      { id: 'forall', name: 'For All', command: '\\forall', description: 'Universal quantifier' },
      { id: 'exists', name: 'Exists', command: '\\exists', description: 'Existential quantifier' },
      { id: 'therefore', name: 'Therefore', command: '\\therefore', description: 'Therefore symbol' },
      { id: 'because', name: 'Because', command: '\\because', description: 'Because symbol' },
      { id: 'implies', name: 'Implies', command: '\\implies', description: 'Logical implication' }
    ];

    defaults.forEach(macro => {
      if (!this.macros.has(macro.id)) {
        this.macros.set(macro.id, { ...macro, type: 'macro' });
      }
    });
  }

  loadSymbols() {
    this.symbolCategories = [
      {
        id: 'greek',
        name: 'Greek Letters',
        icon: '🔤',
        symbols: [
          { name: 'alpha', latex: '\\alpha', symbol: 'α' },
          { name: 'beta', latex: '\\beta', symbol: 'β' },
          { name: 'gamma', latex: '\\gamma', symbol: 'γ' },
          { name: 'delta', latex: '\\delta', symbol: 'δ' },
          { name: 'epsilon', latex: '\\epsilon', symbol: 'ε' },
          { name: 'zeta', latex: '\\zeta', symbol: 'ζ' },
          { name: 'eta', latex: '\\eta', symbol: 'η' },
          { name: 'theta', latex: '\\theta', symbol: 'θ' },
          { name: 'iota', latex: '\\iota', symbol: 'ι' },
          { name: 'kappa', latex: '\\kappa', symbol: 'κ' },
          { name: 'lambda', latex: '\\lambda', symbol: 'λ' },
          { name: 'mu', latex: '\\mu', symbol: 'μ' },
          { name: 'nu', latex: '\\nu', symbol: 'ν' },
          { name: 'xi', latex: '\\xi', symbol: 'ξ' },
          { name: 'pi', latex: '\\pi', symbol: 'π' },
          { name: 'rho', latex: '\\rho', symbol: 'ρ' },
          { name: 'sigma', latex: '\\sigma', symbol: 'σ' },
          { name: 'tau', latex: '\\tau', symbol: 'τ' },
          { name: 'phi', latex: '\\phi', symbol: 'φ' },
          { name: 'chi', latex: '\\chi', symbol: 'χ' },
          { name: 'psi', latex: '\\psi', symbol: 'ψ' },
          { name: 'omega', latex: '\\omega', symbol: 'ω' }
        ]
      },
      {
        id: 'operators',
        name: 'Operators',
        icon: '➕',
        symbols: [
          { name: 'plus', latex: '+', symbol: '+' },
          { name: 'minus', latex: '-', symbol: '−' },
          { name: 'times', latex: '\\times', symbol: '×' },
          { name: 'div', latex: '\\div', symbol: '÷' },
          { name: 'pm', latex: '\\pm', symbol: '±' },
          { name: 'mp', latex: '\\mp', symbol: '∓' },
          { name: 'cdot', latex: '\\cdot', symbol: '⋅' },
          { name: 'star', latex: '\\star', symbol: '⋆' },
          { name: 'circ', latex: '\\circ', symbol: '∘' },
          { name: 'bullet', latex: '\\bullet', symbol: '•' }
        ]
      },
      {
        id: 'relations',
        name: 'Relations',
        icon: '🔗',
        symbols: [
          { name: 'leq', latex: '\\leq', symbol: '≤' },
          { name: 'geq', latex: '\\geq', symbol: '≥' },
          { name: 'neq', latex: '\\neq', symbol: '≠' },
          { name: 'approx', latex: '\\approx', symbol: '≈' },
          { name: 'equiv', latex: '\\equiv', symbol: '≡' },
          { name: 'sim', latex: '\\sim', symbol: '∼' },
          { name: 'propto', latex: '\\propto', symbol: '∝' },
          { name: 'perp', latex: '\\perp', symbol: '⊥' },
          { name: 'parallel', latex: '\\parallel', symbol: '∥' },
          { name: 'subset', latex: '\\subset', symbol: '⊂' },
          { name: 'supset', latex: '\\supset', symbol: '⊃' },
          { name: 'subseteq', latex: '\\subseteq', symbol: '⊆' },
          { name: 'supseteq', latex: '\\supseteq', symbol: '⊇' }
        ]
      },
      {
        id: 'arrows',
        name: 'Arrows',
        icon: '➡️',
        symbols: [
          { name: 'leftarrow', latex: '\\leftarrow', symbol: '←' },
          { name: 'rightarrow', latex: '\\rightarrow', symbol: '→' },
          { name: 'leftrightarrow', latex: '\\leftrightarrow', symbol: '↔' },
          { name: 'Leftarrow', latex: '\\Leftarrow', symbol: '⇐' },
          { name: 'Rightarrow', latex: '\\Rightarrow', symbol: '⇒' },
          { name: 'Leftrightarrow', latex: '\\Leftrightarrow', symbol: '⇔' },
          { name: 'uparrow', latex: '\\uparrow', symbol: '↑' },
          { name: 'downarrow', latex: '\\downarrow', symbol: '↓' },
          { name: 'mapsto', latex: '\\mapsto', symbol: '↦' },
          { name: 'hookrightarrow', latex: '\\hookrightarrow', symbol: '↪' }
        ]
      },
      {
        id: 'calculus',
        name: 'Calculus',
        icon: '📐',
        symbols: [
          { name: 'int', latex: '\\int', symbol: '∫' },
          { name: 'iint', latex: '\\iint', symbol: '∬' },
          { name: 'iiint', latex: '\\iiint', symbol: '∭' },
          { name: 'oint', latex: '\\oint', symbol: '∮' },
          { name: 'sum', latex: '\\sum', symbol: '∑' },
          { name: 'prod', latex: '\\prod', symbol: '∏' },
          { name: 'coprod', latex: '\\coprod', symbol: '∐' },
          { name: 'partial', latex: '\\partial', symbol: '∂' },
          { name: 'nabla', latex: '\\nabla', symbol: '∇' },
          { name: 'infty', latex: '\\infty', symbol: '∞' }
        ]
      }
    ];
  }

  async createExpression(params) {
    const {
      name,
      latex,
      description = '',
      category = 'general',
      tags = []
    } = params;

    const id = uuidv4();
    const expression = {
      id,
      name,
      latex,
      description,
      category,
      tags,
      usageCount: 0,
      lastUsed: null,
      type: 'expression',
      createdAt: new Date().toISOString()
    };

    this.expressions.set(id, expression);
    return expression;
  }

  async updateExpression(id, updates) {
    const expression = this.expressions.get(id);
    if (!expression) throw new Error(`Expression not found: ${id}`);

    const updated = { ...expression, ...updates };
    this.expressions.set(id, updated);
    return updated;
  }

  async deleteExpression(id) {
    this.expressions.delete(id);
    return { success: true };
  }

  async getExpression(id) {
    const expression = this.expressions.get(id);
    if (!expression) throw new Error(`Expression not found: ${id}`);

    expression.usageCount = (expression.usageCount || 0) + 1;
    expression.lastUsed = new Date().toISOString();
    this.expressions.set(id, expression);

    return expression;
  }

  listExpressions(options = {}) {
    const { category, tags, search } = options;
    let expressions = Array.from(this.expressions.values());

    if (category) expressions = expressions.filter(e => e.category === category);
    if (tags && tags.length > 0) {
      expressions = expressions.filter(e => tags.some(t => e.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      expressions = expressions.filter(e =>
        e.name.toLowerCase().includes(searchLower) ||
        e.latex.toLowerCase().includes(searchLower) ||
        e.description.toLowerCase().includes(searchLower)
      );
    }

    return expressions.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }

  renderInline(latex) {
    return `$${latex}$`;
  }

  renderBlock(latex) {
    return `$$\n${latex}\n$$`;
  }

  renderAligned(expressions) {
    return `$$\n\\begin{aligned}\n${expressions.join(' \\\\\n')}\n\\end{aligned}\n$$`;
  }

  renderMatrix(rows, brackets = 'pmatrix') {
    const content = rows.map(row => row.join(' & ')).join(' \\\\\n');
    return `$$\n\\begin{${brackets}}\n${content}\n\\end{${brackets}}\n$$`;
  }

  renderCases(expressions) {
    return `$$\n\\begin{cases}\n${expressions.join(' \\\\\n')}\n\\end{cases}\n$$`;
  }

  renderArray(rows, alignment = 'c') {
    const cols = alignment.repeat(rows[0].length);
    const content = rows.map(row => row.join(' & ')).join(' \\\\\n');
    return `$$\n\\begin{array}{${cols}}\n${content}\n\\end{array}\n$$`;
  }

  getSymbolCategories() {
    return this.symbolCategories;
  }

  getMacros() {
    return Array.from(this.macros.values());
  }

  async searchExpressions(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, expr] of this.expressions) {
      let score = 0;

      if (expr.name.toLowerCase().includes(queryLower)) score += 10;
      if (expr.latex.toLowerCase().includes(queryLower)) score += 5;
      if (expr.description.toLowerCase().includes(queryLower)) score += 3;

      if (score > 0) {
        results.push({ ...expr, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getStats() {
    return {
      expressions: this.expressions.size,
      macros: this.macros.size,
      symbolCategories: this.symbolCategories.length,
      totalSymbols: this.symbolCategories.reduce((sum, cat) => sum + cat.symbols.length, 0)
    };
  }

  async exportExpressions(format = 'json') {
    const data = {
      expressions: Array.from(this.expressions.values()),
      macros: Array.from(this.macros.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = MarkdownMathEngine;
