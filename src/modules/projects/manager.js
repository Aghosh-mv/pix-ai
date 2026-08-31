const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ProjectManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.projects = new Map();
    this.templates = new Map();
    this.recentProjects = [];
    this.projectsDir = path.join(os.homedir(), '.pix/projects');
    this.projectsFile = path.join(this.projectsDir, 'projects.json');
  }

  async initialize() {
    this.logger.info('Initializing Project Manager...');
    await fs.ensureDir(this.projectsDir);
    await this.loadProjects();
    this.loadProjectTemplates();
    this.logger.info('Project Manager initialized');
  }

  async loadProjects() {
    try {
      if (await fs.pathExists(this.projectsFile)) {
        const data = await fs.readJson(this.projectsFile);
        this.projects = new Map(Object.entries(data.projects || {}));
        this.recentProjects = data.recentProjects || [];
      }
    } catch (e) {
      this.projects = new Map();
      this.recentProjects = [];
    }
  }

  async saveProjects() {
    await fs.writeJson(this.projectsFile, {
      projects: Object.fromEntries(this.projects),
      recentProjects: this.recentProjects
    }, { spaces: 2 });
  }

  loadProjectTemplates() {
    const templates = [
      {
        id: 'node-express',
        name: 'Node.js + Express',
        description: 'Full-stack web application with Express.js',
        language: 'javascript',
        files: {
          'package.json': `{\n  "name": "{{projectName}}",\n  "version": "1.0.0",\n  "main": "src/index.js",\n  "scripts": {\n    "start": "node src/index.js",\n    "dev": "nodemon src/index.js",\n    "test": "jest"\n  },\n  "dependencies": {\n    "express": "^4.18.2",\n    "cors": "^2.8.5",\n    "dotenv": "^16.3.1"\n  },\n  "devDependencies": {\n    "nodemon": "^3.0.1",\n    "jest": "^29.7.0"\n  }\n}`,
          'src/index.js': `const express = require('express');\nconst cors = require('cors');\nrequire('dotenv').config();\n\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(cors());\napp.use(express.json());\n\napp.get('/', (req, res) => {\n  res.json({ message: 'Welcome to {{projectName}}' });\n});\n\napp.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`);\n});`,
          '.env': `PORT=3000\nNODE_ENV=development`,
          '.gitignore': `node_modules/\n.env\ndist/\ncoverage/`,
          'README.md': `# {{projectName}}\n\n## Description\n\n{{description}}\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Usage\n\n\`\`\`bash\nnpm start\n\`\`\`\n\n## License\n\nMIT`
        },
        tags: ['web', 'api', 'backend']
      },
      {
        id: 'react-app',
        name: 'React Application',
        description: 'Modern React application with hooks and context',
        language: 'javascript',
        files: {
          'package.json': `{\n  "name": "{{projectName}}",\n  "version": "1.0.0",\n  "private": true,\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0",\n    "react-router-dom": "^6.20.0"\n  },\n  "scripts": {\n    "start": "react-scripts start",\n    "build": "react-scripts build",\n    "test": "react-scripts test"\n  }\n}`,
          'src/App.jsx': `import React from 'react';\nimport { BrowserRouter as Router, Routes, Route } from 'react-router-dom';\n\nfunction App() {\n  return (\n    <Router>\n      <Routes>\n        <Route path="/" element={<Home />} />\n      </Routes>\n    </Router>\n  );\n}\n\nfunction Home() {\n  return <div>Welcome to {{projectName}}</div>;\n}\n\nexport default App;`,
          'src/index.jsx': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);`,
          'public/index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{projectName}}</title>\n</head>\n<body>\n  <div id="root"></div>\n</body>\n</html>`
        },
        tags: ['frontend', 'react', 'spa']
      },
      {
        id: 'python-flask',
        name: 'Python + Flask',
        description: 'Flask web application with REST API',
        language: 'python',
        files: {
          'requirements.txt': `flask==3.0.0\nflask-cors==4.0.0\npython-dotenv==1.0.0`,
          'app.py': `from flask import Flask, jsonify, request\nfrom flask_cors import CORS\nimport os\nfrom dotenv import load_dotenv\n\nload_dotenv()\n\napp = Flask(__name__)\nCORS(app)\n\n@app.route('/')\ndef index():\n    return jsonify({'message': 'Welcome to {{projectName}}'})\n\n@app.route('/api/health')\ndef health():\n    return jsonify({'status': 'healthy'})\n\nif __name__ == '__main__':\n    port = int(os.environ.get('PORT', 5000))\n    app.run(debug=True, port=port)`,
          '.env': `PORT=5000\nFLASK_ENV=development`,
          '.gitignore': `__pycache__/\n*.pyc\n.env\nvenv/\n.venv/`,
          'README.md': `# {{projectName}}\n\n## Description\n\n{{description}}\n\n## Installation\n\n\`\`\`bash\npip install -r requirements.txt\n\`\`\`\n\n## Usage\n\n\`\`\`bash\npython app.py\n\`\`\`\n\n## License\n\nMIT`
        },
        tags: ['backend', 'python', 'api']
      },
      {
        id: 'nextjs-app',
        name: 'Next.js Application',
        description: 'Full-stack Next.js application with API routes',
        language: 'javascript',
        files: {
          'package.json': `{\n  "name": "{{projectName}}",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "next dev",\n    "build": "next build",\n    "start": "next start"\n  },\n  "dependencies": {\n    "next": "^14.0.0",\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  }\n}`,
          'pages/index.js': `export default function Home() {\n  return (\n    <div>\n      <h1>Welcome to {{projectName}}</h1>\n    </div>\n  );\n}`,
          'pages/api/hello.js': `export default function handler(req, res) {\n  res.status(200).json({ message: 'Hello from {{projectName}}' });\n}`,
          'next.config.js': `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  reactStrictMode: true,\n}\n\nmodule.exports = nextConfig`
        },
        tags: ['fullstack', 'nextjs', 'react']
      },
      {
        id: 'typescript-node',
        name: 'TypeScript + Node.js',
        description: 'TypeScript Node.js application',
        language: 'typescript',
        files: {
          'package.json': `{\n  "name": "{{projectName}}",\n  "version": "1.0.0",\n  "scripts": {\n    "build": "tsc",\n    "start": "node dist/index.js",\n    "dev": "ts-node src/index.ts"\n  },\n  "devDependencies": {\n    "typescript": "^5.3.2",\n    "@types/node": "^20.10.0",\n    "ts-node": "^10.9.2"\n  }\n}`,
          'tsconfig.json': `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "module": "commonjs",\n    "lib": ["ES2020"],\n    "outDir": "./dist",\n    "rootDir": "./src",\n    "strict": true,\n    "esModuleInterop": true,\n    "skipLibCheck": true,\n    "forceConsistentCasingInFileNames": true\n  },\n  "include": ["src/**/*"]\n}`,
          'src/index.ts': `interface Config {\n  port: number;\n  env: string;\n}\n\nconst config: Config = {\n  port: parseInt(process.env.PORT || '3000'),\n  env: process.env.NODE_ENV || 'development'\n};\n\nconsole.log('Starting {{projectName}}...');\nconsole.log(\`Port: \${config.port}\`);\nconsole.log(\`Environment: \${config.env}\`);`
        },
        tags: ['typescript', 'backend', 'node']
      },
      {
        id: 'electron-app',
        name: 'Electron Desktop App',
        description: 'Cross-platform desktop application',
        language: 'javascript',
        files: {
          'package.json': `{\n  "name": "{{projectName}}",\n  "version": "1.0.0",\n  "main": "main.js",\n  "scripts": {\n    "start": "electron .",\n    "build": "electron-builder"\n  },\n  "dependencies": {\n    "electron": "^28.0.0"\n  }\n}`,
          'main.js': `const { app, BrowserWindow } = require('electron');\nconst path = require('path');\n\nfunction createWindow() {\n  const win = new BrowserWindow({\n    width: 800,\n    height: 600,\n    webPreferences: {\n      nodeIntegration: true,\n      contextIsolation: false\n    }\n  });\n\n  win.loadFile('index.html');\n}\n\napp.whenReady().then(createWindow);\n\napp.on('window-all-closed', () => {\n  if (process.platform !== 'darwin') app.quit();\n});`,
          'index.html': `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>{{projectName}}</title>\n</head>\n<body>\n  <h1>Welcome to {{projectName}}</h1>\n</body>\n</html>`
        },
        tags: ['desktop', 'electron', 'cross-platform']
      },
      {
        id: 'vue-app',
        name: 'Vue.js Application',
        description: 'Vue.js 3 application with Composition API',
        language: 'javascript',
        files: {
          'package.json': `{\n  "name": "{{projectName}}",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  },\n  "dependencies": {\n    "vue": "^3.3.8"\n  },\n  "devDependencies": {\n    "vite": "^5.0.0"\n  }\n}`,
          'src/App.vue': `<template>\n  <div>\n    <h1>Welcome to {{projectName}}</h1>\n  </div>\n</template>\n\n<script setup>\nimport { ref } from 'vue'\n\nconst message = ref('Hello Vue!')\n</script>`,
          'src/main.js': `import { createApp } from 'vue'\nimport App from './App.vue'\n\ncreateApp(App).mount('#app')`,
          'index.html': `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>{{projectName}}</title>\n</head>\n<body>\n  <div id="app"></div>\n  <script type="module" src="/src/main.js"></script>\n</body>\n</html>`
        },
        tags: ['frontend', 'vue', 'spa']
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  async create(params) {
    const {
      name,
      description = '',
      path: projectPath,
      template = null,
      language = 'javascript',
      tags = []
    } = params;

    const id = uuidv4();
    const projectDir = projectPath || path.join(os.homedir(), 'projects', name);

    await fs.ensureDir(projectDir);

    const project = {
      id,
      name,
      description,
      path: projectDir,
      template,
      language,
      tags,
      files: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpened: null
    };

    if (template) {
      await this.applyTemplate(projectDir, template, { projectName: name, description });
    }

    this.projects.set(id, project);
    await this.saveProjects();

    this.logger.info(`Project created: ${name}`);
    return project;
  }

  async applyTemplate(projectDir, templateId, variables = {}) {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    for (const [filePath, content] of Object.entries(template.files)) {
      let resolvedContent = content;
      for (const [key, value] of Object.entries(variables)) {
        resolvedContent = resolvedContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      const fullPath = path.join(projectDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, resolvedContent);
    }

    return { template: template.name, files: Object.keys(template.files).length };
  }

  async update(params) {
    const { id, ...updates } = params;
    const project = this.projects.get(id);

    if (!project) throw new Error(`Project not found: ${id}`);

    const updated = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.projects.set(id, updated);
    await this.saveProjects();

    return updated;
  }

  async delete(params) {
    const { id, deleteFiles = false } = params;
    const project = this.projects.get(id);

    if (!project) throw new Error(`Project not found: ${id}`);

    if (deleteFiles && project.path) {
      await fs.remove(project.path).catch(() => {});
    }

    this.projects.delete(id);
    this.recentProjects = this.recentProjects.filter(p => p !== id);
    await this.saveProjects();

    return { success: true };
  }

  async open(params) {
    const { id } = params;
    const project = this.projects.get(id);

    if (!project) throw new Error(`Project not found: ${id}`);

    project.lastOpened = new Date().toISOString();
    this.projects.set(id, project);

    this.recentProjects = [id, ...this.recentProjects.filter(p => p !== id)].slice(0, 10);
    await this.saveProjects();

    return project;
  }

  list() {
    return Array.from(this.projects.values());
  }

  get(id) {
    return this.projects.get(id);
  }

  getRecent() {
    return this.recentProjects
      .map(id => this.projects.get(id))
      .filter(Boolean);
  }

  search(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const project of this.projects.values()) {
      let score = 0;
      if (project.name.toLowerCase().includes(queryLower)) score += 10;
      if (project.description.toLowerCase().includes(queryLower)) score += 8;
      if (project.tags.some(t => t.toLowerCase().includes(queryLower))) score += 6;
      if (project.language.toLowerCase().includes(queryLower)) score += 4;

      if (score > 0) {
        results.push({ ...project, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  getTemplates() {
    return Array.from(this.templates.values());
  }

  getTemplate(id) {
    return this.templates.get(id);
  }

  async getProjectStats(projectId) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const stats = {
      files: 0,
      totalSize: 0,
      languages: {},
      lastModified: null
    };

    const walkDir = async (dir) => {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules') continue;

          const itemPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            await walkDir(itemPath);
          } else {
            stats.files++;
            const stat = await fs.stat(itemPath);
            stats.totalSize += stat.size;

            const ext = path.extname(item.name).toLowerCase();
            const lang = this.getLanguageFromExt(ext);
            stats.languages[lang] = (stats.languages[lang] || 0) + 1;

            if (!stats.lastModified || stat.mtime > stats.lastModified) {
              stats.lastModified = stat.mtime;
            }
          }
        }
      } catch (e) {}
    };

    if (project.path && await fs.pathExists(project.path)) {
      await walkDir(project.path);
    }

    return stats;
  }

  getLanguageFromExt(ext) {
    const map = {
      '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
      '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
      '.html': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
      '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
      '.md': 'markdown', '.txt': 'text', '.sh': 'bash', '.zsh': 'bash',
      '.sql': 'sql', '.graphql': 'graphql', '.vue': 'vue', '.svelte': 'svelte'
    };
    return map[ext] || 'other';
  }

  async createFromGit(params) {
    const { url, name, branch = 'main' } = params;
    const projectDir = path.join(os.homedir(), 'projects', name);

    const git = require('./git/engine');
    const gitEngine = new git(this.config, this.logger);
    await gitEngine.clone(url, projectDir, { branch });

    return this.create({
      name,
      path: projectDir,
      template: null,
      tags: ['git', 'cloned']
    });
  }
}

module.exports = ProjectManager;
