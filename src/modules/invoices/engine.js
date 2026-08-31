const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class InvoiceEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.invoices = new Map();
    this.clients = new Map();
    this.templates = new Map();
    this.invoiceDir = path.join(os.homedir(), '.pix/invoices');
  }

  async initialize() {
    this.logger.info('Initializing Invoice Engine...');
    await fs.ensureDir(this.invoiceDir);
    await this.loadInvoices();
    this.loadStatuses();
    this.loadDefaultTemplates();
    this.logger.info('Invoice Engine initialized');
  }

  async loadInvoices() {
    try {
      const files = await fs.readdir(this.invoiceDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.invoiceDir, file));
          if (data.type === 'invoice') this.invoices.set(data.id, data);
          else if (data.type === 'client') this.clients.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadStatuses() {
    this.statuses = [
      { id: 'draft', name: 'Draft', color: '#9E9E9E', icon: '📝' },
      { id: 'sent', name: 'Sent', color: '#2196F3', icon: '📤' },
      { id: 'viewed', name: 'Viewed', color: '#FFC107', icon: '👁️' },
      { id: 'paid', name: 'Paid', color: '#4CAF50', icon: '✅' },
      { id: 'overdue', name: 'Overdue', color: '#F44336', icon: '⚠️' },
      { id: 'cancelled', name: 'Cancelled', color: '#9E9E9E', icon: '❌' }
    ];
  }

  loadDefaultTemplates() {
    this.templateList = [
      {
        id: 'standard',
        name: 'Standard',
        description: 'Clean and professional invoice template',
        icon: '📄'
      },
      {
        id: 'modern',
        name: 'Modern',
        description: 'Contemporary design with color accents',
        icon: '🎨'
      },
      {
        id: 'minimal',
        name: 'Minimal',
        description: 'Simple and clean layout',
        icon: '✨'
      }
    ];
  }

  async createClient(params) {
    const {
      name,
      company = '',
      email = '',
      phone = '',
      address = '',
      notes = ''
    } = params;

    const id = uuidv4();
    const client = {
      id,
      name,
      company,
      email,
      phone,
      address,
      notes,
      totalInvoiced: 0,
      totalPaid: 0,
      type: 'client',
      createdAt: new Date().toISOString()
    };

    this.clients.set(id, client);
    return client;
  }

  async updateClient(id, updates) {
    const client = this.clients.get(id);
    if (!client) throw new Error(`Client not found: ${id}`);

    const updated = { ...client, ...updates };
    this.clients.set(id, updated);
    return updated;
  }

  async deleteClient(id) {
    this.clients.delete(id);
    return { success: true };
  }

  listClients() {
    return Array.from(this.clients.values());
  }

  async createInvoice(params) {
    const {
      clientId,
      invoiceNumber = `INV-${Date.now()}`,
      items = [],
      tax = 0,
      discount = 0,
      notes = '',
      dueDate = null,
      paymentTerms = 'Net 30',
      status = 'draft',
      template = 'standard'
    } = params;

    const id = uuidv4();
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const taxAmount = subtotal * (tax / 100);
    const discountAmount = subtotal * (discount / 100);
    const total = subtotal + taxAmount - discountAmount;

    const invoice = {
      id,
      clientId,
      invoiceNumber,
      items: items.map(item => ({
        id: uuidv4(),
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.quantity * item.rate
      })),
      subtotal,
      tax,
      taxAmount,
      discount,
      discountAmount,
      total,
      notes,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      paymentTerms,
      status,
      template,
      payments: [],
      type: 'invoice',
      createdAt: new Date().toISOString()
    };

    this.invoices.set(id, invoice);

    const client = this.clients.get(clientId);
    if (client) {
      client.totalInvoiced += total;
    }

    return invoice;
  }

  async updateInvoice(id, updates) {
    const invoice = this.invoices.get(id);
    if (!invoice) throw new Error(`Invoice not found: ${id}`);

    const updated = { ...invoice, ...updates };
    this.invoices.set(id, updated);
    return updated;
  }

  async addPayment(params) {
    const { invoiceId, amount, date = new Date().toISOString(), method = 'bank', notes = '' } = params;
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

    const payment = {
      id: uuidv4(),
      amount,
      date: new Date(date).toISOString(),
      method,
      notes
    };

    invoice.payments.push(payment);
    invoice.paidAmount = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    invoice.remaining = invoice.total - invoice.paidAmount;

    if (invoice.remaining <= 0) {
      invoice.status = 'paid';
      invoice.paidAt = new Date().toISOString();
    }

    this.invoices.set(invoiceId, invoice);
    return invoice;
  }

  async deleteInvoice(id) {
    this.invoices.delete(id);
    return { success: true };
  }

  async getInvoice(id) {
    return this.invoices.get(id);
  }

  listInvoices(options = {}) {
    const { status, clientId, search } = options;
    let invoices = Array.from(this.invoices.values());

    if (status) invoices = invoices.filter(i => i.status === status);
    if (clientId) invoices = invoices.filter(i => i.clientId === clientId);
    if (search) {
      const searchLower = search.toLowerCase();
      invoices = invoices.filter(i =>
        i.invoiceNumber.toLowerCase().includes(searchLower)
      );
    }

    return invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getInvoiceStats() {
    const invoices = Array.from(this.invoices.values());
    const totalRevenue = invoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.total, 0);

    const pendingAmount = invoices
      .filter(i => ['sent', 'viewed'].includes(i.status))
      .reduce((sum, i) => sum + i.total, 0);

    const overdueAmount = invoices
      .filter(i => i.status === 'overdue')
      .reduce((sum, i) => sum + i.total, 0);

    return {
      total: invoices.length,
      draft: invoices.filter(i => i.status === 'draft').length,
      sent: invoices.filter(i => i.status === 'sent').length,
      paid: invoices.filter(i => i.status === 'paid').length,
      overdue: invoices.filter(i => i.status === 'overdue').length,
      totalRevenue,
      pendingAmount,
      overdueAmount,
      averageInvoice: invoices.length > 0 ? totalRevenue / invoices.filter(i => i.status === 'paid').length : 0
    };
  }

  getStatuses() {
    return this.statuses;
  }

  getTemplates() {
    return this.templateList;
  }

  async generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const count = this.invoices.size + 1;
    return `INV-${year}-${String(count).padStart(4, '0')}`;
  }

  async exportInvoices(format = 'json') {
    const data = {
      invoices: Array.from(this.invoices.values()),
      clients: Array.from(this.clients.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'csv') {
      const headers = ['invoiceNumber', 'clientId', 'total', 'status', 'createdAt'];
      const rows = Array.from(this.invoices.values()).map(i => [
        i.invoiceNumber, i.clientId, i.total, i.status, i.createdAt
      ]);
      return [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    }

    return data;
  }
}

module.exports = InvoiceEngine;
