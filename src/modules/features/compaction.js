/**
 * Compaction Engine — Pix AI
 * 
 * Saves ALL details (tiny + large) to compressed files.
 * Auto-compacts when context exceeds threshold.
 * Restores full context on demand.
 * 
 * by Aghosh-mv · justcode
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class CompactionEngine {
  constructor(pixHome) {
    this.pixHome = pixHome || path.join(os.homedir(), '.pix');
    this.compactionsDir = path.join(this.pixHome, 'compactions');
    this.metaFile = path.join(this.pixHome, 'compaction-meta.json');
    this.autoThreshold = 50; // auto-compact after 50 messages
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(this.compactionsDir)) {
      fs.mkdirSync(this.compactionsDir, { recursive: true });
    }
  }

  // ── Load / Save Meta ──
  loadMeta() {
    try {
      return JSON.parse(fs.readFileSync(this.metaFile, 'utf8'));
    } catch (e) {
      return { sessions: [], totalCompactions: 0, totalSaved: 0 };
    }
  }

  saveMeta(meta) {
    fs.writeFileSync(this.metaFile, JSON.stringify(meta, null, 2));
  }

  // ── Compact a session ──
  compact(sessionId, messages, context = {}) {
    const id = sessionId || crypto.randomBytes(6).toString('hex');
    const timestamp = new Date().toISOString();

    // Build the compaction payload — EVERYTHING is saved
    const payload = {
      id,
      timestamp,
      messageCount: messages.length,
      messages: messages.map((m, i) => ({
        index: i,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || m.time || null,
        tokens: m.tokens || null,
        provider: m.provider || null,
        model: m.model || null,
      })),
      context: {
        cwd: context.cwd || process.cwd(),
        gitBranch: context.gitBranch || null,
        gitStatus: context.gitStatus || null,
        filesOpened: context.filesOpened || [],
        filesModified: context.filesModified || [],
        commandsRun: context.commandsRun || [],
        errors: context.errors || [],
        decisions: context.decisions || [],
        // Save EVERY tiny detail
        env: {
          node: process.version,
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          hostname: os.hostname(),
          user: os.userInfo().username,
        },
        session: context.session || {},
        // Save all file snapshots
        fileSnapshots: context.fileSnapshots || {},
        // Save all thoughts/notes
        notes: context.notes || [],
        // Save all tool outputs
        toolOutputs: context.toolOutputs || [],
        // Save all intermediate results
        intermediateResults: context.intermediateResults || [],
      },
      stats: {
        totalChars: messages.reduce((s, m) => s + (m.content?.length || 0), 0),
        avgMsgLength: Math.round(messages.reduce((s, m) => s + (m.content?.length || 0), 0) / messages.length),
        roleCounts: messages.reduce((acc, m) => { acc[m.role] = (acc[m.role] || 0) + 1; return acc; }, {}),
      }
    };

    // Compress with gzip-like compression (store as minified JSON + optional LZ)
    const jsonStr = JSON.stringify(payload);
    const compressed = this.compress(jsonStr);
    const filePath = path.join(this.compactionsDir, `${id}.json`);

    fs.writeFileSync(filePath, compressed);

    // Update meta
    const meta = this.loadMeta();
    meta.sessions.push({
      id,
      timestamp,
      messageCount: messages.length,
      compressedSize: Buffer.byteLength(compressed),
      originalSize: Buffer.byteLength(jsonStr),
      ratio: Math.round((1 - Buffer.byteLength(compressed) / Buffer.byteLength(jsonStr)) * 100),
    });
    meta.totalCompactions++;
    meta.totalSaved += Buffer.byteLength(jsonStr) - Buffer.byteLength(compressed);
    this.saveMeta(meta);

    return {
      id,
      filePath,
      compressed: Buffer.byteLength(compressed),
      original: Buffer.byteLength(jsonStr),
      ratio: Math.round((1 - Buffer.byteLength(compressed) / Buffer.byteLength(jsonStr)) * 100),
    };
  }

  // ── Restore a compaction ──
  restore(id) {
    const filePath = path.join(this.compactionsDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;

    const compressed = fs.readFileSync(filePath, 'utf8');
    const jsonStr = this.decompress(compressed);
    return JSON.parse(jsonStr);
  }

  // ── Auto-compact check ──
  shouldAutoCompact(messageCount) {
    return messageCount >= this.autoThreshold;
  }

  // ── List all compactions ──
  list() {
    return this.loadMeta().sessions;
  }

  // ── Delete a compaction ──
  delete(id) {
    const filePath = path.join(this.compactionsDir, `${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const meta = this.loadMeta();
    meta.sessions = meta.sessions.filter(s => s.id !== id);
    this.saveMeta(meta);
    return true;
  }

  // ── Stats ──
  stats() {
    const meta = this.loadMeta();
    return {
      totalCompactions: meta.totalCompactions,
      totalSessions: meta.sessions.length,
      totalSaved: meta.totalSaved,
      totalSavedFormatted: this.formatBytes(meta.totalSaved),
      avgRatio: meta.sessions.length > 0
        ? Math.round(meta.sessions.reduce((s, x) => s + x.ratio, 0) / meta.sessions.length)
        : 0,
      sessions: meta.sessions,
    };
  }

  // ── Save a file snapshot ──
  saveFileSnapshot(sessionId, filePath, content) {
    const compaction = this.restore(sessionId);
    if (!compaction) return false;

    compaction.context.fileSnapshots[filePath] = {
      content,
      timestamp: new Date().toISOString(),
      size: Buffer.byteLength(content),
    };

    const compressed = this.compress(JSON.stringify(compaction));
    const savePath = path.join(this.compactionsDir, `${sessionId}.json`);
    fs.writeFileSync(savePath, compressed);
    return true;
  }

  // ── Add a note ──
  addNote(sessionId, note) {
    const compaction = this.restore(sessionId);
    if (!compaction) return false;

    compaction.context.notes.push({
      content: note,
      timestamp: new Date().toISOString(),
    });

    const compressed = this.compress(JSON.stringify(compaction));
    const savePath = path.join(this.compactionsDir, `${sessionId}.json`);
    fs.writeFileSync(savePath, compressed);
    return true;
  }

  // ── Add tool output ──
  addToolOutput(sessionId, tool, input, output) {
    const compaction = this.restore(sessionId);
    if (!compaction) return false;

    compaction.context.toolOutputs.push({
      tool,
      input,
      output,
      timestamp: new Date().toISOString(),
    });

    const compressed = this.compress(JSON.stringify(compaction));
    const savePath = path.join(this.compactionsDir, `${sessionId}.json`);
    fs.writeFileSync(savePath, compressed);
    return true;
  }

  // ── Search compactions ──
  search(query) {
    const results = [];
    for (const session of this.loadMeta().sessions) {
      const data = this.restore(session.id);
      if (!data) continue;

      // Search messages
      for (const msg of data.messages) {
        if (msg.content?.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            sessionId: session.id,
            role: msg.role,
            content: msg.content.substring(0, 200),
            timestamp: msg.timestamp,
          });
        }
      }

      // Search notes
      for (const note of data.context.notes || []) {
        if (note.content?.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            sessionId: session.id,
            type: 'note',
            content: note.content.substring(0, 200),
            timestamp: note.timestamp,
          });
        }
      }

      // Search file snapshots
      for (const [file, snap] of Object.entries(data.context.fileSnapshots || {})) {
        if (snap.content?.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            sessionId: session.id,
            type: 'file',
            file,
            content: snap.content.substring(0, 200),
            timestamp: snap.timestamp,
          });
        }
      }
    }
    return results;
  }

  // ── Export compaction as readable text ──
  exportAsText(id) {
    const data = this.restore(id);
    if (!data) return null;

    let text = `Compaction: ${data.id}\n`;
    text += `Timestamp: ${data.timestamp}\n`;
    text += `Messages: ${data.messageCount}\n`;
    text += `Context CWD: ${data.context.cwd}\n`;
    text += `\n${'═'.repeat(60)}\n\n`;

    for (const msg of data.messages) {
      const role = msg.role === 'user' ? '❯' : 'pix';
      text += `[${msg.timestamp || 'unknown'}] ${role}\n${msg.content}\n\n`;
    }

    if (data.context.notes?.length > 0) {
      text += `\n${'─'.repeat(60)}\nNOTES\n${'─'.repeat(60)}\n\n`;
      data.context.notes.forEach(n => {
        text += `[${n.timestamp}] ${n.content}\n`;
      });
    }

    if (data.context.commandsRun?.length > 0) {
      text += `\n${'─'.repeat(60)}\nCOMMANDS\n${'─'.repeat(60)}\n\n`;
      data.context.commandsRun.forEach(c => {
        text += `$ ${c.command} → ${c.exitCode || 0}\n`;
      });
    }

    return text;
  }

  // ── Compress / Decompress (zlib) ──
  compress(str) {
    try {
      const zlib = require('zlib');
      return zlib.gzipSync(Buffer.from(str, 'utf8')).toString('base64');
    } catch (e) {
      return str;
    }
  }

  decompress(str) {
    try {
      const zlib = require('zlib');
      return zlib.gunzipSync(Buffer.from(str, 'base64')).toString('utf8');
    } catch (e) {
      return str;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0B';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < u.length - 1) { bytes /= 1024; i++; }
    return bytes.toFixed(1) + u[i];
  }
}

module.exports = CompactionEngine;
