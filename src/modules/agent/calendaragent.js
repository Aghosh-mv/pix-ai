const { v4: uuidv4 } = require('uuid');

class CalendarAgentEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.calendars = new Map();
    this.events = new Map();
    this.reminders = new Map();

    this.providers = [
      { id: 'google', name: 'Google Calendar', icon: '📅', features: ['read', 'create', 'update', 'delete', 'share'] },
      { id: 'outlook', name: 'Outlook Calendar', icon: '📨', features: ['read', 'create', 'update', 'delete', 'share'] },
      { id: 'apple', name: 'Apple Calendar', icon: '🍎', features: ['read', 'create', 'update', 'delete'] },
      { id: 'ical', name: 'iCal/ICS', icon: '📋', features: ['read', 'create', 'export'] },
      { id: 'calendly', name: 'Calendly', icon: '📆', features: ['read', 'create', 'schedule'] }
    ];

    this.eventTypes = [
      { id: 'meeting', name: 'Meeting', icon: '👥', color: '#2196F3' },
      { id: 'focus', name: 'Focus Time', icon: '🧠', color: '#4CAF50' },
      { id: 'break', name: 'Break', icon: '☕', color: '#FF9800' },
      { id: 'deadline', name: 'Deadline', icon: '⏰', color: '#F44336' },
      { id: 'reminder', name: 'Reminder', icon: '🔔', color: '#9C27B0' },
      { id: 'personal', name: 'Personal', icon: '🏠', color: '#E91E63' },
      { id: 'recurring', name: 'Recurring', icon: '🔄', color: '#00BCD4' }
    ];

    this.recurrence = [
      { id: 'none', name: 'None' },
      { id: 'daily', name: 'Daily' },
      { id: 'weekly', name: 'Weekly' },
      { id: 'biweekly', name: 'Bi-weekly' },
      { id: 'monthly', name: 'Monthly' },
      { id: 'yearly', name: 'Yearly' },
      { id: 'weekdays', name: 'Weekdays' }
    ];

    this.schedulingModes = [
      { id: 'smart', name: 'Smart Scheduling', icon: '🧠', description: 'AI picks best time' },
      { id: 'asap', name: 'ASAP', icon: '⚡', description: 'Schedule as soon as possible' },
      { id: 'preferred', name: 'Preferred Time', icon: '⏰', description: 'User picks preferred time' },
      { id: 'round-robin', name: 'Round Robin', icon: '🔄', description: 'Distribute evenly' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Calendar Agent Engine...');
    this.loadSettings();
    this.logger.info('Calendar Agent Engine initialized');
  }

  loadSettings() {
    this.settings = { enabled: false, defaultProvider: 'google', autoSchedule: false, conflictDetection: true, workHours: { start: 9, end: 17 }, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }

  connectProvider(params) {
    const { provider = 'google', token = '' } = params;
    const id = uuidv4();
    const conn = { id, provider, token, status: 'connected', createdAt: new Date().toISOString() };
    this.calendars.set(id, conn);
    return conn;
  }

  createEvent(params) {
    const { calendarId, title = '', description = '', startTime, endTime, type = 'meeting', attendees = [], location = '', recurrence = 'none', reminder = 15 } = params;
    const id = uuidv4();
    const event = { id, calendarId, title, description, startTime, endTime, type, attendees, location, recurrence, reminder, status: 'confirmed', createdAt: new Date().toISOString() };
    this.events.set(id, event);
    return event;
  }

  async findFreeSlot(params) {
    const { calendarId, duration = 60, preferredDate = null, preferredTime = null } = params;
    return { calendarId, duration, slot: { start: new Date().toISOString(), end: new Date(Date.now() + duration * 60000).toISOString() }, confidence: 0.8 };
  }

  async checkConflicts(params) {
    const { calendarId, startTime, endTime } = params;
    const conflicts = Array.from(this.events.values()).filter(e => e.calendarId === calendarId && new Date(e.startTime) < new Date(endTime) && new Date(e.endTime) > new Date(startTime));
    return { hasConflict: conflicts.length > 0, conflicts };
  }

  async suggestMeetingTimes(params) {
    const { attendees = [], duration = 60, dateRange = {} } = params;
    return { suggestions: [{ start: new Date().toISOString(), end: new Date(Date.now() + duration * 60000).toISOString(), score: 0.9 }] };
  }

  getEvent(id) { return this.events.get(id); }
  listEvents(calendarId = null) { let e = Array.from(this.events.values()); if (calendarId) e = e.filter(x => x.calendarId === calendarId); return e; }
  getProviders() { return this.providers; }
  getEventTypes() { return this.eventTypes; }
  getRecurrence() { return this.recurrence; }
  getSchedulingModes() { return this.schedulingModes; }
  getSettings() { return this.settings; }
  updateSettings(updates) { this.settings = { ...this.settings, ...updates }; return this.settings; }

  async getStats() {
    return { calendars: this.calendars.size, events: this.events.size, upcoming: Array.from(this.events.values()).filter(e => new Date(e.startTime) > new Date()).length };
  }
}

module.exports = CalendarAgentEngine;
