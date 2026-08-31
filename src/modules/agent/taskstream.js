const { v4: uuidv4 } = require('uuid');

class TaskStreamEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.streams = new Map();
    this.subscribers = new Map();
    this.events = new Map();
    this.channels = new Map();

    this.eventTypes = [
      { id: 'task-started', name: 'Task Started', icon: '▶️', color: '#4CAF50' },
      { id: 'task-progress', name: 'Task Progress', icon: '📊', color: '#2196F3' },
      { id: 'task-completed', name: 'Task Completed', icon: '✅', color: '#4CAF50' },
      { id: 'task-failed', name: 'Task Failed', icon: '❌', color: '#F44336' },
      { id: 'task-cancelled', name: 'Task Cancelled', icon: '⏹️', color: '#FF9800' },
      { id: 'log', name: 'Log', icon: '📝', color: '#9E9E9E' },
      { id: 'warning', name: 'Warning', icon: '⚠️', color: '#FF9800' },
      { id: 'error', name: 'Error', icon: '❌', color: '#F44336' },
      { id: 'info', name: 'Info', icon: 'ℹ️', color: '#2196F3' },
      { id: 'metric', name: 'Metric', icon: '📈', color: '#9C27B0' }
    ];

    this.streamTypes = [
      { id: 'task', name: 'Task Stream', icon: '📋', description: 'Stream task updates' },
      { id: 'log', name: 'Log Stream', icon: '📝', description: 'Stream logs' },
      { id: 'metric', name: 'Metric Stream', icon: '📈', description: 'Stream metrics' },
      { id: 'event', name: 'Event Stream', icon: '🔔', description: 'Stream events' },
      { id: 'file', name: 'File Stream', icon: '📁', description: 'Stream file changes' },
      { id: 'process', name: 'Process Stream', icon: '⚙️', description: 'Stream process output' }
    ];
  }

  async initialize() { this.logger.info('Initializing Task Stream Engine...'); this.createChannel('default', 'Default Stream'); this.logger.info('Task Stream Engine initialized'); }

  createChannel(name, description = '') {
    const id = uuidv4();
    const channel = { id, name, description, subscribers: [], events: [], status: 'active', createdAt: new Date().toISOString() };
    this.channels.set(id, channel);
    return channel;
  }

  createStream(params) {
    const { name, type = 'task', channel = null } = params;
    const id = uuidv4();
    const stream = { id, name, type, channel, status: 'streaming', events: [], startedAt: new Date().toISOString() };
    this.streams.set(id, stream);
    return stream;
  }

  emitEvent(streamId, event) {
    const stream = this.streams.get(streamId);
    if (!stream) throw new Error('Stream not found');
    const fullEvent = { id: uuidv4(), streamId, ...event, timestamp: new Date().toISOString() };
    stream.events.push(fullEvent);
    this.events.set(fullEvent.id, fullEvent);
    this.streams.set(streamId, stream);
    if (stream.channel) { const ch = this.channels.get(stream.channel); if (ch) { ch.events.push(fullEvent.id); this.channels.set(stream.channel, ch); } }
    this.notifySubscribers(streamId, fullEvent);
    return fullEvent;
  }

  subscribe(streamId, callback) {
    const id = uuidv4();
    const sub = { id, streamId, callback, createdAt: new Date().toISOString() };
    this.subscribers.set(id, sub);
    return sub;
  }

  unsubscribe(subId) { this.subscribers.delete(subId); return { success: true }; }

  notifySubscribers(streamId, event) {
    Array.from(this.subscribers.values()).filter(s => s.streamId === streamId).forEach(s => { try { s.callback(event); } catch (e) {} });
  }

  getStream(id) { return this.streams.get(id); }
  listStreams() { return Array.from(this.streams.values()); }
  getEvent(id) { return this.events.get(id); }
  listEvents(streamId = null) { let events = Array.from(this.events.values()); if (streamId) events = events.filter(e => e.streamId === streamId); return events.slice(-100); }
  getChannel(id) { return this.channels.get(id); }
  listChannels() { return Array.from(this.channels.values()); }
  getEventTypes() { return this.eventTypes; }
  getStreamTypes() { return this.streamTypes; }

  async getStats() {
    return { streams: this.streams.size, activeStreams: Array.from(this.streams.values()).filter(s => s.status === 'streaming').length, events: this.events.size, subscribers: this.subscribers.size, channels: this.channels.size };
  }
}

module.exports = TaskStreamEngine;
