const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class QRCodeEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.codes = new Map();
    this.qrDir = path.join(os.homedir(), '.pix/qrcodes');
  }

  async initialize() {
    this.logger.info('Initializing QR Code Engine...');
    await fs.ensureDir(this.qrDir);
    await this.loadCodes();
    this.logger.info('QR Code Engine initialized');
  }

  async loadCodes() {
    try {
      const files = await fs.readdir(this.qrDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.qrDir, file));
          this.codes.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  async generate(params) {
    const {
      content,
      type = 'url',
      size = 200,
      color = '#000000',
      backgroundColor = '#FFFFFF',
      errorCorrection = 'M',
      title = ''
    } = params;

    const id = uuidv4();
    const qrCode = {
      id,
      content,
      type,
      size,
      color,
      backgroundColor,
      errorCorrection,
      title,
      scanCount: 0,
      lastScanned: null,
      createdAt: new Date().toISOString()
    };

    this.codes.set(id, qrCode);
    return qrCode;
  }

  async updateCode(id, updates) {
    const code = this.codes.get(id);
    if (!code) throw new Error(`QR Code not found: ${id}`);

    const updated = { ...code, ...updates };
    this.codes.set(id, updated);
    return updated;
  }

  async deleteCode(id) {
    this.codes.delete(id);
    return { success: true };
  }

  async getCode(id) {
    const code = this.codes.get(id);
    if (!code) throw new Error(`QR Code not found: ${id}`);

    code.scanCount = (code.scanCount || 0) + 1;
    code.lastScanned = new Date().toISOString();
    this.codes.set(id, code);

    return code;
  }

  async scanCode(id) {
    return this.getCode(id);
  }

  listCodes(options = {}) {
    const { type, search } = options;
    let codes = Array.from(this.codes.values());

    if (type) codes = codes.filter(c => c.type === type);
    if (search) {
      const searchLower = search.toLowerCase();
      codes = codes.filter(c =>
        c.content.toLowerCase().includes(searchLower) ||
        c.title.toLowerCase().includes(searchLower)
      );
    }

    return codes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  generateUrl(url, options = {}) {
    return this.generate({
      content: url,
      type: 'url',
      ...options
    });
  }

  generateText(text, options = {}) {
    return this.generate({
      content: text,
      type: 'text',
      ...options
    });
  }

  generateEmail(email, subject = '', body = '', options = {}) {
    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return this.generate({
      content: mailto,
      type: 'email',
      ...options
    });
  }

  generatePhone(phone, options = {}) {
    return this.generate({
      content: `tel:${phone}`,
      type: 'phone',
      ...options
    });
  }

  generateSMS(phone, message = '', options = {}) {
    const sms = `sms:${phone}?body=${encodeURIComponent(message)}`;
    return this.generate({
      content: sms,
      type: 'sms',
      ...options
    });
  }

  generateWifi(ssid, password, security = 'WPA', hidden = false, options = {}) {
    const wifi = `WIFI:T:${security};S:${ssid};P:${password};H:${hidden};;`;
    return this.generate({
      content: wifi,
      type: 'wifi',
      ...options
    });
  }

  generateVCard(params) {
    const { name, phone, email, organization = '', url = '' } = params;
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${phone}\nEMAIL:${email}\nORG:${organization}\nURL:${url}\nEND:VCARD`;

    return this.generate({
      content: vcard,
      type: 'vcard',
      title: name
    });
  }

  generateEvent(params) {
    const { summary, startDate, endDate, location = '', description = '' } = params;
    const format = (d) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const ical = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:${summary}\nDTSTART:${format(startDate)}\nDTEND:${format(endDate)}\nLOCATION:${location}\nDESCRIPTION:${description}\nEND:VEVENT\nEND:VCALENDAR`;

    return this.generate({
      content: ical,
      type: 'event',
      title: summary
    });
  }

  generateLocation(latitude, longitude, options = {}) {
    const geo = `geo:${latitude},${longitude}`;
    return this.generate({
      content: geo,
      type: 'location',
      ...options
    });
  }

  async getStats() {
    const codes = Array.from(this.codes.values());

    return {
      total: codes.length,
      totalScans: codes.reduce((sum, c) => sum + (c.scanCount || 0), 0),
      byType: this.getCodesByType()
    };
  }

  getCodesByType() {
    const codes = Array.from(this.codes.values());
    const byType = {};

    for (const code of codes) {
      byType[code.type] = (byType[code.type] || 0) + 1;
    }

    return byType;
  }

  async exportCodes(format = 'json') {
    const codes = Array.from(this.codes.values());

    if (format === 'json') {
      return JSON.stringify(codes, null, 2);
    }

    return codes;
  }
}

module.exports = QRCodeEngine;
