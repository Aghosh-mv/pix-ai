const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CodeReviewAgent {
  constructor(projectRoot) {
    this.root = projectRoot;
    this.reviewDir = path.join(projectRoot, '.pix', 'reviews');
    if (!fs.existsSync(this.reviewDir)) fs.mkdirSync(this.reviewDir, { recursive: true });
  }

  reviewFile(filePath) {
    const fullPath = path.resolve(this.root, filePath);
    if (!fs.existsSync(fullPath)) return { error: 'File not found' };

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const ext = path.extname(filePath);
    const issues = [];

    lines.forEach((line, i) => {
      const lineNum = i + 1;
      if (line.length > 120) issues.push({ line: lineNum, severity: 'warning', type: 'style', msg: `Line too long (${line.length} > 120)` });
      if (line.includes('TODO')) issues.push({ line: lineNum, severity: 'info', type: 'todo', msg: 'TODO found' });
      if (line.includes('FIXME')) issues.push({ line: lineNum, severity: 'warning', type: 'fixme', msg: 'FIXME found' });
      if (line.includes('HACK')) issues.push({ line: lineNum, severity: 'warning', type: 'hack', msg: 'HACK found' });
      if (line.match(/\bvar\b/) && (ext === '.js' || ext === '.ts')) issues.push({ line: lineNum, severity: 'info', type: 'modern', msg: 'Use let/const instead of var' });
      if (line.match(/console\.log/) && ext === '.js') issues.push({ line: lineNum, severity: 'info', type: 'cleanup', msg: 'Console.log in production code' });
      if (line.match(/eval\(/)) issues.push({ line: lineNum, severity: 'error', type: 'security', msg: 'eval() is a security risk' });
      if (line.match(/password|secret|api.?key/i) && line.match(/=.+['"]/)) issues.push({ line: lineNum, severity: 'error', type: 'security', msg: 'Possible hardcoded secret' });
      if (line.match(/==(?!=)/) && !line.match(/===/)) issues.push({ line: lineNum, severity: 'info', type: 'style', msg: 'Use === instead of ==' });
    });

    const functions = content.match(/(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g) || [];
    const classes = content.match(/class\s+\w+/g) || [];
    const imports = content.match(/(?:import|require)\s*\(?['"](.*?)['"]\)?/g) || [];

    const review = {
      file: filePath,
      timestamp: new Date().toISOString(),
      stats: { lines: lines.length, functions: functions.length, classes: classes.length, imports: imports.length },
      issues,
      score: Math.max(0, 100 - issues.filter(i => i.severity === 'error').length * 15 - issues.filter(i => i.severity === 'warning').length * 5 - issues.filter(i => i.severity === 'info').length * 1),
      summary: {
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length
      }
    };

    this.saveReview(review);
    return review;
  }

  reviewDirectory(dirPath) {
    const dir = path.resolve(this.root, dirPath || '.');
    const files = [];
    const walk = (d) => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      entries.forEach(e => {
        const full = path.join(d, e.name);
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') walk(full);
        else if (e.isFile() && /\.(js|jsx|ts|tsx|py|go|rs|java|rb|php|css|html|json|yaml|yml|md)$/.test(e.name)) {
          files.push(full.replace(this.root + '/', ''));
        }
      });
    };
    walk(dir);

    const reviews = files.map(f => this.reviewFile(f));
    const totalIssues = reviews.reduce((sum, r) => sum + (r.issues ? r.issues.length : 0), 0);
    const avgScore = reviews.length > 0 ? Math.round(reviews.reduce((sum, r) => sum + (r.score || 0), 0) / reviews.length) : 0;

    return { files: reviews.length, totalIssues, averageScore: avgScore, reviews };
  }

  reviewPR() {
    try {
      const diff = execSync('git diff --cached --name-only', { cwd: this.root, encoding: 'utf8' }).trim();
      if (!diff) return { error: 'No staged changes' };
      const files = diff.split('\n').filter(Boolean);
      const reviews = files.map(f => this.reviewFile(f));
      return { files: reviews.length, reviews };
    } catch (e) { return { error: e.message }; }
  }

  saveReview(review) {
    const file = path.join(this.reviewDir, `${Date.now()}-review.json`);
    fs.writeFileSync(file, JSON.stringify(review, null, 2));
  }

  getReviewHistory() {
    const files = fs.readdirSync(this.reviewDir).filter(f => f.endsWith('-review.json'));
    return files.map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(this.reviewDir, f), 'utf8')); } catch (e) { return null; }
    }).filter(Boolean);
  }
}

module.exports = CodeReviewAgent;
