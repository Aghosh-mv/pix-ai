const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class DataVisualizationEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.charts = new Map();
    this.dashboards = new Map();
    this.dataSources = new Map();
    this.vizDir = path.join(os.homedir(), '.pix/visualizations');
  }

  async initialize() {
    this.logger.info('Initializing Data Visualization Engine...');
    await fs.ensureDir(this.vizDir);
    await this.loadVisualizations();
    this.loadChartTypes();
    this.loadColorSchemes();
    this.logger.info('Data Visualization Engine initialized');
  }

  async loadVisualizations() {
    try {
      const files = await fs.readdir(this.vizDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.vizDir, file));
          if (data.type === 'chart') this.charts.set(data.id, data);
          else if (data.type === 'dashboard') this.dashboards.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadChartTypes() {
    this.chartTypes = [
      { id: 'bar', name: 'Bar Chart', icon: '📊', description: 'Compare values across categories' },
      { id: 'line', name: 'Line Chart', icon: '📈', description: 'Show trends over time' },
      { id: 'pie', name: 'Pie Chart', icon: '🥧', description: 'Show proportions of a whole' },
      { id: 'doughnut', name: 'Doughnut Chart', icon: '🍩', description: 'Similar to pie but with a hole' },
      { id: 'area', name: 'Area Chart', icon: '📉', description: 'Show cumulative totals' },
      { id: 'scatter', name: 'Scatter Plot', icon: '⚬', description: 'Show relationships between variables' },
      { id: 'bubble', name: 'Bubble Chart', icon: '🫧', description: 'Scatter plot with variable bubble sizes' },
      { id: 'radar', name: 'Radar Chart', icon: '🕸️', description: 'Compare multiple variables' },
      { id: 'polar', name: 'Polar Chart', icon: '🎯', description: 'Circular bar chart' },
      { id: 'treemap', name: 'Treemap', icon: '🗺️', description: 'Hierarchical data visualization' },
      { id: 'heatmap', name: 'Heatmap', icon: '🌡️', description: 'Show intensity with colors' },
      { id: 'gauge', name: 'Gauge', icon: '⏱️', description: 'Show progress toward a goal' },
      { id: 'funnel', name: 'Funnel', icon: '🔽', description: 'Show progressive reduction' },
      { id: 'waterfall', name: 'Waterfall', icon: '💧', description: 'Show cumulative effect' },
      { id: 'boxplot', name: 'Box Plot', icon: '📦', description: 'Show distribution statistics' }
    ];
  }

  loadColorSchemes() {
    this.colorSchemes = [
      { id: 'default', name: 'Default', colors: ['#4285F4', '#EA4335', '#FBBC05', '#34A853'] },
      { id: 'pastel', name: 'Pastel', colors: ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA'] },
      { id: 'vibrant', name: 'Vibrant', colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'] },
      { id: 'monochrome', name: 'Monochrome', colors: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6'] },
      { id: 'neon', name: 'Neon', colors: ['#FF00FF', '#00FFFF', '#FF00AA', '#00FF00'] },
      { id: 'earth', name: 'Earth', colors: ['#8B4513', '#228B22', '#DAA520', '#4682B4'] }
    ];
  }

  async createChart(params) {
    const {
      title,
      type = 'bar',
      dataSource = null,
      data = null,
      colorScheme = 'default',
      options = {},
      width = 600,
      height = 400,
      tags = []
    } = params;

    const id = uuidv4();
    const chart = {
      id,
      title,
      type,
      dataSource,
      data: data || this.getSampleData(type),
      colorScheme,
      options,
      width,
      height,
      tags,
      refreshInterval: null,
      lastRefreshed: null,
      type: 'chart',
      createdAt: new Date().toISOString()
    };

    this.charts.set(id, chart);
    return chart;
  }

  async updateChart(id, updates) {
    const chart = this.charts.get(id);
    if (!chart) throw new Error(`Chart not found: ${id}`);

    const updated = { ...chart, ...updates };
    this.charts.set(id, updated);
    return updated;
  }

  async deleteChart(id) {
    this.charts.delete(id);
    return { success: true };
  }

  async getChart(id) {
    return this.charts.get(id);
  }

  listCharts(options = {}) {
    const { type, tags, search } = options;
    let charts = Array.from(this.charts.values());

    if (type) charts = charts.filter(c => c.type === type);
    if (tags && tags.length > 0) {
      charts = charts.filter(c => tags.some(t => c.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      charts = charts.filter(c => c.title.toLowerCase().includes(searchLower));
    }

    return charts;
  }

  async createDashboard(params) {
    const {
      name,
      description = '',
      layout = 'grid',
      chartIds = [],
      refreshInterval = null
    } = params;

    const id = uuidv4();
    const dashboard = {
      id,
      name,
      description,
      layout,
      chartIds,
      refreshInterval,
      lastRefreshed: null,
      type: 'dashboard',
      createdAt: new Date().toISOString()
    };

    this.dashboards.set(id, dashboard);
    return dashboard;
  }

  async updateDashboard(id, updates) {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) throw new Error(`Dashboard not found: ${id}`);

    const updated = { ...dashboard, ...updates };
    this.dashboards.set(id, updated);
    return updated;
  }

  async deleteDashboard(id) {
    this.dashboards.delete(id);
    return { success: true };
  }

  async getDashboard(id) {
    return this.dashboards.get(id);
  }

  async addChartToDashboard(dashboardId, chartId) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error(`Dashboard not found: ${dashboardId}`);

    if (!dashboard.chartIds.includes(chartId)) {
      dashboard.chartIds.push(chartId);
    }

    return dashboard;
  }

  async removeChartFromDashboard(dashboardId, chartId) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) throw new Error(`Dashboard not found: ${dashboardId}`);

    dashboard.chartIds = dashboard.chartIds.filter(id => id !== chartId);
    return dashboard;
  }

  listDashboards() {
    return Array.from(this.dashboards.values());
  }

  getSampleData(type) {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const values = labels.map(() => Math.floor(Math.random() * 100));

    return {
      labels,
      datasets: [{
        label: 'Sample Data',
        data: values,
        backgroundColor: 'rgba(66, 133, 244, 0.5)',
        borderColor: 'rgba(66, 133, 244, 1)',
        borderWidth: 1
      }]
    };
  }

  getChartTypes() {
    return this.chartTypes;
  }

  getColorSchemes() {
    return this.colorSchemes;
  }

  async getStats() {
    return {
      charts: this.charts.size,
      dashboards: this.dashboards.size,
      chartTypes: this.chartTypes.length,
      colorSchemes: this.colorSchemes.length
    };
  }

  async exportVisualization(format = 'json') {
    const data = {
      charts: Array.from(this.charts.values()),
      dashboards: Array.from(this.dashboards.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = DataVisualizationEngine;
