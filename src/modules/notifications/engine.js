const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

class NotificationEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.notifications = new Map();
    this.channels = new Map();
    this.templates = new Map();
    this.eventEmitter = new EventEmitter();
    this.notificationDir = path.join(os.homedir(), '.pix/notifications');
    this.notificationsFile = path.join(this.notificationDir, 'notifications.json');
  }

  async initialize() {
    this.logger.info('Initializing Notification Engine...');
    await fs.ensureDir(this.notificationDir);
    await this.loadNotifications();
    this.loadDefaultChannels();
    this.loadDefaultTemplates();
    this.logger.info('Notification Engine initialized');
  }

  async loadNotifications() {
    try {
      if (await fs.pathExists(this.notificationsFile)) {
        const data = await fs.readJson(this.notificationsFile);
        this.notifications = new Map(Object.entries(data));
      }
    } catch (e) {
      this.notifications = new Map();
    }
  }

  loadDefaultChannels() {
    const channels = [
      { id: 'system', name: 'System', type: 'system', enabled: true },
      { id: 'console', name: 'Console', type: 'console', enabled: true },
      { id: 'file', name: 'File Log', type: 'file', config: { path: 'notifications.log' }, enabled: true }
    ];

    channels.forEach(channel => {
      this.channels.set(channel.id, channel);
    });
  }

  loadDefaultTemplates() {
    const templates = [
      {
        id: 'default',
        name: 'Default',
        title: '{{title}}',
        body: '{{message}}',
        icon: '🔔'
      },
      {
        id: 'success',
        name: 'Success',
        title: '✅ {{title}}',
        body: '{{message}}',
        icon: '✅'
      },
      {
        id: 'warning',
        name: 'Warning',
        title: '⚠️ {{title}}',
        body: '{{message}}',
        icon: '⚠️'
      },
      {
        id: 'error',
        name: 'Error',
        title: '❌ {{title}}',
        body: '{{message}}',
        icon: '❌'
      },
      {
        id: 'info',
        name: 'Info',
        title: 'ℹ️ {{title}}',
        body: '{{message}}',
        icon: 'ℹ️'
      },
      {
        id: 'deployment',
        name: 'Deployment',
        title: '🚀 Deployment Update',
        body: '{{message}}',
        icon: '🚀'
      },
      {
        id: 'alert',
        name: 'Alert',
        title: '🚨 Alert: {{title}}',
        body: '{{message}}',
        icon: '🚨'
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  async send(params) {
    const {
      title,
      message,
      body,
      type = 'default',
      priority = 'normal',
      channels = ['system', 'console'],
      data = {},
      expiresAt = null
    } = params;

    const id = uuidv4();
    const template = this.templates.get(type) || this.templates.get('default');

    const notification = {
      id,
      title: this.renderTemplate(template.title, { title, message, ...data }),
      body: this.renderTemplate(template.body, { title, message, body, ...data }),
      message,
      type,
      priority,
      icon: template.icon,
      data,
      read: false,
      dismissed: false,
      channels,
      createdAt: new Date().toISOString(),
      expiresAt
    };

    this.notifications.set(id, notification);
    await this.saveNotifications();

    for (const channelId of channels) {
      await this.sendToChannel(channelId, notification);
    }

    this.eventEmitter.emit('notification', notification);

    this.logger.info(`Notification sent: ${title}`);
    return notification;
  }

  async sendToChannel(channelId, notification) {
    const channel = this.channels.get(channelId);
    if (!channel || !channel.enabled) return;

    switch (channel.type) {
      case 'system':
        this.sendSystemNotification(notification);
        break;
      case 'console':
        this.sendConsoleNotification(notification);
        break;
      case 'file':
        await this.sendFileNotification(notification, channel.config);
        break;
      case 'webhook':
        await this.sendWebhookNotification(notification, channel.config);
        break;
      case 'email':
        await this.sendEmailNotification(notification, channel.config);
        break;
      case 'slack':
        await this.sendSlackNotification(notification, channel.config);
        break;
    }
  }

  sendSystemNotification(notification) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.body,
        icon: notification.icon
      });
    }
  }

  sendConsoleNotification(notification) {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      normal: '\x1b[0m'
    };

    const color = colors[notification.priority] || colors.normal;
    console.log(`${color}[${notification.type.toUpperCase()}] ${notification.title}: ${notification.body}\x1b[0m`);
  }

  async sendFileNotification(notification, config) {
    const logPath = path.join(os.homedir(), '.pix', config.path || 'notifications.log');
    const logEntry = `[${notification.createdAt}] [${notification.type.toUpperCase()}] ${notification.title}: ${notification.body}\n`;
    await fs.appendFile(logPath, logEntry);
  }

  async sendWebhookNotification(notification, config) {
    try {
      const axios = require('axios');
      await axios.post(config.url, {
        title: notification.title,
        body: notification.body,
        type: notification.type,
        priority: notification.priority,
        data: notification.data
      }, {
        headers: config.headers || {}
      });
    } catch (error) {
      this.logger.error(`Webhook notification failed: ${error.message}`);
    }
  }

  async sendEmailNotification(notification, config) {
    this.logger.info(`Email notification would be sent: ${notification.title}`);
  }

  async sendSlackNotification(notification, config) {
    this.logger.info(`Slack notification would be sent: ${notification.title}`);
  }

  renderTemplate(template, data) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return result;
  }

  async markAsRead(id) {
    const notification = this.notifications.get(id);
    if (!notification) throw new Error(`Notification not found: ${id}`);

    notification.read = true;
    notification.readAt = new Date().toISOString();
    this.notifications.set(id, notification);
    await this.saveNotifications();

    return notification;
  }

  async markAllAsRead() {
    for (const [id, notification] of this.notifications) {
      if (!notification.read) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
        this.notifications.set(id, notification);
      }
    }
    await this.saveNotifications();
    return { success: true };
  }

  async dismiss(id) {
    const notification = this.notifications.get(id);
    if (!notification) throw new Error(`Notification not found: ${id}`);

    notification.dismissed = true;
    notification.dismissedAt = new Date().toISOString();
    this.notifications.set(id, notification);
    await this.saveNotifications();

    return notification;
  }

  async delete(id) {
    this.notifications.delete(id);
    await this.saveNotifications();
    return { success: true };
  }

  async clearAll() {
    this.notifications.clear();
    await this.saveNotifications();
    return { success: true };
  }

  list(options = {}) {
    const { type, read, dismissed, limit = 50 } = options;

    let notifications = Array.from(this.notifications.values());

    if (type) notifications = notifications.filter(n => n.type === type);
    if (read !== undefined) notifications = notifications.filter(n => n.read === read);
    if (dismissed !== undefined) notifications = notifications.filter(n => n.dismissed === dismissed);

    return notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  getUnreadCount() {
    return Array.from(this.notifications.values()).filter(n => !n.read && !n.dismissed).length;
  }

  addChannel(params) {
    const { id, name, type, config = {}, enabled = true } = params;
    const channel = { id, name, type, config, enabled };
    this.channels.set(id, channel);
    return channel;
  }

  updateChannel(id, updates) {
    const channel = this.channels.get(id);
    if (!channel) throw new Error(`Channel not found: ${id}`);

    const updated = { ...channel, ...updates };
    this.channels.set(id, updated);
    return updated;
  }

  deleteChannel(id) {
    this.channels.delete(id);
    return { success: true };
  }

  listChannels() {
    return Array.from(this.channels.values());
  }

  addTemplate(params) {
    const { id, name, title, body, icon } = params;
    const template = { id, name, title, body, icon };
    this.templates.set(id, template);
    return template;
  }

  getTemplate(id) {
    return this.templates.get(id);
  }

  listTemplates() {
    return Array.from(this.templates.values());
  }

  async getStats() {
    const notifications = Array.from(this.notifications.values());
    return {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      read: notifications.filter(n => n.read).length,
      dismissed: notifications.filter(n => n.dismissed).length,
      channels: this.channels.size,
      templates: this.templates.size
    };
  }

  async saveNotifications() {
    await fs.writeJson(this.notificationsFile, Object.fromEntries(this.notifications), { spaces: 2 });
  }

  onNotification(callback) {
    this.eventEmitter.on('notification', callback);
  }

  offNotification(callback) {
    this.eventEmitter.off('notification', callback);
  }
}

module.exports = NotificationEngine;
