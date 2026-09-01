/**
 * Pre-Snapshot — Pix AI
 * Backup before self-rewrite, rollback if needed
 * by Aghosh-mv · justcode
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

const SNAPSHOTS_DIR = path.join(os.homedir(), '.pix', 'snapshots');

class PreSnapshot {
  constructor() {
    if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }

  // ── Take snapshot before rewrite ──
  snapshot(label, files) {
    const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    const snapDir = path.join(SNAPSHOTS_DIR, id);
    fs.mkdirSync(snapDir, { recursive: true });

    const manifest = {
      id, label, timestamp: new Date().toISOString(),
      files: [], totalSize: 0,
    };

    files.forEach(f => {
      if (!fs.existsSync(f)) return;
      const content = fs.readFileSync(f);
      const compressed = zlib.gzipSync(content);
      const snapFile = path.join(snapDir, path.basename(f) + '.gz');
      fs.writeFileSync(snapFile, compressed);
      manifest.files.push({
        originalPath: f, snapFile: path.basename(f) + '.gz',
        originalSize: content.length, compressedSize: compressed.length,
      });
      manifest.totalSize += content.length;
    });

    fs.writeFileSync(path.join(snapDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Keep only last 20 snapshots
    this.cleanup();

    return { id, label, files: manifest.files.length, size: manifest.totalSize };
  }

  // ── Snapshot pix itself before rewrite ──
  snapshotPix(label) {
    const pixDir = path.join(__dirname, '..', '..');
    const files = [];
    const walk = (dir) => {
      fs.readdirSync(dir).forEach(f => {
        if (f === 'node_modules' || f === '.git' || f === 'snapshots') return;
        const fp = path.join(dir, f);
        if (fs.statSync(fp).isDirectory()) walk(fp);
        else if (f.endsWith('.js') || f.endsWith('.json')) files.push(fp);
      });
    };
    walk(pixDir);
    return this.snapshot(label || 'pre-rewrite', files);
  }

  // ── Restore from snapshot ──
  restore(snapId) {
    const snapDir = path.join(SNAPSHOTS_DIR, snapId);
    const manifestPath = path.join(snapDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return { ok: false, error: 'snapshot not found' };

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const restored = [];

    manifest.files.forEach(f => {
      try {
        const compressed = fs.readFileSync(path.join(snapDir, f.snapFile));
        const content = zlib.gunzipSync(compressed);
        const dir = path.dirname(f.originalPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(f.originalPath, content);
        restored.push(f.originalPath);
      } catch (e) {}
    });

    return { ok: true, restored: restored.length, files: restored };
  }

  // ── List snapshots ──
  list() {
    return fs.readdirSync(SNAPSHOTS_DIR).map(id => {
      const manifestPath = path.join(SNAPSHOTS_DIR, id, 'manifest.json');
      try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (e) { return null; }
    }).filter(Boolean).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // ── Get snapshot info ──
  info(snapId) {
    const manifestPath = path.join(SNAPSHOTS_DIR, snapId, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  // ── Delete snapshot ──
  delete(snapId) {
    const snapDir = path.join(SNAPSHOTS_DIR, snapId);
    if (fs.existsSync(snapDir)) fs.rmSync(snapDir, { recursive: true });
    return true;
  }

  // ── Keep only last N snapshots ──
  cleanup(keep = 20) {
    const snaps = this.list();
    if (snaps.length > keep) {
      snaps.slice(keep).forEach(s => this.delete(s.id));
    }
  }

  // ── Diff between two snapshots ──
  diff(snapId1, snapId2) {
    const s1 = this.info(snapId1);
    const s2 = this.info(snapId2);
    if (!s1 || !s2) return null;

    const files1 = new Set(s1.files.map(f => f.originalPath));
    const files2 = new Set(s2.files.map(f => f.originalPath));

    return {
      added: [...files2].filter(f => !files1.has(f)),
      removed: [...files1].filter(f => !files2.has(f)),
      modified: [...files1].filter(f => files2.has(f)),
    };
  }
}

module.exports = PreSnapshot;
