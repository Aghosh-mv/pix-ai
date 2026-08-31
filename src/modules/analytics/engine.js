const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class AnalyticsEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.events = new Map();
    this.sessions = new Map();
    this.reports = new Map();
    this.funnels = new Map();
    this.cohorts = new Map();
    this.analyticsDir = path.join(os.homedir(), '.pix/analytics');
  }

  async initialize() {
    this.logger.info('Initializing Analytics Engine...');
    await fs.ensureDir(this.analyticsDir);
    await this.loadEvents();
    this.logger.info('Analytics Engine initialized');
  }

  async loadEvents() {
    try {
      const files = await fs.readdir(this.analyticsDir);
      for (const file of files) {
        if (file.startsWith('events-') && file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.analyticsDir, file));
          const date = file.replace('events-', '').replace('.json', '');
          this.events.set(date, data);
        }
      }
    } catch (e) {}
  }

  async track(params) {
    const {
      event,
      properties = {},
      userId = null,
      sessionId = null,
      timestamp = new Date().toISOString()
    } = params;

    const date = timestamp.split('T')[0];
    const eventId = uuidv4();

    const eventRecord = {
      id: eventId,
      event,
      properties,
      userId,
      sessionId,
      timestamp,
      metadata: {
        platform: process.platform,
        nodeVersion: process.version
      }
    };

    if (!this.events.has(date)) {
      this.events.set(date, []);
    }

    this.events.get(date).push(eventRecord);

    if (sessionId) {
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, {
          id: sessionId,
          userId,
          events: [],
          startedAt: timestamp,
          lastActivity: timestamp
        });
      }
      const session = this.sessions.get(sessionId);
      session.events.push(eventRecord);
      session.lastActivity = timestamp;
    }

    this.logger.debug(`Event tracked: ${event}`);
    return eventRecord;
  }

  async query(params) {
    const {
      event,
      startDate,
      endDate,
      userId = null,
      properties = {},
      limit = 1000
    } = params;

    const results = [];
    const start = new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = new Date(endDate || Date.now());

    for (const [date, events] of this.events) {
      const eventDate = new Date(date);
      if (eventDate < start || eventDate > end) continue;

      for (const e of events) {
        if (event && e.event !== event) continue;
        if (userId && e.userId !== userId) continue;

        let matchesProperties = true;
        for (const [key, value] of Object.entries(properties)) {
          if (e.properties[key] !== value) {
            matchesProperties = false;
            break;
          }
        }

        if (matchesProperties) {
          results.push(e);
        }

        if (results.length >= limit) break;
      }

      if (results.length >= limit) break;
    }

    return results;
  }

  async aggregate(params) {
    const {
      event,
      metric,
      groupBy = null,
      startDate,
      endDate
    } = params;

    const events = await this.query({ event, startDate, endDate });

    const aggregated = {};

    if (groupBy) {
      for (const e of events) {
        const group = e.properties[groupBy] || 'unknown';
        if (!aggregated[group]) {
          aggregated[group] = { count: 0, sum: 0, values: [] };
        }
        aggregated[group].count++;
        if (metric && e.properties[metric] !== undefined) {
          aggregated[group].values.push(e.properties[metric]);
          aggregated[group].sum += e.properties[metric];
        }
      }

      for (const group of Object.keys(aggregated)) {
        const values = aggregated[group].values;
        aggregated[group].avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        aggregated[group].min = values.length > 0 ? Math.min(...values) : 0;
        aggregated[group].max = values.length > 0 ? Math.max(...values) : 0;
        delete aggregated[group].values;
      }
    } else {
      aggregated.total = {
        count: events.length,
        sum: 0,
        values: []
      };

      for (const e of events) {
        if (metric && e.properties[metric] !== undefined) {
          aggregated.total.values.push(e.properties[metric]);
          aggregated.total.sum += e.properties[metric];
        }
      }

      const values = aggregated.total.values;
      aggregated.total.avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      aggregated.total.min = values.length > 0 ? Math.min(...values) : 0;
      aggregated.total.max = values.length > 0 ? Math.max(...values) : 0;
      delete aggregated.total.values;
    }

    return aggregated;
  }

  async createFunnel(params) {
    const { name, steps, description = '' } = params;
    const id = uuidv4();

    const funnel = {
      id,
      name,
      description,
      steps,
      createdAt: new Date().toISOString()
    };

    this.funnels.set(id, funnel);
    return funnel;
  }

  async analyzeFunnel(id, options = {}) {
    const funnel = this.funnels.get(id);
    if (!funnel) throw new Error(`Funnel not found: ${id}`);

    const { startDate, endDate, userId = null } = options;

    const stepResults = [];
    let previousCount = null;

    for (const step of funnel.steps) {
      const events = await this.query({
        event: step.event,
        startDate,
        endDate,
        userId
      });

      const count = events.length;
      const conversionRate = previousCount !== null && previousCount > 0
        ? (count / previousCount) * 100
        : 100;

      stepResults.push({
        event: step.event,
        count,
        conversionRate
      });

      previousCount = count;
    }

    return {
      funnel: funnel.name,
      steps: stepResults,
      overallConversion: stepResults.length > 0
        ? (stepResults[stepResults.length - 1].count / (stepResults[0].count || 1)) * 100
        : 0
    };
  }

  async createCohort(params) {
    const { name, description = '', criteria = {} } = params;
    const id = uuidv4();

    const cohort = {
      id,
      name,
      description,
      criteria,
      createdAt: new Date().toISOString()
    };

    this.cohorts.set(id, cohort);
    return cohort;
  }

  async getCohortUsers(id) {
    const cohort = this.cohorts.get(id);
    if (!cohort) throw new Error(`Cohort not found: ${id}`);

    const userIds = new Set();

    for (const [, events] of this.events) {
      for (const event of events) {
        if (this.matchesCriteria(event, cohort.criteria)) {
          if (event.userId) userIds.add(event.userId);
        }
      }
    }

    return Array.from(userIds);
  }

  matchesCriteria(event, criteria) {
    for (const [key, value] of Object.entries(criteria)) {
      if (event.properties[key] !== value && event[key] !== value) {
        return false;
      }
    }
    return true;
  }

  async getSession(id) {
    return this.sessions.get(id);
  }

  async getSessionDuration(id) {
    const session = this.sessions.get(id);
    if (!session) return 0;

    return new Date(session.lastActivity) - new Date(session.startedAt);
  }

  async getTopEvents(options = {}) {
    const { startDate, endDate, limit = 10 } = options;
    const eventCounts = {};

    for (const [date, events] of this.events) {
      const eventDate = new Date(date);
      if (startDate && eventDate < new Date(startDate)) continue;
      if (endDate && eventDate > new Date(endDate)) continue;

      for (const event of events) {
        eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
      }
    }

    return Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([event, count]) => ({ event, count }));
  }

  async getTimeSeries(params) {
    const { event, interval = 'day', startDate, endDate } = params;
    const series = {};

    const start = new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = new Date(endDate || Date.now());

    for (const [date, events] of this.events) {
      const eventDate = new Date(date);
      if (eventDate < start || eventDate > end) continue;

      const filteredEvents = event
        ? events.filter(e => e.event === event)
        : events;

      if (filteredEvents.length > 0) {
        series[date] = filteredEvents.length;
      }
    }

    return series;
  }

  async generateReport(params) {
    const { name, startDate, endDate, metrics = [] } = params;
    const id = uuidv4();

    const report = {
      id,
      name,
      startDate,
      endDate,
      metrics,
      data: {},
      generatedAt: new Date().toISOString()
    };

    for (const metric of metrics) {
      const events = await this.query({
        event: metric.event,
        startDate,
        endDate
      });

      report.data[metric.name || metric.event] = {
        count: events.length,
        uniqueUsers: new Set(events.filter(e => e.userId).map(e => e.userId)).size
      };
    }

    this.reports.set(id, report);
    return report;
  }

  async getReport(id) {
    return this.reports.get(id);
  }

  async getDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = this.events.get(today) || [];

    const eventCounts = {};
    for (const event of todayEvents) {
      eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
    }

    return {
      todayEvents: todayEvents.length,
      activeSessions: this.sessions.size,
      topEvents: Object.entries(eventCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([event, count]) => ({ event, count })),
      totalEvents: Array.from(this.events.values()).reduce((sum, events) => sum + events.length, 0)
    };
  }

  async exportData(params) {
    const { startDate, endDate, format = 'json' } = params;
    const events = await this.query({ startDate, endDate, limit: 100000 });

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    }

    if (format === 'csv') {
      const headers = ['id', 'event', 'userId', 'timestamp'];
      const rows = events.map(e => [
        e.id,
        e.event,
        e.userId || '',
        e.timestamp
      ]);

      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    return events;
  }
}

module.exports = AnalyticsEngine;
