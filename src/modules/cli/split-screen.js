/**
 * Split Screen — Pix AI
 * Multi-panel TUI. User drags content in, AI watches in parallel.
 * by Aghosh-mv · justcode
 */
const blessed = require('blessed');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class SplitScreen {
  constructor(screen) {
    this.screen = screen;
    this.panels = [];
    this.activePanel = 0;
    this.watching = false;
    this.watchInterval = null;
    this.onContentChange = null; // callback when panel content changes
  }

  // ── Create a new panel ──
  createPanel(opts = {}) {
    const id = this.panels.length;
    const panel = {
      id,
      title: opts.title || `panel ${id}`,
      type: opts.type || 'terminal', // terminal | file | url | watch
      source: opts.source || null,
      content: '',
      history: [],
      box: null,
      scrollable: true,
      focused: false,
    };

    // Calculate layout
    const count = this.panels.length + 1;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const pw = Math.floor((this.screen.width - 2) / cols);
    const ph = Math.floor((this.screen.height - 4) / rows);

    const col = id % cols;
    const row = Math.floor(id / cols);

    panel.box = blessed.box({
      parent: this.screen,
      top: row * ph,
      left: col * pw,
      width: pw,
      height: ph,
      tags: true,
      border: { type: 'line', fg: panel.focused ? '#818cf8' : '#27272a' },
      style: { fg: '#d4d4d8', bg: '#0f0f11' },
      label: ` ${panel.title} `,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { style: { bg: '#3f3f46' } },
      padding: { left: 1, right: 1 },
    });

    // Add action bar at top of panel
    panel.actionBar = blessed.box({
      parent: panel.box,
      top: 0, left: 0, right: 0, height: 1,
      tags: true,
      style: { fg: '#737373', bg: '#1a1a1f' },
      content: ` {gray-fg}[tab] focus │ [x] close │ [w] watch │ [e] export{/}`,
    });

    panel.contentBox = blessed.box({
      parent: panel.box,
      top: 1, left: 0, right: 0, bottom: 0,
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      style: { fg: '#d4d4d8', bg: '#0f0f11' },
    });

    this.panels.push(panel);
    this.relayout();
    this.screen.render();
    return panel;
  }

  // ── Relayout all panels ──
  relayout() {
    const count = this.panels.length;
    if (count === 0) return;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const pw = Math.floor((this.screen.width - 2) / cols);
    const ph = Math.floor((this.screen.height - 4) / rows);

    this.panels.forEach((p, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      p.box.position.top = row * ph;
      p.box.position.left = col * pw;
      p.box.width = pw;
      p.box.height = ph;
    });
  }

  // ── Load file content into panel ──
  loadFile(panelId, filePath) {
    const panel = this.panels[panelId];
    if (!panel) return false;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      panel.content = content;
      panel.title = path.basename(filePath);
      panel.type = 'file';
      panel.source = filePath;
      panel.box.label = ` ${panel.title} `;
      panel.contentBox.setContent(content);
      panel.history.push({ time: Date.now(), action: 'load', file: filePath });
      this.screen.render();
      return true;
    } catch (e) { return false; }
  }

  // ── Run command and show output in panel ──
  runInPanel(panelId, command) {
    const panel = this.panels[panelId];
    if (!panel) return false;
    try {
      const output = execSync(command, { encoding: 'utf8', timeout: 30000, cwd: process.cwd() });
      panel.content = output;
      panel.title = `$ ${command.split(' ')[0]}`;
      panel.type = 'terminal';
      panel.source = command;
      panel.box.label = ` ${panel.title} `;
      panel.contentBox.setContent(output);
      panel.history.push({ time: Date.now(), action: 'run', command, output: output.substring(0, 200) });
      this.screen.render();
      return true;
    } catch (e) {
      panel.contentBox.setContent(`{red-fg}error: ${e.message}{/}`);
      this.screen.render();
      return false;
    }
  }

  // ── Watch a file/dir for changes ──
  watch(panelId, target) {
    const panel = this.panels[panelId];
    if (!panel) return false;
    panel.type = 'watch';
    panel.source = target;
    panel.title = `👁 ${path.basename(target)}`;
    panel.box.label = ` ${panel.title} `;

    // Initial read
    try {
      if (fs.statSync(target).isFile()) {
        panel.contentBox.setContent(fs.readFileSync(target, 'utf8'));
      } else {
        const files = fs.readdirSync(target).join('\n');
        panel.contentBox.setContent(files);
      }
    } catch (e) { panel.contentBox.setContent(`{red-fg}${e.message}{/}`); }

    panel.history.push({ time: Date.now(), action: 'watch', target });
    this.screen.render();
    return true;
  }

  // ── Paste text into panel (user drags content) ──
  paste(panelId, text) {
    const panel = this.panels[panelId];
    if (!panel) return false;
    panel.content = text;
    panel.contentBox.setContent(text);
    panel.history.push({ time: Date.now(), action: 'paste', preview: text.substring(0, 100) });
    if (this.onContentChange) this.onContentChange(panelId, text);
    this.screen.render();
    return true;
  }

  // ── Add text to panel (append) ──
  append(panelId, text) {
    const panel = this.panels[panelId];
    if (!panel) return false;
    panel.content += '\n' + text;
    panel.contentBox.setContent(panel.content);
    if (this.onContentChange) this.onContentChange(panelId, panel.content);
    this.screen.render();
    return true;
  }

  // ── Get all panel contents (for AI context) ──
  getAllContent() {
    return this.panels.map(p => ({
      id: p.id,
      title: p.title,
      type: p.type,
      source: p.source,
      content: p.content,
      lastAction: p.history[p.history.length - 1],
    }));
  }

  // ── Focus a panel ──
  focus(panelId) {
    this.panels.forEach((p, i) => {
      p.focused = i === panelId;
      p.box.border.fg = i === panelId ? '#818cf8' : '#27272a';
    });
    this.activePanel = panelId;
    this.screen.render();
  }

  // ── Close a panel ──
  close(panelId) {
    const panel = this.panels[panelId];
    if (!panel) return;
    panel.box.destroy();
    this.panels.splice(panelId, 1);
    this.relayout();
    this.screen.render();
  }

  // ── Export panel content ──
  exportPanel(panelId) {
    const panel = this.panels[panelId];
    if (!panel) return null;
    const exportDir = path.join(os.homedir(), '.pix', 'exports');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const file = path.join(exportDir, `panel-${panelId}-${Date.now()}.txt`);
    fs.writeFileSync(file, panel.content);
    return file;
  }

  // ── Toggle watch mode (AI observes all panels periodically) ──
  startWatching(interval = 5000, callback) {
    this.watching = true;
    this.onContentChange = callback;
    this.watchInterval = setInterval(() => {
      if (!this.watching) return;
      const changes = this.panels
        .filter(p => p.type === 'watch')
        .map(p => {
          try {
            if (p.type === 'watch' && fs.existsSync(p.source)) {
              const stat = fs.statSync(p.source);
              if (stat.isFile()) {
                const content = fs.readFileSync(p.source, 'utf8');
                if (content !== p.content) {
                  p.content = content;
                  p.contentBox.setContent(content);
                  return { panel: p.id, file: p.source, changed: true };
                }
              }
            }
          } catch (e) {}
          return null;
        })
        .filter(Boolean);

      if (changes.length > 0 && callback) {
        callback('changes', changes);
      }
      this.screen.render();
    }, interval);
  }

  stopWatching() {
    this.watching = false;
    if (this.watchInterval) clearInterval(this.watchInterval);
  }

  // ── Summary for AI ──
  getContextSummary() {
    const panels = this.getAllContent();
    if (panels.length === 0) return 'No panels open.';

    let summary = `Split screen: ${panels.length} panels\n`;
    panels.forEach(p => {
      summary += `\n[Panel ${p.id}: ${p.title}] (${p.type})\n`;
      summary += p.content.substring(0, 500) + (p.content.length > 500 ? '...' : '') + '\n';
    });
    return summary;
  }
}

module.exports = SplitScreen;
