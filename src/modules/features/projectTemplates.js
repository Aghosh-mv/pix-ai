const fs = require('fs');
const path = require('path');

const TEMPLATES = {
  'react': {
    name: 'React App',
    desc: 'Modern React with Vite + Tailwind',
    files: {
      'package.json': `{"name":"{{name}}","version":"0.1.0","scripts":{"dev":"vite","build":"vite build","preview":"vite preview"},"dependencies":{"react":"^18.2.0","react-dom":"^18.2.0"},"devDependencies":{"@vitejs/plugin-react":"^4.0.0","vite":"^5.0.0","tailwindcss":"^3.3.0","autoprefixer":"^10.0.0","postcss":"^8.0.0"}}`,
      'vite.config.js': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })`,
      'index.html': `<!DOCTYPE html><html><head><title>{{name}}</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`,
      'src/main.jsx': `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\nReactDOM.createRoot(document.getElementById('root')).render(<App />)`,
      'src/App.jsx': `export default function App() { return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center"><h1 className="text-4xl font-bold">{{name}}</h1></div> }`,
      'src/index.css': `@tailwind base;\n@tailwind components;\n@tailwind utilities;`,
      'tailwind.config.js': `export default { content: ['./src/**/*.{js,jsx}'], theme: { extend: {} }, plugins: [] }`,
      'postcss.config.js': `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`
    }
  },
  'node-api': {
    name: 'Node.js API',
    desc: 'Express REST API with routes',
    files: {
      'package.json': `{"name":"{{name}}","version":"0.1.0","scripts":{"start":"node src/index.js","dev":"nodemon src/index.js"},"dependencies":{"express":"^4.18.0","cors":"^2.8.0","dotenv":"^16.0.0"},"devDependencies":{"nodemon":"^3.0.0"}}`,
      'src/index.js': `const express = require('express');\nconst cors = require('cors');\nrequire('dotenv').config();\nconst app = express();\napp.use(cors());\napp.use(express.json());\napp.get('/', (req, res) => res.json({ name: '{{name}}', status: 'ok' }));\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log('Server running on port ' + PORT));`,
      '.env': `PORT=3000`,
      '.gitignore': `node_modules\n.env`
    }
  },
  'python': {
    name: 'Python Project',
    desc: 'Python project with pip + virtual env',
    files: {
      'requirements.txt': `flask==3.0.0\nrequests==2.31.0\npython-dotenv==1.0.0`,
      'src/main.py': `from flask import Flask, jsonify\nimport os\napp = Flask(__name__)\n@app.route('/')\ndef index():\n    return jsonify({'name': '{{name}}', 'status': 'ok'})\nif __name__ == '__main__':\n    app.run(debug=True, port=int(os.getenv('PORT', 5000)))`,
      '.env': `PORT=5000`,
      'README.md': `# {{name}}\n\n## Setup\npython3 -m venv venv\nsource venv/bin/activate\npip install -r requirements.txt\npython src/main.py`
    }
  },
  'cli-tool': {
    name: 'CLI Tool',
    desc: 'Node.js CLI with commander',
    files: {
      'package.json': `{"name":"{{name}}","version":"0.1.0","bin":{"{{name}}":"./bin/index.js"},"dependencies":{"commander":"^11.0.0","chalk":"^4.1.0"}}`,
      'bin/index.js': `#!/usr/bin/env node\nconst { Command } = require('commander');\nconst chalk = require('chalk');\nconst program = new Command();\nprogram.name('{{name}}').version('0.1.0');\nprogram.command('hello').description('Say hello').action(() => console.log(chalk.green('Hello from {{name}}!')));\nprogram.parse();`
    }
  },
  'fullstack': {
    name: 'Full Stack',
    desc: 'React frontend + Node.js backend',
    files: {
      'package.json': `{"name":"{{name}}","version":"0.1.0","scripts":{"dev":"concurrently \\"npm run server\\" \\"npm run client\\"","server":"node server/index.js","client":"cd client && npm run dev"},"dependencies":{"express":"^4.18.0","cors":"^2.8.0","dotenv":"^16.0.0"},"devDependencies":{"concurrently":"^8.0.0"}}`,
      'server/index.js': `const express = require('express');\nconst cors = require('cors');\nconst app = express();\napp.use(cors());\napp.use(express.json());\napp.get('/api', (req, res) => res.json({ message: 'Hello from {{name}}' }));\napp.listen(4000, () => console.log('Server on 4000'));`,
      'client/package.json': `{"name":"{{name}}-client","version":"0.1.0","scripts":{"dev":"vite","build":"vite build"},"dependencies":{"react":"^18.2.0","react-dom":"^18.2.0"},"devDependencies":{"@vitejs/plugin-react":"^4.0.0","vite":"^5.0.0"}}`,
      'README.md': `# {{name}}\n\nnpm install\nnpm run dev`
    }
  },
  'chrome-ext': {
    name: 'Chrome Extension',
    desc: 'Manifest V3 Chrome extension',
    files: {
      'manifest.json': `{"manifest_version":3,"name":"{{name}}","version":"1.0","action":{"default_popup":"popup.html","default_icon":{"16":"icons/icon16.png","48":"icons/icon48.png"}},"content_scripts":[{"matches":["<all_urls>"],"js":["content.js"]}}`,
      'popup.html': `<!DOCTYPE html><html><head><style>body{width:300px;padding:16px;font-family:system-ui;}</style></head><body><h2>{{name}}</h2><p>Extension is active!</p><script src="popup.js"></script></body></html>`,
      'popup.js': `document.querySelector('h2').textContent = '{{name}} - Active';`,
      'content.js': `console.log('{{name}} content script loaded');`
    }
  },
  'game': {
    name: 'Game Project',
    desc: 'HTML5 Canvas game starter',
    files: {
      'index.html': `<!DOCTYPE html><html><head><title>{{name}}</title><style>body{margin:0;background:#111;display:flex;justify-content:center;align-items:center;height:100vh}canvas{border:1px solid #333}</style></head><body><canvas id="game" width="800" height="600"></canvas><script src="game.js"></script></body></html>`,
      'game.js': `const canvas = document.getElementById('game');\nconst ctx = canvas.getContext('2d');\nconst player = { x: 400, y: 300, size: 20, color: '#0f0' };\nfunction gameLoop() {\n  ctx.fillStyle = '#111';\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = player.color;\n  ctx.fillRect(player.x, player.y, player.size, player.size);\n  requestAnimationFrame(gameLoop);\n}\ndocument.addEventListener('keydown', e => {\n  if (e.key === 'ArrowLeft') player.x -= 5;\n  if (e.key === 'ArrowRight') player.x += 5;\n  if (e.key === 'ArrowUp') player.y -= 5;\n  if (e.key === 'ArrowDown') player.y += 5;\n});\ngameLoop();`
    }
  }
};

class ProjectTemplates {
  constructor(projectRoot) {
    this.root = projectRoot;
  }

  list() {
    return Object.entries(TEMPLATES).map(([id, t]) => ({ id, name: t.name, desc: t.desc }));
  }

  get(templateId) {
    return TEMPLATES[templateId] || null;
  }

  create(templateId, projectName, targetDir) {
    const template = TEMPLATES[templateId];
    if (!template) return { success: false, error: 'Template not found' };

    const dir = targetDir || path.join(this.root, projectName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const created = [];
    for (const [filePath, content] of Object.entries(template.files)) {
      const fullContent = content.replace(/\{\{name\}\}/g, projectName);
      const fullPath = path.join(dir, filePath);
      const dirName = path.dirname(fullPath);
      if (!fs.existsSync(dirName)) fs.mkdirSync(dirName, { recursive: true });
      fs.writeFileSync(fullPath, fullContent);
      created.push(filePath);
    }

    return { success: true, files: created, dir };
  }
}

module.exports = ProjectTemplates;
