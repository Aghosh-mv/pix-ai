const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class PetEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.pets = new Map();
    this.vetRecords = new Map();
    this.feedingSchedule = new Map();
    this.petDir = path.join(os.homedir(), '.pix/pets');
  }

  async initialize() {
    this.logger.info('Initializing Pet Engine...');
    await fs.ensureDir(this.petDir);
    await this.loadPets();
    this.logger.info('Pet Engine initialized');
  }

  async loadPets() {
    try {
      const files = await fs.readdir(this.petDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const pet = await fs.readJson(path.join(this.petDir, file));
          this.pets.set(pet.id, pet);
        }
      }
    } catch (e) {}
  }

  async createPet(params) {
    const {
      name,
      species,
      breed = '',
      color = '',
      weight = 0,
      birthday = null,
      gender = 'unknown',
      microchipId = '',
      notes = '',
      photo = null
    } = params;

    const id = uuidv4();
    const pet = {
      id,
      name,
      species,
      breed,
      color,
      weight,
      birthday: birthday ? new Date(birthday).toISOString() : null,
      gender,
      microchipId,
      notes,
      photo,
      adoptionDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.pets.set(id, pet);
    await this.savePet(pet);

    this.logger.info(`Pet added: ${name}`);
    return pet;
  }

  async updatePet(id, updates) {
    const pet = this.pets.get(id);
    if (!pet) throw new Error(`Pet not found: ${id}`);

    const updated = {
      ...pet,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };

    this.pets.set(id, updated);
    await this.savePet(updated);

    return updated;
  }

  async deletePet(id) {
    this.pets.delete(id);
    await fs.remove(path.join(this.petDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async getPet(id) {
    return this.pets.get(id);
  }

  listPets(options = {}) {
    const { species, search } = options;

    let pets = Array.from(this.pets.values());

    if (species) pets = pets.filter(p => p.species.toLowerCase() === species.toLowerCase());
    if (search) {
      const searchLower = search.toLowerCase();
      pets = pets.filter(p => p.name.toLowerCase().includes(searchLower));
    }

    return pets;
  }

  async addVetRecord(params) {
    const { petId, type, date, vetName, notes = '', cost = 0, nextVisit = null } = params;

    const id = uuidv4();
    const record = {
      id,
      petId,
      type,
      date: new Date(date).toISOString(),
      vetName,
      notes,
      cost,
      nextVisit: nextVisit ? new Date(nextVisit).toISOString() : null,
      createdAt: new Date().toISOString()
    };

    this.vetRecords.set(id, record);
    return record;
  }

  async getVetRecords(petId) {
    return Array.from(this.vetRecords.values())
      .filter(r => r.petId === petId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async deleteVetRecord(id) {
    this.vetRecords.delete(id);
    return { success: true };
  }

  async createFeedingSchedule(params) {
    const { petId, food, amount, times = [] } = params;

    const id = uuidv4();
    const schedule = {
      id,
      petId,
      food,
      amount,
      times,
      active: true,
      createdAt: new Date().toISOString()
    };

    this.feedingSchedule.set(id, schedule);
    return schedule;
  }

  async updateFeedingSchedule(id, updates) {
    const schedule = this.feedingSchedule.get(id);
    if (!schedule) throw new Error(`Feeding schedule not found: ${id}`);

    const updated = { ...schedule, ...updates };
    this.feedingSchedule.set(id, updated);
    return updated;
  }

  async deleteFeedingSchedule(id) {
    this.feedingSchedule.delete(id);
    return { success: true };
  }

  async getFeedingSchedules(petId) {
    return Array.from(this.feedingSchedule.values())
      .filter(s => s.petId === petId);
  }

  async getPetAge(petId) {
    const pet = this.pets.get(petId);
    if (!pet || !pet.birthday) return null;

    const today = new Date();
    const birthday = new Date(pet.birthday);
    let years = today.getFullYear() - birthday.getFullYear();
    let months = today.getMonth() - birthday.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    return { years, months, totalMonths: years * 12 + months };
  }

  async getPetStats() {
    const pets = Array.from(this.pets.values());
    const species = {};

    for (const pet of pets) {
      species[pet.species] = (species[pet.species] || 0) + 1;
    }

    return {
      totalPets: pets.length,
      species,
      vetRecords: this.vetRecords.size,
      feedingSchedules: this.feedingSchedule.size
    };
  }

  async savePet(pet) {
    const filePath = path.join(this.petDir, `${pet.id}.json`);
    await fs.writeJson(filePath, pet, { spaces: 2 });
  }

  async exportPets(format = 'json') {
    const pets = Array.from(this.pets.values());

    if (format === 'json') {
      return JSON.stringify(pets, null, 2);
    }

    return pets;
  }
}

module.exports = PetEngine;
