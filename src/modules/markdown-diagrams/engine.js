const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownDiagramEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.diagrams = new Map();
    this.diagramDir = path.join(os.homedir(), '.pix/markdown-diagrams');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Diagram Engine...');
    await fs.ensureDir(this.diagramDir);
    await this.loadDiagrams();
    this.loadDiagramTypes();
    this.loadTemplates();
    this.logger.info('Markdown Diagram Engine initialized');
  }

  async loadDiagrams() {
    try {
      const files = await fs.readdir(this.diagramDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.diagramDir, file));
          if (data.type === 'diagram') this.diagrams.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadDiagramTypes() {
    this.diagramTypes = [
      {
        id: 'mermaid',
        name: 'Mermaid',
        icon: '📊',
        description: 'Flowcharts, sequence diagrams, Gantt charts, and more',
        syntax: '```mermaid\n...\n```',
        examples: ['flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'pie']
      },
      {
        id: 'plantuml',
        name: 'PlantUML',
        icon: '🏗️',
        description: 'UML and other diagrams',
        syntax: '@startuml\n...\n@enduml',
        examples: ['sequence', 'usecase', 'class', 'activity', 'component']
      },
      {
        id: 'graphviz',
        name: 'Graphviz',
        icon: '🕸️',
        description: 'Graph visualization',
        syntax: 'digraph {\n  ...\n}',
        examples: ['directed', 'undirected', 'cluster']
      },
      {
        id: 'vega',
        name: 'Vega',
        icon: '📈',
        description: 'Data visualization',
        syntax: '{\n  "$schema": "...",\n  ...\n}',
        examples: ['bar', 'line', 'area', 'scatter', 'pie']
      },
      {
        id: 'd2',
        name: 'D2',
        icon: '🔲',
        description: 'Modern diagram scripting',
        syntax: 'direction: right\n...\n',
        examples: ['flowchart', 'class', 'er', 'mindmap']
      }
    ];
  }

  loadTemplates() {
    const defaults = [
      {
        id: 'mermaid-flowchart',
        name: 'Flowchart',
        type: 'mermaid',
        content: 'graph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Action 1]\n    B -->|No| D[Action 2]\n    C --> E[End]\n    D --> E',
        icon: '🔄'
      },
      {
        id: 'mermaid-sequence',
        name: 'Sequence Diagram',
        type: 'mermaid',
        content: 'sequenceDiagram\n    participant A as Alice\n    participant B as Bob\n    A->>B: Hello Bob!\n    B-->>A: Hi Alice!\n    A->>B: How are you?\n    B-->>A: Great!',
        icon: '↔️'
      },
      {
        id: 'mermaid-class',
        name: 'Class Diagram',
        type: 'mermaid',
        content: 'classDiagram\n    Animal <|-- Duck\n    Animal <|-- Fish\n    Animal <|-- Zebra\n    Animal : +int age\n    Animal : +String gender\n    Animal: +isMammal()\n    Animal: +mate()\n    class Duck {\n        +String beakColor\n        +swim()\n        +quack()\n    }',
        icon: '🏗️'
      },
      {
        id: 'mermaid-gantt',
        name: 'Gantt Chart',
        type: 'mermaid',
        content: 'gantt\n    title A Gantt Diagram\n    dateFormat YYYY-MM-DD\n    section Section\n    A task          :a1, 2024-01-01, 30d\n    Another task    :after a1, 20d\n    section Another\n    Task in sec     :2024-01-12, 12d',
        icon: '📅'
      },
      {
        id: 'mermaid-pie',
        name: 'Pie Chart',
        type: 'mermaid',
        content: 'pie title Pets adopted at the shelter\n    "Dogs" : 86\n    "Cats" : 150\n    "Rats" : 9',
        icon: '🥧'
      },
      {
        id: 'mermaid-er',
        name: 'ER Diagram',
        type: 'mermaid',
        content: 'erDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n    PRODUCT }o--|| LINE-ITEM : "ordered in"',
        icon: '🗃️'
      },
      {
        id: 'plantuml-sequence',
        name: 'PlantUML Sequence',
        type: 'plantuml',
        content: '@startuml\nAlice -> Bob: Hello Bob!\nBob --> Alice: Hi Alice!\nAlice -> Bob: How are you?\nBob --> Alice: Great!\n@enduml',
        icon: '↔️'
      }
    ];

    defaults.forEach(template => {
      if (!this.diagrams.has(template.id)) {
        this.diagrams.set(template.id, {
          ...template,
          type: 'diagram',
          usageCount: 0,
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  async createDiagram(params) {
    const {
      name,
      type = 'mermaid',
      content,
      description = '',
      tags = []
    } = params;

    const id = uuidv4();
    const diagram = {
      id,
      name,
      type,
      content,
      description,
      tags,
      usageCount: 0,
      lastUsed: null,
      type: 'diagram',
      createdAt: new Date().toISOString()
    };

    this.diagrams.set(id, diagram);
    return diagram;
  }

  async updateDiagram(id, updates) {
    const diagram = this.diagrams.get(id);
    if (!diagram) throw new Error(`Diagram not found: ${id}`);

    const updated = { ...diagram, ...updates };
    this.diagrams.set(id, updated);
    return updated;
  }

  async deleteDiagram(id) {
    this.diagrams.delete(id);
    return { success: true };
  }

  async getDiagram(id) {
    const diagram = this.diagrams.get(id);
    if (!diagram) throw new Error(`Diagram not found: ${id}`);

    diagram.usageCount = (diagram.usageCount || 0) + 1;
    diagram.lastUsed = new Date().toISOString();
    this.diagrams.set(id, diagram);

    return diagram;
  }

  listDiagrams(options = {}) {
    const { type, tags, search } = options;
    let diagrams = Array.from(this.diagrams.values());

    if (type) diagrams = diagrams.filter(d => d.type === type);
    if (tags && tags.length > 0) {
      diagrams = diagrams.filter(d => tags.some(t => d.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      diagrams = diagrams.filter(d =>
        d.name.toLowerCase().includes(searchLower) ||
        d.content.toLowerCase().includes(searchLower)
      );
    }

    return diagrams.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }

  renderMermaid(content) {
    return '```mermaid\n' + content + '\n```';
  }

  renderPlantUML(content) {
    return '@startuml\n' + content + '\n@enduml';
  }

  renderGraphviz(content) {
    return '```dot\n' + content + '\n```';
  }

  renderDiagram(diagram) {
    switch (diagram.type) {
      case 'mermaid':
        return this.renderMermaid(diagram.content);
      case 'plantuml':
        return this.renderPlantUML(diagram.content);
      case 'graphviz':
        return this.renderGraphviz(diagram.content);
      default:
        return diagram.content;
    }
  }

  getDiagramTypes() {
    return this.diagramTypes;
  }

  async getDiagramFromTemplate(templateId) {
    const template = this.diagrams.get(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    return {
      ...template,
      id: uuidv4(),
      usageCount: 0,
      createdAt: new Date().toISOString()
    };
  }

  async searchDiagrams(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, diagram] of this.diagrams) {
      let score = 0;

      if (diagram.name.toLowerCase().includes(queryLower)) score += 10;
      if (diagram.content.toLowerCase().includes(queryLower)) score += 5;
      if (diagram.description.toLowerCase().includes(queryLower)) score += 3;

      if (score > 0) {
        results.push({ ...diagram, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getMostUsed(limit = 10) {
    return Array.from(this.diagrams.values())
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }

  async getStats() {
    const diagrams = Array.from(this.diagrams.values());

    return {
      total: diagrams.length,
      diagramTypes: this.diagramTypes.length,
      totalUsage: diagrams.reduce((sum, d) => sum + (d.usageCount || 0), 0),
      byType: this.getDiagramsByType()
    };
  }

  getDiagramsByType() {
    const diagrams = Array.from(this.diagrams.values());
    const byType = {};

    for (const diagram of diagrams) {
      byType[diagram.type] = (byType[diagram.type] || 0) + 1;
    }

    return byType;
  }

  async exportDiagrams(format = 'json') {
    const diagrams = Array.from(this.diagrams.values());

    if (format === 'json') {
      return JSON.stringify(diagrams, null, 2);
    }

    if (format === 'markdown') {
      return diagrams.map(d => `### ${d.name}\n\n${this.renderDiagram(d)}`).join('\n\n---\n\n');
    }

    return diagrams;
  }
}

module.exports = MarkdownDiagramEngine;
