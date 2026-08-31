const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class HealthEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.medications = new Map();
    this.appointments = new Map();
    this.symptoms = new Map();
    this.vitals = new Map();
    this.healthDir = path.join(os.homedir(), '.pix/health');
  }

  async initialize() {
    this.logger.info('Initializing Health Engine...');
    await fs.ensureDir(this.healthDir);
    await this.loadHealth();
    this.loadDefaultConditions();
    this.logger.info('Health Engine initialized');
  }

  async loadHealth() {
    try {
      const files = await fs.readdir(this.healthDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.healthDir, file));
          if (data.type === 'medication') this.medications.set(data.id, data);
          else if (data.type === 'appointment') this.appointments.set(data.id, data);
          else if (data.type === 'symptom') this.symptoms.set(data.id, data);
          else if (data.type === 'vital') this.vitals.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadDefaultConditions() {
    this.commonConditions = [
      'Headache', 'Fever', 'Cough', 'Fatigue', 'Nausea',
      'Back Pain', 'Allergies', 'Insomnia', 'Anxiety', 'Cold'
    ];
  }

  async addMedication(params) {
    const {
      name,
      dosage,
      frequency,
      time = '',
      startDate,
      endDate = null,
      notes = '',
      sideEffects = []
    } = params;

    const id = uuidv4();
    const medication = {
      id,
      name,
      dosage,
      frequency,
      time,
      startDate: new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : null,
      notes,
      sideEffects,
      type: 'medication',
      active: true,
      takenToday: false,
      createdAt: new Date().toISOString()
    };

    this.medications.set(id, medication);
    return medication;
  }

  async updateMedication(id, updates) {
    const medication = this.medications.get(id);
    if (!medication) throw new Error(`Medication not found: ${id}`);

    const updated = { ...medication, ...updates };
    this.medications.set(id, updated);
    return updated;
  }

  async markTaken(id) {
    const medication = this.medications.get(id);
    if (!medication) throw new Error(`Medication not found: ${id}`);

    medication.takenToday = true;
    medication.lastTaken = new Date().toISOString();
    this.medications.set(id, medication);
    return medication;
  }

  async deactivateMedication(id) {
    const medication = this.medications.get(id);
    if (!medication) throw new Error(`Medication not found: ${id}`);

    medication.active = false;
    this.medications.set(id, medication);
    return medication;
  }

  listMedications(options = {}) {
    const { active, search } = options;
    let medications = Array.from(this.medications.values());

    if (active !== undefined) medications = medications.filter(m => m.active === active);
    if (search) {
      const searchLower = search.toLowerCase();
      medications = medications.filter(m => m.name.toLowerCase().includes(searchLower));
    }

    return medications;
  }

  async addAppointment(params) {
    const {
      title,
      doctor,
      location = '',
      date,
      time,
      type = 'checkup',
      notes = '',
      reminder = true
    } = params;

    const id = uuidv4();
    const appointment = {
      id,
      title,
      doctor,
      location,
      date: new Date(date).toISOString(),
      time,
      type,
      notes,
      reminder,
      completed: false,
      type: 'appointment',
      createdAt: new Date().toISOString()
    };

    this.appointments.set(id, appointment);
    return appointment;
  }

  async updateAppointment(id, updates) {
    const appointment = this.appointments.get(id);
    if (!appointment) throw new Error(`Appointment not found: ${id}`);

    const updated = { ...appointment, ...updates };
    this.appointments.set(id, updated);
    return updated;
  }

  async completeAppointment(id, notes = '') {
    const appointment = this.appointments.get(id);
    if (!appointment) throw new Error(`Appointment not found: ${id}`);

    appointment.completed = true;
    appointment.completedAt = new Date().toISOString();
    appointment.notes = notes || appointment.notes;
    this.appointments.set(id, appointment);
    return appointment;
  }

  async deleteAppointment(id) {
    this.appointments.delete(id);
    return { success: true };
  }

  listAppointments(options = {}) {
    const { completed, upcoming, type } = options;
    let appointments = Array.from(this.appointments.values());

    if (completed !== undefined) appointments = appointments.filter(a => a.completed === completed);
    if (upcoming) {
      const now = new Date();
      appointments = appointments.filter(a => new Date(a.date) > now);
    }
    if (type) appointments = appointments.filter(a => a.type === type);

    return appointments.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async getUpcomingAppointments() {
    const now = new Date();
    return Array.from(this.appointments.values())
      .filter(a => !a.completed && new Date(a.date) > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 10);
  }

  async addSymptom(params) {
    const {
      name,
      severity = 'mild',
      location = '',
      duration = '',
      notes = '',
      date = new Date().toISOString()
    } = params;

    const id = uuidv4();
    const symptom = {
      id,
      name,
      severity,
      location,
      duration,
      notes,
      date: new Date(date).toISOString(),
      type: 'symptom',
      createdAt: new Date().toISOString()
    };

    this.symptoms.set(id, symptom);
    return symptom;
  }

  async getSymptoms(options = {}) {
    const { name, severity, date } = options;
    let symptoms = Array.from(this.symptoms.values());

    if (name) symptoms = symptoms.filter(s => s.name.toLowerCase() === name.toLowerCase());
    if (severity) symptoms = symptoms.filter(s => s.severity === severity);
    if (date) {
      const dateStr = new Date(date).toISOString().split('T')[0];
      symptoms = symptoms.filter(s => s.date.split('T')[0] === dateStr);
    }

    return symptoms.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async deleteSymptom(id) {
    this.symptoms.delete(id);
    return { success: true };
  }

  async addVital(params) {
    const {
      type,
      value,
      unit = '',
      date = new Date().toISOString(),
      notes = ''
    } = params;

    const id = uuidv4();
    const vital = {
      id,
      type,
      value,
      unit,
      date: new Date(date).toISOString(),
      notes,
      type: 'vital',
      createdAt: new Date().toISOString()
    };

    this.vitals.set(id, vital);
    return vital;
  }

  async getVitals(type = null) {
    let vitals = Array.from(this.vitals.values());
    if (type) vitals = vitals.filter(v => v.type === type);
    return vitals.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async getVitalTrend(type, days = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return Array.from(this.vitals.values())
      .filter(v => v.type === type && new Date(v.date) > cutoff)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async deleteVital(id) {
    this.vitals.delete(id);
    return { success: true };
  }

  async getHealthStats() {
    const medications = Array.from(this.medications.values());
    const appointments = Array.from(this.appointments.values());

    return {
      activeMedications: medications.filter(m => m.active).length,
      upcomingAppointments: appointments.filter(a => !a.completed).length,
      totalSymptoms: this.symptoms.size,
      totalVitals: this.vitals.size,
      medicationsToday: medications.filter(m => !m.takenToday && m.active).length
    };
  }

  async exportHealth(format = 'json') {
    const data = {
      medications: Array.from(this.medications.values()),
      appointments: Array.from(this.appointments.values()),
      symptoms: Array.from(this.symptoms.values()),
      vitals: Array.from(this.vitals.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = HealthEngine;
