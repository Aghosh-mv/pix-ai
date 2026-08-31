const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class PixBaseEditorEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.documents = new Map();
    this.tabs = new Map();
    this.breakpoints = new Map();
    this.snippets = new Map();
    this.themes = new Map();
    this.extensions = new Map();
    this.editorDir = path.join(os.homedir(), '.pix/pixbase');

    this.editModes = [
      {
        id: 'ask-first',
        name: 'Ask Before Edit',
        icon: '❓',
        description: 'AI asks permission before every change',
        color: '#FF9800',
        behavior: {
          fileEdit: 'ask',
          fileCreate: 'ask',
          fileDelete: 'ask',
          commandRun: 'ask',
          terminalCommand: 'ask',
          gitCommit: 'ask',
          installPackage: 'ask',
          webRequest: 'ask',
          autoApply: false,
          confirmationDialog: true,
          previewBeforeApply: true,
          undoAvailable: true
        }
      },
      {
        id: 'smart-edit',
        name: 'Smart Edit',
        icon: '🧠',
        description: 'AI decides based on risk level - asks for risky, auto-approves safe',
        color: '#4CAF50',
        behavior: {
          fileEdit: 'smart',
          fileCreate: 'auto',
          fileDelete: 'ask',
          commandRun: 'smart',
          terminalCommand: 'smart',
          gitCommit: 'ask',
          installPackage: 'ask',
          webRequest: 'auto',
          autoApply: false,
          confirmationDialog: true,
          previewBeforeApply: true,
          undoAvailable: true,
          riskThreshold: 0.5,
          safePatterns: ['*.md', '*.txt', '*.json', 'README*', 'CHANGELOG*'],
          riskyPatterns: ['*.env', '*.key', 'docker-compose*', 'Makefile', '*.sh']
        }
      },
      {
        id: 'auto-edit',
        name: 'Do Some Edits',
        icon: '⚡',
        description: 'AI auto-applies safe edits, asks only for destructive actions',
        color: '#2196F3',
        behavior: {
          fileEdit: 'auto',
          fileCreate: 'auto',
          fileDelete: 'smart',
          commandRun: 'auto',
          terminalCommand: 'smart',
          gitCommit: 'auto',
          installPackage: 'smart',
          webRequest: 'auto',
          autoApply: true,
          confirmationDialog: false,
          previewBeforeApply: false,
          undoAvailable: true,
          riskThreshold: 0.7,
          safePatterns: ['*'],
          riskyPatterns: ['*.env', '*.key', 'rm -rf *', 'sudo *', 'DROP TABLE*']
        }
      },
      {
        id: 'full-auto',
        name: 'Do All Stuff',
        icon: '🚀',
        description: 'AI has full autonomy - executes everything without asking',
        color: '#F44336',
        behavior: {
          fileEdit: 'auto',
          fileCreate: 'auto',
          fileDelete: 'auto',
          commandRun: 'auto',
          terminalCommand: 'auto',
          gitCommit: 'auto',
          installPackage: 'auto',
          webRequest: 'auto',
          autoApply: true,
          confirmationDialog: false,
          previewBeforeApply: false,
          undoAvailable: true,
          riskThreshold: 0.9,
          safePatterns: ['*'],
          riskyPatterns: []
        }
      },
      {
        id: 'review-first',
        name: 'Review Then Apply',
        icon: '👁️',
        description: 'AI shows all changes in a diff view before applying',
        color: '#9C27B0',
        behavior: {
          fileEdit: 'review',
          fileCreate: 'review',
          fileDelete: 'review',
          commandRun: 'review',
          terminalCommand: 'review',
          gitCommit: 'review',
          installPackage: 'review',
          webRequest: 'auto',
          autoApply: false,
          confirmationDialog: false,
          previewBeforeApply: true,
          undoAvailable: true,
          showDiff: true,
          batchChanges: true
        }
      },
      {
        id: 'dry-run',
        name: 'Dry Run',
        icon: '🧪',
        description: 'AI shows what it would do without making any changes',
        color: '#607D8B',
        behavior: {
          fileEdit: 'dry-run',
          fileCreate: 'dry-run',
          fileDelete: 'dry-run',
          commandRun: 'dry-run',
          terminalCommand: 'dry-run',
          gitCommit: 'dry-run',
          installPackage: 'dry-run',
          webRequest: 'dry-run',
          autoApply: false,
          confirmationDialog: false,
          previewBeforeApply: true,
          undoAvailable: false,
          simulateOnly: true
        }
      }
    ];

    this.languages = [
      { id: 'javascript', name: 'JavaScript', icon: '📜', ext: '.js', color: '#F7DF1E' },
      { id: 'typescript', name: 'TypeScript', icon: '🔷', ext: '.ts', color: '#3178C6' },
      { id: 'python', name: 'Python', icon: '🐍', ext: '.py', color: '#3776AB' },
      { id: 'html', name: 'HTML', icon: '🌐', ext: '.html', color: '#E34F26' },
      { id: 'css', name: 'CSS', icon: '🎨', ext: '.css', color: '#1572B6' },
      { id: 'json', name: 'JSON', icon: '📋', ext: '.json', color: '#000000' },
      { id: 'markdown', name: 'Markdown', icon: '📝', ext: '.md', color: '#083FA1' },
      { id: 'rust', name: 'Rust', icon: '🦀', ext: '.rs', color: '#CE422B' },
      { id: 'go', name: 'Go', icon: '🔵', ext: '.go', color: '#00ADD8' },
      { id: 'java', name: 'Java', icon: '☕', ext: '.java', color: '#ED8B00' },
      { id: 'cpp', name: 'C++', icon: '⚙️', ext: '.cpp', color: '#00599C' },
      { id: 'ruby', name: 'Ruby', icon: '💎', ext: '.rb', color: '#CC342D' },
      { id: 'php', name: 'PHP', icon: '🐘', ext: '.php', color: '#777BB4' },
      { id: 'swift', name: 'Swift', icon: '🦅', ext: '.swift', color: '#F05138' },
      { id: 'kotlin', name: 'Kotlin', icon: '🇰', ext: '.kt', color: '#7F52FF' },
      { id: 'shell', name: 'Shell', icon: '🐚', ext: '.sh', color: '#89E051' },
      { id: 'yaml', name: 'YAML', icon: '📄', ext: '.yml', color: '#CB171E' },
      { id: 'toml', name: 'TOML', icon: '⚙️', ext: '.toml', color: '#9C4221' },
      { id: 'sql', name: 'SQL', icon: '🗄️', ext: '.sql', color: '#E38C00' },
      { id: 'graphql', name: 'GraphQL', icon: '◈', ext: '.graphql', color: '#E10098' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing PixBase Editor Engine...');
    await fs.ensureDir(this.editorDir);
    await fs.ensureDir(path.join(this.editorDir, 'documents'));
    await fs.ensureDir(path.join(this.editorDir, 'workspaces'));
    await this.loadDocuments();
    this.loadDefaultSnippets();
    this.loadEditorThemes();
    this.loadKeybindings();
    this.logger.info('PixBase Editor Engine initialized');
  }

  async loadDocuments() {
    try {
      const files = await fs.readdir(path.join(this.editorDir, 'documents'));
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.editorDir, 'documents', file));
          this.documents.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadDefaultSnippets() {
    const defaults = [
      { id: 'func', name: 'Function', language: 'javascript', prefix: 'fn', body: 'function ${1:name}(${2:params}) {\n\t${3:// body}\n}', description: 'New function' },
      { id: 'arrow', name: 'Arrow Function', language: 'javascript', prefix: 'af', body: '(${1:params}) => {\n\t${2:// body}\n}', description: 'Arrow function' },
      { id: 'async', name: 'Async Function', language: 'javascript', prefix: 'async', body: 'async function ${1:name}(${2:params}) {\n\t${3:// body}\n}', description: 'Async function' },
      { id: 'class', name: 'Class', language: 'javascript', prefix: 'cls', body: 'class ${1:ClassName} {\n\tconstructor(${2:params}) {\n\t\t${3:// init}\n\t}\n}', description: 'New class' },
      { id: 'try', name: 'Try Catch', language: 'javascript', prefix: 'try', body: 'try {\n\t${1:// code}\n} catch (${2:error}) {\n\t${3:// handle}\n}', description: 'Try-catch block' },
      { id: 'import', name: 'Import', language: 'javascript', prefix: 'imp', body: "import { ${1:module} } from '${2:path}';", description: 'ES6 import' },
      { id: 'export', name: 'Export', language: 'javascript', prefix: 'exp', body: 'export default ${1:name};', description: 'Default export' },
      { id: 'promise', name: 'Promise', language: 'javascript', prefix: 'prom', body: 'new Promise((resolve, reject) => {\n\t${1:// code}\n})', description: 'New promise' },
      { id: 'pyfunc', name: 'Python Function', language: 'python', prefix: 'def', body: 'def ${1:name}(${2:params}):\n\t"""${3:docstring}"""\n\t${4:pass}', description: 'Python function' },
      { id: 'pyclass', name: 'Python Class', language: 'python', prefix: 'pcls', body: 'class ${1:ClassName}:\n\tdef __init__(self${2:, params}):\n\t\t${3:pass}', description: 'Python class' },
      { id: 'pyinit', name: 'Python Init', language: 'python', prefix: '__init', body: 'def __init__(self${1:, params}):\n\t${2:pass}', description: 'Python __init__' },
      { id: 'react', name: 'React Component', language: 'javascript', prefix: 'rfc', body: "import React from 'react';\n\nconst ${1:Component} = (${2:props}) => {\n\treturn (\n\t\t<div>\n\t\t\t${3:content}\n\t\t</div>\n\t);\n};\n\nexport default ${1:Component};', description: 'React functional component' },
      { id: 'usestate', name: 'useState', language: 'javascript', prefix: 'us', body: 'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue});', description: 'React useState hook' },
      { id: 'useeffect', name: 'useEffect', language: 'javascript', prefix: 'ue', body: 'useEffect(() => {\n\t${1:// effect}\n\treturn () => {\n\t\t${2:// cleanup}\n\t};\n}, [${3:deps}]);', description: 'React useEffect hook' }
    ];

    defaults.forEach(snippet => {
      this.snippets.set(snippet.id, { ...snippet, type: 'snippet', builtin: true });
    });
  }

  loadEditorThemes() {
    this.themes = [
      { id: 'pix-dark', name: 'Pix Dark', icon: '🌙', background: '#1a1b26', foreground: '#a9b1d6', accent: '#7aa2f7' },
      { id: 'pix-light', name: 'Pix Light', icon: '☀️', background: '#ffffff', foreground: '#343746', accent: '#0066cc' },
      { id: 'pix-monokai', name: 'Monokai', icon: '🎨', background: '#272822', foreground: '#f8f8f2', accent: '#a6e22e' },
      { id: 'pix-dracula', name: 'Dracula', icon: '🧛', background: '#282a36', foreground: '#f8f8f2', accent: '#bd93f9' },
      { id: 'pix-nord', name: 'Nord', icon: '❄️', background: '#2e3440', foreground: '#d8dee9', accent: '#88c0d0' },
      { id: 'pix-solarized', name: 'Solarized', icon: '🌞', background: '#002b36', foreground: '#839496', accent: '#268bd2' },
      { id: 'pix-github', name: 'GitHub', icon: '🐙', background: '#ffffff', foreground: '#24292e', accent: '#0366d6' },
      { id: 'pix-one-dark', name: 'One Dark', icon: '🌑', background: '#282c34', foreground: '#abb2bf', accent: '#61afef' }
    ];
  }

  loadKeybindings() {
    this.keybindings = [
      { key: 'Cmd+S', command: 'save', description: 'Save document' },
      { key: 'Cmd+Z', command: 'undo', description: 'Undo last change' },
      { key: 'Cmd+Shift+Z', command: 'redo', description: 'Redo last change' },
      { key: 'Cmd+/', command: 'toggleComment', description: 'Toggle comment' },
      { key: 'Cmd+D', command: 'selectNext', description: 'Select next occurrence' },
      { key: 'Cmd+Shift+K', command: 'deleteLine', description: 'Delete line' },
      { key: 'Cmd+Enter', command: 'newLine', description: 'Insert line below' },
      { key: 'Cmd+Shift+Enter', command: 'newLineAbove', description: 'Insert line above' },
      { key: 'Alt+Up', command: 'moveLineUp', description: 'Move line up' },
      { key: 'Alt+Down', command: 'moveLineDown', description: 'Move line down' },
      { key: 'Cmd+Shift+F', command: 'format', description: 'Format document' },
      { key: 'Cmd+P', command: 'quickOpen', description: 'Quick open file' },
      { key: 'Cmd+Shift+P', command: 'commandPalette', description: 'Command palette' },
      { key: 'Cmd+B', command: 'toggleSidebar', description: 'Toggle sidebar' },
      { key: 'Cmd+J', command: 'toggleTerminal', description: 'Toggle terminal' },
      { key: 'F5', command: 'run', description: 'Run/Debug' },
      { key: 'F12', command: 'goToDefinition', description: 'Go to definition' }
    ];
  }

  async createDocument(params) {
    const {
      name,
      content = '',
      language = 'javascript',
      path: filePath = null,
      isUntitled = true,
      encoding = 'utf-8',
      lineEnding = 'lf'
    } = params;

    const id = uuidv4();
    const lang = this.languages.find(l => l.id === language) || this.languages[0];

    const document = {
      id,
      name,
      content,
      language,
      languageInfo: lang,
      path: filePath,
      isUntitled,
      encoding,
      lineEnding,
      saved: true,
      dirty: false,
      cursorPosition: { line: 0, column: 0 },
      selections: [],
      scrollPosition: 0,
      foldingRanges: [],
      diagnostics: [],
      version: 1,
      history: [],
      type: 'document',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };

    this.documents.set(id, document);
    await this.saveDocument(document);

    return document;
  }

  async openDocument(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const name = path.basename(filePath);
    const ext = path.extname(filePath);
    const lang = this.languages.find(l => l.ext === ext) || { id: 'plaintext', name: 'Plain Text' };

    const existing = Array.from(this.documents.values()).find(d => d.path === filePath);
    if (existing) return existing;

    return this.createDocument({
      name,
      content,
      language: lang.id,
      path: filePath,
      isUntitled: false
    });
  }

  async saveDocument(docId, content = null) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    if (content !== null) {
      doc.history.push({
        content: doc.content,
        timestamp: new Date().toISOString()
      });

      if (doc.history.length > 100) {
        doc.history = doc.history.slice(-50);
      }

      doc.content = content;
      doc.version++;
    }

    doc.saved = true;
    doc.dirty = false;
    doc.modifiedAt = new Date().toISOString();

    if (doc.path) {
      await fs.writeFile(doc.path, doc.content, doc.encoding);
    } else {
      const docPath = path.join(this.editorDir, 'documents', `${doc.id}.json`);
      await fs.writeJson(docPath, doc, { spaces: 2 });
    }

    this.documents.set(docId, doc);
    return doc;
  }

  async editDocument(docId, edits) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    doc.history.push({
      content: doc.content,
      timestamp: new Date().toISOString()
    });

    let newContent = doc.content;

    for (const edit of edits) {
      const { range, newText } = edit;
      if (range) {
        const lines = newContent.split('\n');
        const startLine = range.start.line;
        const startCol = range.start.column;
        const endLine = range.end.line;
        const endCol = range.end.column;

        const before = lines.slice(0, startLine).join('\n') +
          (startLine < lines.length ? lines[startLine].substring(0, startCol) : '');
        const after = (endLine < lines.length ? lines[endLine].substring(endCol) : '') +
          lines.slice(endLine + 1).join('\n');

        newContent = before + newText + after;
      } else {
        newContent += newText;
      }
    }

    doc.content = newContent;
    doc.dirty = true;
    doc.version++;
    doc.modifiedAt = new Date().toISOString();

    this.documents.set(docId, doc);
    return doc;
  }

  async closeDocument(docId) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    this.documents.delete(docId);
    return { success: true };
  }

  async getDocument(docId) {
    return this.documents.get(docId);
  }

  listDocuments(options = {}) {
    const { language, search, unsaved } = options;
    let docs = Array.from(this.documents.values());

    if (language) docs = docs.filter(d => d.language === language);
    if (unsaved) docs = docs.filter(d => d.dirty);
    if (search) {
      const searchLower = search.toLowerCase();
      docs = docs.filter(d =>
        d.name.toLowerCase().includes(searchLower) ||
        d.content.toLowerCase().includes(searchLower)
      );
    }

    return docs.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
  }

  async searchInDocument(docId, query, options = {}) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    const { caseSensitive = false, wholeWord = false, regex = false } = options;
    const content = doc.content;
    const results = [];

    let pattern;
    if (regex) {
      pattern = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundary = wholeWord ? `\\b${escaped}\\b` : escaped;
      pattern = new RegExp(wordBoundary, caseSensitive ? 'g' : 'gi');
    }

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const beforeMatch = content.substring(0, match.index);
      const line = (beforeMatch.match(/\n/g) || []).length + 1;
      const column = match.index - beforeMatch.lastIndexOf('\n');

      results.push({
        match: match[0],
        line,
        column,
        index: match.index,
        context: content.substring(Math.max(0, match.index - 30), match.index + match[0].length + 30)
      });
    }

    return results;
  }

  async getDocumentStats(docId) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    const content = doc.content;
    const lines = content.split('\n');
    const words = content.trim().split(/\s+/).filter(Boolean);
    const characters = content.length;
    const charactersNoSpaces = content.replace(/\s/g, '').length;

    return {
      lines: lines.length,
      words: words.length,
      characters,
      charactersNoSpaces,
      paragraphs: content.split(/\n\n+/).filter(Boolean).length,
      sentences: content.split(/[.!?]+/).filter(s => s.trim()).length,
      avgWordsPerLine: lines.length > 0 ? Math.round(words.length / lines.length) : 0,
      avgLineLength: lines.length > 0 ? Math.round(content.length / lines.length) : 0,
      longestLine: Math.max(...lines.map(l => l.length)),
      version: doc.version,
      saved: doc.saved,
      dirty: doc.dirty
    };
  }

  async undo(docId) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    if (doc.history.length === 0) throw new Error('Nothing to undo');

    const previous = doc.history.pop();
    doc.content = previous.content;
    doc.version++;
    doc.modifiedAt = new Date().toISOString();

    this.documents.set(docId, doc);
    return doc;
  }

  async redo(docId) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    doc.version++;
    doc.modifiedAt = new Date().toISOString();

    this.documents.set(docId, doc);
    return doc;
  }

  async createTab(docId, position = null) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    const tabId = uuidv4();
    const tab = {
      id: tabId,
      documentId: docId,
      name: doc.name,
      pinned: false,
      preview: false,
      position: position || this.tabs.size,
      type: 'tab'
    };

    this.tabs.set(tabId, tab);
    return tab;
  }

  async closeTab(tabId) {
    this.tabs.delete(tabId);
    return { success: true };
  }

  listTabs() {
    return Array.from(this.tabs.values()).sort((a, b) => a.position - b.position);
  }

  getLanguages() {
    return this.languages;
  }

  getThemes() {
    return this.themes;
  }

  getEditModes() {
    return this.editModes;
  }

  getEditMode(modeId) {
    return this.editModes.find(m => m.id === modeId);
  }

  async checkEditPermission(docId, action, modeId = 'smart-edit') {
    const mode = this.editModes.find(m => m.id === modeId);
    if (!mode) throw new Error(`Edit mode not found: ${modeId}`);

    const doc = this.documents.get(docId);
    const behavior = mode.behavior;

    const actionKey = action.type.replace('-', '');
    let permission = behavior[actionKey] || behavior.fileEdit || 'ask';

    if (permission === 'smart') {
      const riskLevel = this.assessRisk(action, doc, mode.behavior);
      permission = riskLevel < (mode.behavior.riskThreshold || 0.5) ? 'auto' : 'ask';
    }

    return {
      allowed: permission !== 'dry-run',
      mode: modeId,
      permission,
      requiresConfirmation: permission === 'ask' || permission === 'review',
      showDiff: permission === 'review' || mode.behavior.showDiff,
      simulateOnly: permission === 'dry-run',
      previewBeforeApply: mode.behavior.previewBeforeApply
    };
  }

  assessRisk(action, doc, behavior) {
    let risk = 0.3;

    if (action.type === 'delete') risk += 0.4;
    if (action.type === 'overwrite') risk += 0.3;

    if (action.target) {
      const isRisky = (behavior.riskyPatterns || []).some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(path.basename(action.target));
      });
      if (isRisky) risk += 0.3;

      const isSafe = (behavior.safePatterns || []).some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(path.basename(action.target));
      });
      if (isSafe) risk -= 0.2;
    }

    return Math.max(0, Math.min(1, risk));
  }

  async formatDocument(docId) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    let formatted = doc.content;

    formatted = formatted.replace(/\t/g, '    ');
    formatted = formatted.replace(/[ \t]+$/gm, '');
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    if (!formatted.endsWith('\n')) {
      formatted += '\n';
    }

    doc.content = formatted;
    doc.version++;
    doc.modifiedAt = new Date().toISOString();

    this.documents.set(docId, doc);
    return doc;
  }

  async analyzeDocument(docId) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document not found: ${docId}`);

    const content = doc.content;
    const stats = await this.getDocumentStats(docId);

    const issues = [];

    const longLines = content.split('\n').filter(l => l.length > 120);
    if (longLines.length > 0) {
      issues.push({ type: 'style', message: `${longLines.length} lines exceed 120 characters`, severity: 'warning' });
    }

    const trailingWhitespace = content.match(/[ \t]+$/gm);
    if (trailingWhitespace) {
      issues.push({ type: 'style', message: 'Trailing whitespace found', severity: 'info' });
    }

    const TODOs = content.match(/TODO|FIXME|HACK|XXX/gi);
    if (TODOs) {
      issues.push({ type: 'todo', message: `${TODOs.length} TODO/FIXME comments found`, severity: 'info' });
    }

    const consoleLogs = content.match(/console\.(log|warn|error)/g);
    if (consoleLogs) {
      issues.push({ type: 'code-quality', message: `${consoleLogs.length} console statements found`, severity: 'warning' });
    }

    return {
      stats,
      issues,
      suggestions: this.generateSuggestions(doc, stats, issues)
    };
  }

  generateSuggestions(doc, stats, issues) {
    const suggestions = [];

    if (stats.avgLineLength > 80) {
      suggestions.push('Consider breaking long lines for better readability');
    }

    if (doc.language === 'javascript' && doc.content.includes('var ')) {
      suggestions.push('Consider using const/let instead of var');
    }

    if (issues.some(i => i.type === 'todo')) {
      suggestions.push('Review and address TODO/FIXME comments');
    }

    return suggestions;
  }

  async getStats() {
    const documents = Array.from(this.documents.values());

    return {
      documents: documents.length,
      openTabs: this.tabs.size,
      snippets: this.snippets.size,
      languages: this.languages.length,
      themes: this.themes.length,
      unsavedDocuments: documents.filter(d => d.dirty).length,
      totalLines: documents.reduce((sum, d) => sum + d.content.split('\n').length, 0),
      totalCharacters: documents.reduce((sum, d) => sum + d.content.length, 0)
    };
  }

  async saveDocument(doc) {
    const filePath = path.join(this.editorDir, 'documents', `${doc.id}.json`);
    await fs.writeJson(filePath, doc, { spaces: 2 });
  }
}

module.exports = PixBaseEditorEngine;
