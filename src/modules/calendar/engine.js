const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class CalendarEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.events = new Map();
    this.calendars = new Map();
    this.reminders = new Map();
    this.calendarDir = path.join(os.homedir(), '.pix/calendar');
  }

  async initialize() {
    this.logger.info('Initializing Calendar Engine...');
    await fs.ensureDir(this.calendarDir);
    await this.loadEvents();
    this.loadDefaultCalendars();
    this.startReminderCheck();
    this.logger.info('Calendar Engine initialized');
  }

  async loadEvents() {
    try {
      const files = await fs.readdir(this.calendarDir);
      for (const file of files) {
        if (file.startsWith('events-') && file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.calendarDir, file));
          const month = file.replace('events-', '').replace('.json', '');
          this.events.set(month, new Map(Object.entries(data)));
        }
      }
    } catch (e) {}
  }

  loadDefaultCalendars() {
    const calendars = [
      { id: 'personal', name: 'Personal', color: '#4285f4', default: true },
      { id: 'work', name: 'Work', color: '#0f9d58' },
      { id: 'pix', name: 'Pix Tasks', color: '#f4b400' }
    ];

    calendars.forEach(cal => {
      this.calendars.set(cal.id, cal);
    });
  }

  startReminderCheck() {
    setInterval(() => this.checkReminders(), 60000);
  }

  async checkReminders() {
    const now = new Date();
    for (const [id, reminder] of this.reminders) {
      if (reminder.triggered) continue;

      const eventTime = new Date(reminder.eventDate);
      const reminderTime = new Date(eventTime.getTime() - reminder.minutesBefore * 60000);

      if (now >= reminderTime) {
        reminder.triggered = true;
        this.reminders.set(id, reminder);
        this.logger.info(`Reminder: ${reminder.message}`);
      }
    }
  }

  async createEvent(params) {
    const {
      title,
      description = '',
      start,
      end,
      allDay = false,
      calendarId = 'personal',
      location = '',
      attendees = [],
      recurrence = null,
      reminders = [],
      tags = []
    } = params;

    const id = uuidv4();
    const event = {
      id,
      title,
      description,
      start: new Date(start).toISOString(),
      end: end ? new Date(end).toISOString() : null,
      allDay,
      calendarId,
      location,
      attendees,
      recurrence,
      reminders,
      tags,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    for (const reminder of reminders) {
      const reminderId = uuidv4();
      this.reminders.set(reminderId, {
        id: reminderId,
        eventId: id,
        eventDate: event.start,
        minutesBefore: reminder.minutes || 15,
        message: reminder.message || `Reminder: ${title}`,
        triggered: false
      });
    }

    const month = event.start.substring(0, 7);
    if (!this.events.has(month)) {
      this.events.set(month, new Map());
    }
    this.events.get(month).set(id, event);

    await this.saveEvents(month);

    this.logger.info(`Event created: ${title}`);
    return event;
  }

  async updateEvent(id, updates) {
    let event = null;
    let eventMonth = null;

    for (const [month, events] of this.events) {
      if (events.has(id)) {
        event = events.get(id);
        eventMonth = month;
        break;
      }
    }

    if (!event) throw new Error(`Event not found: ${id}`);

    const updated = {
      ...event,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    if (updates.start) {
      updated.start = new Date(updates.start).toISOString();
      const newMonth = updated.start.substring(0, 7);

      if (newMonth !== eventMonth) {
        this.events.get(eventMonth).delete(id);
        await this.saveEvents(eventMonth);

        if (!this.events.has(newMonth)) {
          this.events.set(newMonth, new Map());
        }
        this.events.get(newMonth).set(id, updated);
        await this.saveEvents(newMonth);
      } else {
        this.events.get(eventMonth).set(id, updated);
        await this.saveEvents(eventMonth);
      }
    } else {
      this.events.get(eventMonth).set(id, updated);
      await this.saveEvents(eventMonth);
    }

    return updated;
  }

  async deleteEvent(id) {
    for (const [month, events] of this.events) {
      if (events.has(id)) {
        events.delete(id);
        await this.saveEvents(month);

        for (const [reminderId, reminder] of this.reminders) {
          if (reminder.eventId === id) {
            this.reminders.delete(reminderId);
          }
        }

        return { success: true };
      }
    }

    throw new Error(`Event not found: ${id}`);
  }

  async getEvent(id) {
    for (const [, events] of this.events) {
      if (events.has(id)) {
        return events.get(id);
      }
    }
    return null;
  }

  async getEvents(params = {}) {
    const { startDate, endDate, calendarId, limit = 100 } = params;

    const results = [];
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const [, events] of this.events) {
      for (const [, event] of events) {
        const eventStart = new Date(event.start);
        const eventEnd = event.end ? new Date(event.end) : eventStart;

        if (eventStart >= start && eventStart <= end) {
          if (!calendarId || event.calendarId === calendarId) {
            results.push(event);
          }
        }

        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }

    return results.sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  async getEventsForDate(date) {
    const d = new Date(date);
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

    return this.getEvents({ startDate: startOfDay, endDate: endOfDay });
  }

  async getEventsForMonth(year, month) {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const events = this.events.get(monthStr);
    return events ? Array.from(events.values()) : [];
  }

  createCalendar(params) {
    const { id, name, color } = params;
    const calendar = { id, name, color };
    this.calendars.set(id, calendar);
    return calendar;
  }

  updateCalendar(id, updates) {
    const calendar = this.calendars.get(id);
    if (!calendar) throw new Error(`Calendar not found: ${id}`);

    const updated = { ...calendar, ...updates };
    this.calendars.set(id, updated);
    return updated;
  }

  deleteCalendar(id) {
    this.calendars.delete(id);
    return { success: true };
  }

  listCalendars() {
    return Array.from(this.calendars.values());
  }

  async createReminder(params) {
    const { eventId, minutesBefore = 15, message } = params;
    const event = await this.getEvent(eventId);

    if (!event) throw new Error(`Event not found: ${eventId}`);

    const id = uuidv4();
    const reminder = {
      id,
      eventId,
      eventDate: event.start,
      minutesBefore,
      message: message || `Reminder: ${event.title}`,
      triggered: false
    };

    this.reminders.set(id, reminder);
    return reminder;
  }

  async deleteReminder(id) {
    this.reminders.delete(id);
    return { success: true };
  }

  getReminders() {
    return Array.from(this.reminders.values()).filter(r => !r.triggered);
  }

  async searchEvents(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, events] of this.events) {
      for (const [, event] of events) {
        if (event.title.toLowerCase().includes(queryLower) ||
            event.description.toLowerCase().includes(queryLower) ||
            event.location.toLowerCase().includes(queryLower)) {
          results.push(event);
        }
      }
    }

    return results;
  }

  async getUpcomingEvents(limit = 10) {
    const now = new Date();
    const upcoming = [];

    for (const [, events] of this.events) {
      for (const [, event] of events) {
        if (new Date(event.start) > now) {
          upcoming.push(event);
        }
      }
    }

    return upcoming
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, limit);
  }

  async getTodayEvents() {
    return this.getEventsForDate(new Date());
  }

  async getWeekEvents() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return this.getEvents({ startDate: startOfWeek, endDate: endOfWeek });
  }

  async getMonthEvents() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return this.getEvents({ startDate: startOfMonth, endDate: endOfMonth });
  }

  async saveEvents(month) {
    const events = this.events.get(month);
    if (events) {
      const filePath = path.join(this.calendarDir, `events-${month}.json`);
      await fs.writeJson(filePath, Object.fromEntries(events), { spaces: 2 });
    }
  }

  async exportEvents(format = 'json') {
    const allEvents = [];
    for (const [, events] of this.events) {
      for (const [, event] of events) {
        allEvents.push(event);
      }
    }

    if (format === 'json') {
      return JSON.stringify(allEvents, null, 2);
    }

    if (format === 'csv') {
      const headers = ['id', 'title', 'start', 'end', 'location', 'description'];
      const rows = allEvents.map(e => [
        e.id,
        e.title,
        e.start,
        e.end || '',
        e.location,
        e.description
      ]);
      return [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    }

    return allEvents;
  }

  async importEvents(data) {
    const events = Array.isArray(data) ? data : JSON.parse(data);
    let imported = 0;

    for (const eventData of events) {
      await this.createEvent(eventData);
      imported++;
    }

    return { imported };
  }

  async getStats() {
    let totalEvents = 0;
    let upcomingEvents = 0;
    const now = new Date();

    for (const [, events] of this.events) {
      for (const [, event] of events) {
        totalEvents++;
        if (new Date(event.start) > now) {
          upcomingEvents++;
        }
      }
    }

    return {
      totalEvents,
      upcomingEvents,
      calendars: this.calendars.size,
      reminders: this.reminders.size
    };
  }
}

module.exports = CalendarEngine;
