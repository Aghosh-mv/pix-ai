/**
 * Live Collaboration — Pix AI
 * Share sessions with others in real-time
 * by Aghosh-mv · justcode
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

class LiveCollab {
  constructor() {
    this.server = null;
    this.clients = new Map();
    this.sessions = new Map();
    this.port = 0;
  }

  // ── Start collaboration server ──
  start(port = 0) {
    this.server = http.createServer((req, res) => {
      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

      const url = new URL(req.url, `http://localhost`);

      // API routes
      if (url.pathname === '/api/sessions' && req.method === 'GET') {
        this.handleListSessions(res);
      } else if (url.pathname === '/api/session' && req.method === 'POST') {
        this.handleCreateSession(req, res);
      } else if (url.pathname.startsWith('/api/session/') && req.method === 'GET') {
        this.handleGetSession(url.pathname.split('/')[3], res);
      } else if (url.pathname.startsWith('/api/session/') && req.method === 'POST') {
        this.handleJoinSession(url.pathname.split('/')[3], req, res);
      } else if (url.pathname.startsWith('/api/message/') && req.method === 'POST') {
        this.handleMessage(url.pathname.split('/')[3], req, res);
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'not found' }));
      }
    });

    this.server.listen(port, () => {
      this.port = this.server.address().port;
    });
  }

  handleListSessions(res) {
    const sessions = [];
    this.sessions.forEach((s, id) => {
      sessions.push({ id, name: s.name, host: s.host, users: s.users.length, created: s.created });
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessions));
  }

  handleCreateSession(req, res) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const id = crypto.randomBytes(6).toString('hex');
        const session = {
          id, name: data.name || 'untitled',
          host: data.host || 'anonymous',
          users: [data.host || 'anonymous'],
          messages: [],
          created: new Date().toISOString(),
          shareLink: `pix://collab/${id}`,
        };
        this.sessions.set(id, session);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id, shareLink: session.shareLink }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'invalid request' }));
      }
    });
  }

  handleGetSession(id, res) {
    const session = this.sessions.get(id);
    if (!session) { res.writeHead(404); res.end(JSON.stringify({ error: 'not found' })); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(session));
  }

  handleJoinSession(id, req, res) {
    const session = this.sessions.get(id);
    if (!session) { res.writeHead(404); res.end(JSON.stringify({ error: 'not found' })); return; }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!session.users.includes(data.user)) session.users.push(data.user);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, users: session.users }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'invalid' }));
      }
    });
  }

  handleMessage(id, req, res) {
    const session = this.sessions.get(id);
    if (!session) { res.writeHead(404); res.end(JSON.stringify({ error: 'not found' })); return; }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const msg = { id: crypto.randomBytes(4).toString('hex'), user: data.user, content: data.content, timestamp: new Date().toISOString() };
        session.messages.push(msg);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(msg));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'invalid' }));
      }
    });
  }

  // ── Client: create session ──
  createSession(name, host) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ name, host });
      const req = http.request({ hostname: 'localhost', port: this.port, path: '/api/session', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  // ── Client: send message ──
  sendMessage(sessionId, user, content) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ user, content });
      const req = http.request({ hostname: 'localhost', port: this.port, path: `/api/message/${sessionId}`, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  // ── Client: get session ──
  getSession(sessionId) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:${this.port}/api/session/${sessionId}`, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
  }

  // ── Stop server ──
  stop() {
    if (this.server) this.server.close();
  }

  getStatus() {
    return { running: !!this.server, port: this.port, sessions: this.sessions.size };
  }
}

module.exports = LiveCollab;
