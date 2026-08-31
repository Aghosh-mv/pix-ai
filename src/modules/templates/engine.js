class TemplateEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.templates = new Map();
    this.filters = new Map();
    this.functions = new Map();
    this.loadDefaultFilters();
    this.loadDefaultFunctions();
  }

  async initialize() {
    this.logger.info('Initializing Template Engine...');
    this.loadBuiltinTemplates();
    this.logger.info('Template Engine initialized');
  }

  loadBuiltinTemplates() {
    const builtins = [
      {
        id: 'javascript-class',
        name: 'JavaScript Class',
        language: 'javascript',
        template: `class {{className}} {\n  constructor({{#if constructorParams}}{{constructorParams}}{{/if}}) {\n    {{#each constructorBody}}    this.{{this.name}} = {{this.value}};\n    {{/each}}  }\n\n  {{#each methods}}  {{this.name}}({{this.params}}) {\n    {{this.body}}  }\n\n  {{/each}}}`
      },
      {
        id: 'python-class',
        name: 'Python Class',
        language: 'python',
        template: `class {{className}}:\n    def __init__(self{{#if initParams}}, {{initParams}}{{/if}}):\n        {{#each initBody}}        self.{{this.name}} = {{this.value}}\n        {{/each}}\n\n    {{#each methods}}    def {{this.name}}(self{{#if this.params}}, {{this.params}}{{/if}}):\n        {{this.body}}\n    {{/each}}`
      },
      {
        id: 'react-component',
        name: 'React Component',
        language: 'javascript',
        template: `import React from 'react';\n\nconst {{componentName}} = ({{#if props}}{ {{props}} }{{/if}}) => {\n  return (\n    <div>\n      {{content}}\n    </div>\n  );\n};\n\nexport default {{componentName}};`
      },
      {
        id: 'express-route',
        name: 'Express Route',
        language: 'javascript',
        template: `router.{{method}}('{{path}}', async (req, res) => {\n  try {\n    {{#if params}}const { {{params}} } = req.{{#if isBody}}body{{else}}params{{/if}};\n    {{/if}}    {{body}}\n\n    res.json({ success: true, data: result });\n  } catch (error) {\n    res.status(500).json({ success: false, error: error.message });\n  }\n});`
      },
      {
        id: 'test-file',
        name: 'Test File',
        language: 'javascript',
        template: `describe('{{suiteName}}', () => {\n  {{#each tests}}  it('{{this.description}}', () => {\n    {{this.body}}  });\n\n  {{/each}}});`
      },
      {
        id: 'api-response',
        name: 'API Response',
        language: 'json',
        template: `{\n  "success": {{success}},\n  "data": {{data}},\n  {{#if error}}"error": "{{error}}",{{/if}}\n  "timestamp": "{{timestamp}}"\n}`
      },
      {
        id: 'dockerfile',
        name: 'Dockerfile',
        language: 'dockerfile',
        template: `FROM {{baseImage}}\n\nWORKDIR /app\n\n{{#each steps}}RUN {{this}}\n{{/each}}\n\n{{#if copyFiles}}COPY {{copyFiles}}{{/if}}\n\n{{#if command}}CMD {{command}}{{/if}}`
      },
      {
        id: 'markdown-doc',
        name: 'Markdown Document',
        language: 'markdown',
        template: `# {{title}}\n\n{{#if description}}{{description}}\n\n{{/if}}{{#each sections}}## {{this.title}}\n\n{{this.content}}\n\n{{/each}}`
      }
    ];

    builtins.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  loadDefaultFilters() {
    this.filters.set('uppercase', (value) => String(value).toUpperCase());
    this.filters.set('lowercase', (value) => String(value).toLowerCase());
    this.filters.set('capitalize', (value) => {
      const str = String(value);
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
    this.filters.set('camelcase', (value) => {
      return String(value).replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
    });
    this.filters.set('pascalcase', (value) => {
      const camel = String(value).replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
      return camel.charAt(0).toUpperCase() + camel.slice(1);
    });
    this.filters.set('snakecase', (value) => {
      return String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '');
    });
    this.filters.set('kebabcase', (value) => {
      return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '');
    });
    this.filters.set('trim', (value) => String(value).trim());
    this.filters.set('truncate', (value, length = 100) => {
      const str = String(value);
      return str.length > length ? str.substring(0, length) + '...' : str;
    });
    this.filters.set('default', (value, defaultValue = '') => value || defaultValue);
    this.filters.set('json', (value, indent = 2) => JSON.stringify(value, null, indent));
    this.filters.set('length', (value) => {
      if (typeof value === 'string') return value.length;
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'object') return Object.keys(value).length;
      return 0;
    });
    this.filters.set('first', (value) => {
      if (typeof value === 'string') return value.charAt(0);
      if (Array.isArray(value)) return value[0];
      return value;
    });
    this.filters.set('last', (value) => {
      if (typeof value === 'string') return value.charAt(value.length - 1);
      if (Array.isArray(value)) return value[value.length - 1];
      return value;
    });
    this.filters.set('reverse', (value) => {
      if (typeof value === 'string') return value.split('').reverse().join('');
      if (Array.isArray(value)) return [...value].reverse();
      return value;
    });
    this.filters.set('sort', (value) => {
      if (Array.isArray(value)) return [...value].sort();
      return value;
    });
    this.filters.set('unique', (value) => {
      if (Array.isArray(value)) return [...new Set(value)];
      return value;
    });
    this.filters.set('join', (value, separator = ',') => {
      if (Array.isArray(value)) return value.join(separator);
      return value;
    });
    this.filters.set('split', (value, separator = ',') => {
      return String(value).split(separator);
    });
    this.filters.set('replace', (value, search, replacement = '') => {
      return String(value).replace(new RegExp(search, 'g'), replacement);
    });
    this.filters.set('abs', (value) => Math.abs(Number(value)));
    this.filters.set('round', (value) => Math.round(Number(value)));
    this.filters.set('floor', (value) => Math.floor(Number(value)));
    this.filters.set('ceil', (value) => Math.ceil(Number(value)));
    this.filters.set('min', (value) => Math.min(...(Array.isArray(value) ? value : [value])));
    this.filters.set('max', (value) => Math.max(...(Array.isArray(value) ? value : [value])));
    this.filters.set('sum', (value) => {
      if (Array.isArray(value)) return value.reduce((a, b) => a + b, 0);
      return value;
    });
    this.filters.set('date', (value, format = 'YYYY-MM-DD') => {
      const date = new Date(value);
      return format
        .replace('YYYY', date.getFullYear())
        .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
        .replace('DD', String(date.getDate()).padStart(2, '0'))
        .replace('HH', String(date.getHours()).padStart(2, '0'))
        .replace('mm', String(date.getMinutes()).padStart(2, '0'))
        .replace('ss', String(date.getSeconds()).padStart(2, '0'));
    });
    this.filters.set('timestamp', (value) => new Date(value).getTime());
    this.filters.set('iso', (value) => new Date(value).toISOString());
  }

  loadDefaultFunctions() {
    this.functions.set('now', () => new Date().toISOString());
    this.functions.set('uuid', () => require('uuid').v4());
    this.functions.set('random', (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min);
    this.functions.set('env', (name) => process.env[name] || '');
    this.functions.set('default', (value, defaultValue) => value || defaultValue);
  }

  render(template, data = {}) {
    let result = template;

    result = this.processConditionals(result, data);
    result = this.processLoops(result, data);
    result = this.processExpressions(result, data);
    result = this.processFunctions(result, data);
    result = this.processFilters(result, data);
    result = this.processVariables(result, data);

    return result;
  }

  processConditionals(template, data) {
    const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{#else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

    return template.replace(ifRegex, (_, condition, truthyContent, falsyContent = '') => {
      return data[condition] ? truthyContent : falsyContent;
    });
  }

  processLoops(template, data) {
    const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

    return template.replace(eachRegex, (_, arrayName, content) => {
      const array = data[arrayName];
      if (!Array.isArray(array)) return '';

      return array.map((item, index) => {
        let result = content;

        if (typeof item === 'object') {
          for (const [key, value] of Object.entries(item)) {
            result = result.replace(new RegExp(`{{this.${key}}}`, 'g'), value);
          }
        } else {
          result = result.replace(/\{\{this\}\}/g, item);
        }

        result = result.replace(/\{\{@index\}\}/g, index);
        result = result.replace(/\{\{@first\}\}/g, index === 0);
        result = result.replace(/\{\{@last\}\}/g, index === array.length - 1);

        return result;
      }).join('');
    });
  }

  processExpressions(template, data) {
    const exprRegex = /\{\{([^}]+)\}\}/g;

    return template.replace(exprRegex, (_, expression) => {
      expression = expression.trim();

      if (expression.startsWith('#')) return '';

      try {
        const value = this.evaluateExpression(expression, data);
        return value !== undefined && value !== null ? value : '';
      } catch (e) {
        return '';
      }
    });
  }

  evaluateExpression(expression, data) {
    if (expression in data) {
      return data[expression];
    }

    const parts = expression.split('.');
    let value = data;

    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }

    return value;
  }

  processFunctions(template, data) {
    const funcRegex = /\{\{(\w+)\(([^)]*)\)\}\}/g;

    return template.replace(funcRegex, (_, funcName, argsStr) => {
      const func = this.functions.get(funcName);
      if (!func) return '';

      const args = argsStr
        ? argsStr.split(',').map(arg => {
            arg = arg.trim();
            if (arg.startsWith('"') && arg.endsWith('"')) {
              return arg.slice(1, -1);
            }
            if (arg.startsWith("'") && arg.endsWith("'")) {
              return arg.slice(1, -1);
            }
            if (!isNaN(arg)) {
              return Number(arg);
            }
            return data[arg] || arg;
          })
        : [];

      try {
        return func(...args);
      } catch (e) {
        return '';
      }
    });
  }

  processFilters(template, data) {
    const filterRegex = /\{\{([^}]+)\|(\w+)(?::([^}]+))?\}\}/g;

    return template.replace(filterRegex, (_, valueExpr, filterName, argExpr) => {
      const filter = this.filters.get(filterName);
      if (!filter) return '';

      let value = this.evaluateExpression(valueExpr.trim(), data);
      const arg = argExpr ? argExpr.trim() : undefined;

      try {
        return filter(value, arg);
      } catch (e) {
        return '';
      }
    });
  }

  processVariables(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = data[key];
      return value !== undefined && value !== null ? value : '';
    });
  }

  registerTemplate(id, template) {
    this.templates.set(id, template);
  }

  getTemplate(id) {
    return this.templates.get(id);
  }

  listTemplates() {
    return Array.from(this.templates.values());
  }

  registerFilter(name, filterFn) {
    this.filters.set(name, filterFn);
  }

  registerFunction(name, func) {
    this.functions.set(name, func);
  }

  renderFile(templateId, data) {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);
    return this.render(template.template, data);
  }

  createSnippet(name, code, variables = []) {
    return {
      name,
      code,
      variables,
      createdAt: new Date().toISOString()
    };
  }
}

module.exports = TemplateEngine;
