const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownTemplateEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.templates = new Map();
    this.variables = new Map();
    this.templateDir = path.join(os.homedir(), '.pix/markdown-templates');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Template Engine...');
    await fs.ensureDir(this.templateDir);
    await this.loadTemplates();
    this.loadBuiltinTemplates();
    this.loadVariableTypes();
    this.logger.info('Markdown Template Engine initialized');
  }

  async loadTemplates() {
    try {
      const files = await fs.readdir(this.templateDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.templateDir, file));
          if (data.type === 'template') this.templates.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadBuiltinTemplates() {
    const defaults = [
      {
        id: 'readme',
        name: 'README',
        description: 'Standard README template',
        icon: '📖',
        content: '# {{project_name}}\n\n{{description}}\n\n## Features\n\n{{features}}\n\n## Installation\n\n```bash\n{{install_command}}\n```\n\n## Usage\n\n```{{language}}\n{{usage_example}}\n```\n\n## API\n\n{{api_documentation}}\n\n## Contributing\n\n{{contributing_guide}}\n\n## License\n\n{{license}}',
        variables: [
          { name: 'project_name', type: 'text', required: true, description: 'Project name' },
          { name: 'description', type: 'textarea', required: true, description: 'Project description' },
          { name: 'features', type: 'textarea', required: true, description: 'List of features' },
          { name: 'install_command', type: 'text', required: true, description: 'Installation command' },
          { name: 'language', type: 'select', required: true, description: 'Programming language', options: ['javascript', 'python', 'java', 'go', 'rust'] },
          { name: 'usage_example', type: 'code', required: true, description: 'Usage example' },
          { name: 'api_documentation', type: 'textarea', required: false, description: 'API docs' },
          { name: 'contributing_guide', type: 'textarea', required: false, description: 'Contributing guidelines' },
          { name: 'license', type: 'text', required: true, description: 'License type' }
        ]
      },
      {
        id: 'blog-post',
        name: 'Blog Post',
        description: 'Blog post template',
        icon: '📝',
        content: '# {{title}}\n\n**Date:** {{date}}  \n**Author:** {{author}}  \n**Tags:** {{tags}}\n\n---\n\n## Introduction\n\n{{introduction}}\n\n## Main Content\n\n{{main_content}}\n\n## Conclusion\n\n{{conclusion}}\n\n---\n\n**About the Author**\n\n{{author_bio}}',
        variables: [
          { name: 'title', type: 'text', required: true, description: 'Post title' },
          { name: 'date', type: 'date', required: true, description: 'Publication date' },
          { name: 'author', type: 'text', required: true, description: 'Author name' },
          { name: 'tags', type: 'text', required: true, description: 'Comma-separated tags' },
          { name: 'introduction', type: 'textarea', required: true, description: 'Introduction paragraph' },
          { name: 'main_content', type: 'textarea', required: true, description: 'Main content' },
          { name: 'conclusion', type: 'textarea', required: true, description: 'Conclusion' },
          { name: 'author_bio', type: 'textarea', required: false, description: 'Author biography' }
        ]
      },
      {
        id: 'api-doc',
        name: 'API Documentation',
        description: 'REST API documentation template',
        icon: '🌐',
        content: '# {{api_name}} API\n\n{{description}}\n\n## Base URL\n\n```\n{{base_url}}\n```\n\n## Authentication\n\n{{authentication}}\n\n## Endpoints\n\n{{endpoints}}\n\n## Error Codes\n\n{{error_codes}}\n\n## Rate Limiting\n\n{{rate_limiting}}',
        variables: [
          { name: 'api_name', type: 'text', required: true, description: 'API name' },
          { name: 'description', type: 'textarea', required: true, description: 'API description' },
          { name: 'base_url', type: 'text', required: true, description: 'Base URL' },
          { name: 'authentication', type: 'textarea', required: true, description: 'Authentication method' },
          { name: 'endpoints', type: 'textarea', required: true, description: 'Endpoint documentation' },
          { name: 'error_codes', type: 'textarea', required: false, description: 'Error code table' },
          { name: 'rate_limiting', type: 'textarea', required: false, description: 'Rate limiting info' }
        ]
      },
      {
        id: 'changelog',
        name: 'Changelog',
        description: 'Keep a Changelog format',
        icon: '📋',
        content: '# Changelog\n\nAll notable changes to {{project_name}} will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).\n\n## [{{version}}] - {{date}}\n\n### Added\n\n{{added}}\n\n### Changed\n\n{{changed}}\n\n### Deprecated\n\n{{deprecated}}\n\n### Removed\n\n{{removed}}\n\n### Fixed\n\n{{fixed}}\n\n### Security\n\n{{security}}',
        variables: [
          { name: 'project_name', type: 'text', required: true, description: 'Project name' },
          { name: 'version', type: 'text', required: true, description: 'Version number' },
          { name: 'date', type: 'date', required: true, description: 'Release date' },
          { name: 'added', type: 'textarea', required: true, description: 'New features' },
          { name: 'changed', type: 'textarea', required: false, description: 'Changes to existing' },
          { name: 'deprecated', type: 'textarea', required: false, description: 'Deprecated features' },
          { name: 'removed', type: 'textarea', required: false, description: 'Removed features' },
          { name: 'fixed', type: 'textarea', required: false, description: 'Bug fixes' },
          { name: 'security', type: 'textarea', required: false, description: 'Security fixes' }
        ]
      },
      {
        id: 'meeting-notes',
        name: 'Meeting Notes',
        description: 'Meeting notes template',
        icon: '🤝',
        content: '# Meeting Notes - {{title}}\n\n**Date:** {{date}}  \n**Time:** {{time}}  \n**Location:** {{location}}  \n**Attendees:** {{attendees}}\n\n## Agenda\n\n{{agenda}}\n\n## Discussion\n\n{{discussion}}\n\n## Action Items\n\n{{action_items}}\n\n## Next Meeting\n\n{{next_meeting}}',
        variables: [
          { name: 'title', type: 'text', required: true, description: 'Meeting title' },
          { name: 'date', type: 'date', required: true, description: 'Meeting date' },
          { name: 'time', type: 'text', required: true, description: 'Meeting time' },
          { name: 'location', type: 'text', required: false, description: 'Meeting location' },
          { name: 'attendees', type: 'text', required: true, description: 'List of attendees' },
          { name: 'agenda', type: 'textarea', required: true, description: 'Meeting agenda' },
          { name: 'discussion', type: 'textarea', required: true, description: 'Discussion points' },
          { name: 'action_items', type: 'textarea', required: true, description: 'Action items' },
          { name: 'next_meeting', type: 'text', required: false, description: 'Next meeting details' }
        ]
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

  loadVariableTypes() {
    this.variableTypes = [
      { id: 'text', name: 'Text', icon: '📝', description: 'Single line text input' },
      { id: 'textarea', name: 'Text Area', icon: '📄', description: 'Multi-line text input' },
      { id: 'number', name: 'Number', icon: '🔢', description: 'Numeric input' },
      { id: 'date', name: 'Date', icon: '📅', description: 'Date picker' },
      { id: 'select', name: 'Select', icon: '📋', description: 'Dropdown selection' },
      { id: 'multiselect', name: 'Multi-Select', icon: '☑️', description: 'Multiple selection' },
      { id: 'code', name: 'Code', icon: '💻', description: 'Code editor' },
      { id: 'boolean', name: 'Boolean', icon: '✅', description: 'True/false toggle' },
      { id: 'url', name: 'URL', icon: '🔗', description: 'URL input' },
      { id: 'email', name: 'Email', icon: '📧', description: 'Email input' }
    ];
  }

  async createTemplate(params) {
    const {
      name,
      description = '',
      content,
      variables = [],
      tags = [],
      icon = '📝'
    } = params;

    const id = uuidv4();
    const template = {
      id,
      name,
      description,
      content,
      variables,
      tags,
      icon,
      usageCount: 0,
      lastUsed: null,
      type: 'template',
      createdAt: new Date().toISOString()
    };

    this.templates.set(id, template);
    return template;
  }

  async updateTemplate(id, updates) {
    const template = this.templates.get(id);
    if (!template) throw new Error(`Template not found: ${id}`);

    const updated = { ...template, ...updates };
    this.templates.set(id, updated);
    return updated;
  }

  async deleteTemplate(id) {
    this.templates.delete(id);
    return { success: true };
  }

  async getTemplate(id) {
    return this.templates.get(id);
  }

  listTemplates(options = {}) {
    const { tags, search } = options;
    let templates = Array.from(this.templates.values());

    if (tags && tags.length > 0) {
      templates = templates.filter(t => tags.some(tag => t.tags.includes(tag)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower)
      );
    }

    return templates.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }

  async render(templateId, variables = {}) {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    let content = template.content;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(regex, value);
    }

    const unresolved = content.match(/\{\{(\w+)\}\}/g);
    if (unresolved) {
      const missing = unresolved.map(m => m.replace(/\{\{|\}\}/g, ''));
      throw new Error(`Missing variables: ${missing.join(', ')}`);
    }

    template.usageCount = (template.usageCount || 0) + 1;
    template.lastUsed = new Date().toISOString();
    this.templates.set(templateId, template);

    return {
      content,
      template: template.name
    };
  }

  async validateVariables(templateId, variables = {}) {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    const errors = [];
    const warnings = [];

    for (const variable of template.variables) {
      if (variable.required && !variables[variable.name]) {
        errors.push({
          variable: variable.name,
          message: `${variable.name} is required`,
          type: 'required'
        });
      } else if (!variable.required && !variables[variable.name]) {
        warnings.push({
          variable: variable.name,
          message: `${variable.name} is optional and not provided`,
          type: 'optional'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  extractVariables(content) {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  getVariableTypes() {
    return this.variableTypes;
  }

  async searchTemplates(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, template] of this.templates) {
      let score = 0;

      if (template.name.toLowerCase().includes(queryLower)) score += 10;
      if (template.description.toLowerCase().includes(queryLower)) score += 5;
      if (template.tags.some(t => t.toLowerCase().includes(queryLower))) score += 3;

      if (score > 0) {
        results.push({ ...template, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getStats() {
    const templates = Array.from(this.templates.values());

    return {
      total: templates.length,
      totalVariables: templates.reduce((sum, t) => sum + (t.variables ? t.variables.length : 0), 0),
      totalUsage: templates.reduce((sum, t) => sum + (t.usageCount || 0), 0),
      variableTypes: this.variableTypes.length
    };
  }

  async exportTemplates(format = 'json') {
    const templates = Array.from(this.templates.values());

    if (format === 'json') {
      return JSON.stringify(templates, null, 2);
    }

    return templates;
  }
}

module.exports = MarkdownTemplateEngine;
