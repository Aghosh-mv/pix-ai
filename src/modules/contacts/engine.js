const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ContactEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.contacts = new Map();
    this.groups = new Map();
    this.contactDir = path.join(os.homedir(), '.pix/contacts');
  }

  async initialize() {
    this.logger.info('Initializing Contact Engine...');
    await fs.ensureDir(this.contactDir);
    await this.loadContacts();
    this.loadDefaultGroups();
    this.logger.info('Contact Engine initialized');
  }

  async loadContacts() {
    try {
      const files = await fs.readdir(this.contactDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const contact = await fs.readJson(path.join(this.contactDir, file));
          this.contacts.set(contact.id, contact);
        }
      }
    } catch (e) {}
  }

  loadDefaultGroups() {
    const groups = [
      { id: 'all', name: 'All Contacts', icon: '👥' },
      { id: 'favorites', name: 'Favorites', icon: '⭐' },
      { id: 'work', name: 'Work', icon: '💼' },
      { id: 'personal', name: 'Personal', icon: '🏠' }
    ];

    groups.forEach(group => {
      this.groups.set(group.id, group);
    });
  }

  async create(params) {
    const {
      firstName,
      lastName = '',
      email = '',
      phone = '',
      company = '',
      jobTitle = '',
      notes = '',
      groupId = 'all',
      isFavorite = false,
      avatar = null,
      social = {}
    } = params;

    const id = uuidv4();
    const contact = {
      id,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      email,
      phone,
      company,
      jobTitle,
      notes,
      groupId,
      isFavorite,
      avatar,
      social,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.contacts.set(id, contact);
    await this.saveContact(contact);

    this.logger.info(`Contact created: ${contact.fullName}`);
    return contact;
  }

  async update(id, updates) {
    const contact = this.contacts.get(id);
    if (!contact) throw new Error(`Contact not found: ${id}`);

    const updated = {
      ...contact,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    if (updates.firstName || updates.lastName) {
      updated.fullName = `${updated.firstName} ${updated.lastName}`.trim();
    }

    this.contacts.set(id, updated);
    await this.saveContact(updated);

    return updated;
  }

  async delete(id) {
    this.contacts.delete(id);
    await fs.remove(path.join(this.contactDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async get(id) {
    return this.contacts.get(id);
  }

  list(options = {}) {
    const { groupId, search, isFavorite, limit = 100, offset = 0 } = options;

    let contacts = Array.from(this.contacts.values());

    if (groupId && groupId !== 'all') {
      contacts = contacts.filter(c => c.groupId === groupId);
    }
    if (isFavorite !== undefined) {
      contacts = contacts.filter(c => c.isFavorite === isFavorite);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      contacts = contacts.filter(c =>
        c.fullName.toLowerCase().includes(searchLower) ||
        c.email.toLowerCase().includes(searchLower) ||
        c.company.toLowerCase().includes(searchLower)
      );
    }

    contacts.sort((a, b) => a.fullName.localeCompare(b.fullName));

    return {
      contacts: contacts.slice(offset, offset + limit),
      total: contacts.length
    };
  }

  async search(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, contact] of this.contacts) {
      let score = 0;

      if (contact.fullName.toLowerCase().includes(queryLower)) score += 10;
      if (contact.email.toLowerCase().includes(queryLower)) score += 8;
      if (contact.company.toLowerCase().includes(queryLower)) score += 5;
      if (contact.phone.includes(queryLower)) score += 3;

      if (score > 0) {
        results.push({ ...contact, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async toggleFavorite(id) {
    const contact = this.contacts.get(id);
    if (!contact) throw new Error(`Contact not found: ${id}`);

    contact.isFavorite = !contact.isFavorite;
    contact.updatedAt = new Date().toISOString();
    this.contacts.set(id, contact);
    await this.saveContact(contact);

    return contact;
  }

  async moveToGroup(id, groupId) {
    const contact = this.contacts.get(id);
    if (!contact) throw new Error(`Contact not found: ${id}`);

    contact.groupId = groupId;
    contact.updatedAt = new Date().toISOString();
    this.contacts.set(id, contact);
    await this.saveContact(contact);

    return contact;
  }

  createGroup(params) {
    const { id, name, icon = '📁' } = params;
    const group = { id, name, icon };
    this.groups.set(id, group);
    return group;
  }

  updateGroup(id, updates) {
    const group = this.groups.get(id);
    if (!group) throw new Error(`Group not found: ${id}`);

    const updated = { ...group, ...updates };
    this.groups.set(id, updated);
    return updated;
  }

  deleteGroup(id) {
    this.groups.delete(id);
    return { success: true };
  }

  listGroups() {
    return Array.from(this.groups.values());
  }

  async getFavorites() {
    return Array.from(this.contacts.values())
      .filter(c => c.isFavorite)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async getByCompany(company) {
    const companyLower = company.toLowerCase();
    return Array.from(this.contacts.values())
      .filter(c => c.company.toLowerCase().includes(companyLower))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async getStats() {
    const contacts = Array.from(this.contacts.values());
    const companies = new Set(contacts.map(c => c.company).filter(Boolean));

    return {
      totalContacts: contacts.length,
      favorites: contacts.filter(c => c.isFavorite).length,
      groups: this.groups.size,
      companies: companies.size
    };
  }

  async exportContacts(format = 'json') {
    const contacts = Array.from(this.contacts.values());

    if (format === 'json') {
      return JSON.stringify(contacts, null, 2);
    }

    if (format === 'csv') {
      const headers = ['firstName', 'lastName', 'email', 'phone', 'company', 'jobTitle'];
      const rows = contacts.map(c => [
        c.firstName,
        c.lastName,
        c.email,
        c.phone,
        c.company,
        c.jobTitle
      ]);
      return [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    }

    return contacts;
  }

  async importContacts(data) {
    const contacts = Array.isArray(data) ? data : JSON.parse(data);
    let imported = 0;

    for (const contact of contacts) {
      await this.create({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        jobTitle: contact.jobTitle,
        groupId: contact.groupId || 'all'
      });
      imported++;
    }

    return { imported };
  }

  async saveContact(contact) {
    const filePath = path.join(this.contactDir, `${contact.id}.json`);
    await fs.writeJson(filePath, contact, { spaces: 2 });
  }
}

module.exports = ContactEngine;
