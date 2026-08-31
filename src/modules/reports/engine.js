const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ReportEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.reports = new Map();
    this.scheduled = new Map();
    this.templates = new Map();
    this.reportDir = path.join(os.homedir(), '.pix/reports');
  }

  async initialize() {
    this.logger.info('Initializing Report Engine...');
    await fs.ensureDir(this.reportDir);
    await this.loadReports();
    this.loadReportTemplates();
    this.logger.info('Report Engine initialized');
  }

  async loadReports() {
    try {
      const files = await fs.readdir(this.reportDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const report = await fs.readJson(path.join(this.reportDir, file));
          this.reports.set(report.id, report);
        }
      }
    } catch (e) {}
  }

  loadReportTemplates() {
    const templates = [
      {
        id: 'system-status',
        name: 'System Status Report',
        description: 'Overview of system health and performance',
        sections: [
          { title: 'System Overview', type: 'system-info' },
          { title: 'Active Processes', type: 'processes' },
          { title: 'Memory Usage', type: 'memory' },
          { title: 'Disk Usage', type: 'disk' }
        ]
      },
      {
        id: 'project-summary',
        name: 'Project Summary',
        description: 'Summary of project files and statistics',
        sections: [
          { title: 'Project Info', type: 'project-info' },
          { title: 'File Statistics', type: 'file-stats' },
          { title: 'Language Distribution', type: 'languages' },
          { title: 'Recent Changes', type: 'recent-changes' }
        ]
      },
      {
        id: 'ai-usage',
        name: 'AI Usage Report',
        description: 'Statistics on AI model usage',
        sections: [
          { title: 'Total Requests', type: 'ai-requests' },
          { title: 'Token Usage', type: 'tokens' },
          { title: 'Model Breakdown', type: 'model-breakdown' },
          { title: 'Cost Analysis', type: 'costs' }
        ]
      },
      {
        id: 'deployment-history',
        name: 'Deployment History',
        description: 'History of deployments and their status',
        sections: [
          { title: 'Recent Deployments', type: 'deployments' },
          { title: 'Success Rate', type: 'success-rate' },
          { title: 'Environment Status', type: 'env-status' }
        ]
      },
      {
        id: 'security-audit',
        name: 'Security Audit Report',
        description: 'Security audit and vulnerability scan results',
        sections: [
          { title: 'Security Score', type: 'security-score' },
          { title: 'Vulnerabilities Found', type: 'vulnerabilities' },
          { title: 'Audit Log', type: 'audit-log' },
          { title: 'Recommendations', type: 'recommendations' }
        ]
      },
      {
        id: 'performance-report',
        name: 'Performance Report',
        description: 'Application performance metrics',
        sections: [
          { title: 'Response Times', type: 'response-times' },
          { title: 'Error Rates', type: 'error-rates' },
          { title: 'Throughput', type: 'throughput' },
          { title: 'Resource Utilization', type: 'resource-util' }
        ]
      },
      {
        id: 'backup-report',
        name: 'Backup Report',
        description: 'Backup status and history',
        sections: [
          { title: 'Recent Backups', type: 'recent-backups' },
          { title: 'Storage Usage', type: 'storage-usage' },
          { title: 'Backup Schedules', type: 'schedules' }
        ]
      },
      {
        id: 'monitoring-report',
        name: 'Monitoring Report',
        description: 'System monitoring and uptime data',
        sections: [
          { title: 'Uptime Summary', type: 'uptime' },
          { title: 'Incidents', type: 'incidents' },
          { title: 'Alert History', type: 'alert-history' },
          { title: 'Check Results', type: 'check-results' }
        ]
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
      templateId = null,
      sections = [],
      data = {},
      format = 'json',
      scheduled = false,
      scheduleConfig = null
    } = params;

    const id = uuidv4();
    const report = {
      id,
      name,
      description,
      templateId,
      sections,
      data,
      format,
      status: 'pending',
      scheduled,
      scheduleConfig,
      createdAt: new Date().toISOString(),
      completedAt: null,
      result: null,
      error: null
    };

    if (templateId) {
      const template = this.templates.get(templateId);
      if (template) {
        report.sections = template.sections;
      }
    }

    this.reports.set(id, report);
    await this.saveReport(report);

    this.logger.info(`Report created: ${name}`);
    return report;
  }

  async generate(id) {
    const report = this.reports.get(id);
    if (!report) throw new Error(`Report not found: ${id}`);

    report.status = 'generating';
    await this.saveReport(report);

    try {
      const result = {
        title: report.name,
        description: report.description,
        generatedAt: new Date().toISOString(),
        sections: []
      };

      for (const section of report.sections) {
        const sectionData = await this.generateSection(section, report.data);
        result.sections.push({
          title: section.title,
          content: sectionData
        });
      }

      report.status = 'completed';
      report.result = result;
      report.completedAt = new Date().toISOString();

      await this.saveReport(report);
      await this.exportReport(id);

      this.logger.info(`Report generated: ${report.name}`);
      return report;
    } catch (error) {
      report.status = 'failed';
      report.error = error.message;
      await this.saveReport(report);

      throw error;
    }
  }

  async generateSection(section, data) {
    switch (section.type) {
      case 'system-info':
        return {
          platform: process.platform,
          nodeVersion: process.version,
          uptime: process.uptime(),
          memory: process.memoryUsage()
        };

      case 'processes':
        return { count: 1, main: process.title };

      case 'memory':
        const mem = process.memoryUsage();
        return {
          rss: this.formatSize(mem.rss),
          heapUsed: this.formatSize(mem.heapUsed),
          heapTotal: this.formatSize(mem.heapTotal),
          external: this.formatSize(mem.external)
        };

      case 'disk':
        return { note: 'Disk usage information' };

      case 'file-stats':
        return data.fileStats || { total: 0, byType: {} };

      case 'languages':
        return data.languages || {};

      case 'ai-requests':
        return data.aiRequests || { total: 0 };

      case 'tokens':
        return data.tokens || { used: 0, limit: 0 };

      case 'deployments':
        return data.deployments || [];

      case 'security-score':
        return data.securityScore || { score: 0 };

      case 'vulnerabilities':
        return data.vulnerabilities || [];

      case 'audit-log':
        return data.auditLog || [];

      case 'recent-backups':
        return data.backups || [];

      case 'uptime':
        return data.uptime || { percentage: 100 };

      case 'incidents':
        return data.incidents || [];

      default:
        return data[section.type] || {};
    }
  }

  async exportReport(id) {
    const report = this.reports.get(id);
    if (!report || !report.result) return;

    const filename = `${report.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

    if (report.format === 'json') {
      const filepath = path.join(this.reportDir, `${filename}.json`);
      await fs.writeJson(filepath, report.result, { spaces: 2 });
      report.exportPath = filepath;
    } else if (report.format === 'html') {
      const filepath = path.join(this.reportDir, `${filename}.html`);
      const html = this.generateHTML(report.result);
      await fs.writeFile(filepath, html);
      report.exportPath = filepath;
    } else if (report.format === 'markdown') {
      const filepath = path.join(this.reportDir, `${filename}.md`);
      const md = this.generateMarkdown(report.result);
      await fs.writeFile(filepath, md);
      report.exportPath = filepath;
    }

    await this.saveReport(report);
    return report.exportPath;
  }

  generateHTML(report) {
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>${report.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    h2 { color: #666; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .section { margin-bottom: 30px; }
    .data { background: #f5f5f5; padding: 15px; border-radius: 8px; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  <p>${report.description}</p>
  <p>Generated: ${report.generatedAt}</p>
`;

    for (const section of report.sections) {
      html += `
  <div class="section">
    <h2>${section.title}</h2>
    <div class="data">
      <pre>${JSON.stringify(section.content, null, 2)}</pre>
    </div>
  </div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  generateMarkdown(report) {
    let md = `# ${report.title}\n\n`;
    md += `${report.description}\n\n`;
    md += `Generated: ${report.generatedAt}\n\n---\n\n`;

    for (const section of report.sections) {
      md += `## ${section.title}\n\n`;
      md += '```json\n';
      md += JSON.stringify(section.content, null, 2);
      md += '\n```\n\n';
    }

    return md;
  }

  async schedule(params) {
    const { reportId, frequency = 'daily', time = '09:00', enabled = true } = params;
    const id = uuidv4();

    const schedule = {
      id,
      reportId,
      frequency,
      time,
      enabled,
      lastRun: null,
      nextRun: this.calculateNextRun(frequency, time),
      createdAt: new Date().toISOString()
    };

    this.scheduled.set(id, schedule);
    return schedule;
  }

  calculateNextRun(frequency, time) {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
      switch (frequency) {
        case 'hourly':
          next.setHours(next.getHours() + 1);
          break;
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + 7);
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          break;
      }
    }

    return next.toISOString();
  }

  list(options = {}) {
    const { limit = 50 } = options;
    return Array.from(this.reports.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  get(id) {
    return this.reports.get(id);
  }

  async delete(id) {
    const report = this.reports.get(id);
    if (report?.exportPath) {
      await fs.remove(report.exportPath).catch(() => {});
    }
    this.reports.delete(id);
    await fs.remove(path.join(this.reportDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  getTemplates() {
    return Array.from(this.templates.values());
  }

  getTemplate(id) {
    return this.templates.get(id);
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async saveReport(report) {
    const filePath = path.join(this.reportDir, `${report.id}.json`);
    await fs.writeJson(filePath, report, { spaces: 2 });
  }
}

module.exports = ReportEngine;
