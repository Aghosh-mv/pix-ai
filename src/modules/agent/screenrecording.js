const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ScreenRecordingEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.recordings = new Map();
    this.screenshots = new Map();
    this.recordingDir = path.join(os.homedir(), '.pix/screen');

    this.recordingModes = [
      { id: 'full', name: 'Full Screen', icon: '🖥️', description: 'Record entire screen' },
      { id: 'region', name: 'Region', icon: '✂️', description: 'Record selected region' },
      { id: 'window', name: 'Window', icon: '🪟', description: 'Record specific window' },
      { id: 'tab', name: 'Browser Tab', icon: '🌐', description: 'Record browser tab' }
    ];

    this.outputFormats = [
      { id: 'mp4', name: 'MP4', extension: '.mp4', codec: 'h264', quality: 'high', size: 'medium' },
      { id: 'webm', name: 'WebM', extension: '.webm', codec: 'vp8', quality: 'good', size: 'small' },
      { id: 'mov', name: 'MOV', extension: '.mov', codec: 'prores', quality: 'excellent', size: 'large' },
      { id: 'avi', name: 'AVI', extension: '.avi', codec: 'mpeg4', quality: 'good', size: 'large' },
      { id: 'gif', name: 'GIF', extension: '.gif', codec: 'gif', quality: 'fair', size: 'small' }
    ];

    this.qualitySettings = [
      { id: 'low', name: 'Low', resolution: '480p', fps: 15, bitrate: '1M' },
      { id: 'medium', name: 'Medium', resolution: '720p', fps: 30, bitrate: '5M' },
      { id: 'high', name: 'High', resolution: '1080p', fps: 30, bitrate: '10M' },
      { id: 'ultra', name: 'Ultra', resolution: '4K', fps: 60, bitrate: '20M' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Screen Recording Engine...');
    await fs.ensureDir(this.recordingDir);
    await fs.ensureDir(path.join(this.recordingDir, 'recordings'));
    await fs.ensureDir(path.join(this.recordingDir, 'screenshots'));
    await this.loadData();
    this.loadSettings();
    this.logger.info('Screen Recording Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.recordingDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.recordingDir, file));
          if (data.type === 'recording') this.recordings.set(data.id, data);
          else if (data.type === 'screenshot') this.screenshots.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadSettings() {
    this.settings = {
      defaultMode: 'full',
      defaultFormat: 'mp4',
      defaultQuality: 'high',
      includeCursor: true,
      includeAudio: false,
      audioSource: 'system',
      countdown: 3,
      autoStop: false,
      maxDuration: 3600,
      outputDir: path.join(os.homedir(), 'Desktop'),
      filename: 'recording_{date}_{time}'
    };
  }

  async startRecording(params = {}) {
    const {
      mode = this.settings.defaultMode,
      format = this.settings.defaultFormat,
      quality = this.settings.defaultQuality,
      region = null,
      windowId = null,
      includeCursor = this.settings.includeCursor,
      includeAudio = this.settings.includeAudio
    } = params;

    const id = uuidv4();
    const qualitySetting = this.qualitySettings.find(q => q.id === quality);

    const recording = {
      id,
      mode,
      format,
      quality,
      qualitySetting,
      region,
      windowId,
      includeCursor,
      includeAudio,
      status: 'recording',
      startedAt: new Date().toISOString(),
      duration: 0,
      frames: 0,
      filePath: null,
      type: 'recording'
    };

    this.recordings.set(id, recording);
    await this.saveRecording(recording);

    return recording;
  }

  async stopRecording(id) {
    const recording = this.recordings.get(id);
    if (!recording) throw new Error(`Recording not found: ${id}`);

    recording.status = 'completed';
    recording.completedAt = new Date().toISOString();
    recording.duration = new Date(recording.completedAt) - new Date(recording.startedAt);

    this.recordings.set(id, recording);
    await this.saveRecording(recording);

    return recording;
  }

  async pauseRecording(id) {
    const recording = this.recordings.get(id);
    if (!recording) throw new Error(`Recording not found: ${id}`);

    recording.status = 'paused';
    recording.pausedAt = new Date().toISOString();

    this.recordings.set(id, recording);
    await this.saveRecording(recording);

    return recording;
  }

  async resumeRecording(id) {
    const recording = this.recordings.get(id);
    if (!recording) throw new Error(`Recording not found: ${id}`);

    recording.status = 'recording';
    recording.resumedAt = new Date().toISOString();

    this.recordings.set(id, recording);
    await this.saveRecording(recording);

    return recording;
  }

  async takeScreenshot(params = {}) {
    const {
      mode = 'full',
      region = null,
      windowId = null,
      format = 'png',
      quality = 90,
      name = null
    } = params;

    const id = uuidv4();
    const timestamp = Date.now();
    const filename = `screenshot_${timestamp}.${format}`;
    const filePath = path.join(this.recordingDir, 'screenshots', filename);

    const screenshot = {
      id,
      name: name || `Screenshot ${id.slice(0, 8)}`,
      filename,
      filePath,
      mode,
      region,
      windowId,
      format,
      quality,
      dimensions: { width: 1920, height: 1080 },
      size: 0,
      type: 'screenshot',
      createdAt: new Date().toISOString()
    };

    this.screenshots.set(id, screenshot);
    await this.saveScreenshot(screenshot);

    return screenshot;
  }

  async annotateScreenshot(id, annotations) {
    const screenshot = this.screenshots.get(id);
    if (!screenshot) throw new Error(`Screenshot not found: ${id}`);

    const annotated = {
      ...screenshot,
      annotations: annotations.map(a => ({
        id: uuidv4(),
        type: a.type,
        position: a.position,
        size: a.size,
        color: a.color || '#FF0000',
        text: a.text || '',
        style: a.style || 'solid'
      })),
      annotatedAt: new Date().toISOString()
    };

    this.screenshots.set(id, annotated);
    await this.saveScreenshot(annotated);

    return annotated;
  }

  async getRecording(id) {
    return this.recordings.get(id);
  }

  async listRecordings(limit = 50) {
    return Array.from(this.recordings.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async deleteRecording(id) {
    const recording = this.recordings.get(id);
    if (recording && recording.filePath) {
      await fs.remove(recording.filePath).catch(() => {});
    }
    this.recordings.delete(id);
    return { success: true };
  }

  async getScreenshot(id) {
    return this.screenshots.get(id);
  }

  async listScreenshots(limit = 50) {
    return Array.from(this.screenshots.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async deleteScreenshot(id) {
    const screenshot = this.screenshots.get(id);
    if (screenshot && screenshot.filePath) {
      await fs.remove(screenshot.filePath).catch(() => {});
    }
    this.screenshots.delete(id);
    return { success: true };
  }

  getRecordingModes() {
    return this.recordingModes;
  }

  getOutputFormats() {
    return this.outputFormats;
  }

  getQualitySettings() {
    return this.qualitySettings;
  }

  async getSettings() {
    return this.settings;
  }

  async updateSettings(updates) {
    this.settings = { ...this.settings, ...updates };
    return this.settings;
  }

  async getStats() {
    const recordings = Array.from(this.recordings.values());
    const screenshots = Array.from(this.screenshots.values());

    return {
      recordings: recordings.length,
      activeRecordings: recordings.filter(r => r.status === 'recording').length,
      screenshots: screenshots.length,
      totalDuration: recordings.reduce((sum, r) => sum + (r.duration || 0), 0),
      formats: this.outputFormats.length,
      qualityLevels: this.qualitySettings.length
    };
  }

  async saveRecording(recording) {
    const filePath = path.join(this.recordingDir, `recording-${recording.id}.json`);
    await fs.writeJson(filePath, recording, { spaces: 2 });
  }

  async saveScreenshot(screenshot) {
    const filePath = path.join(this.recordingDir, `screenshot-${screenshot.id}.json`);
    await fs.writeJson(filePath, screenshot, { spaces: 2 });
  }
}

module.exports = ScreenRecordingEngine;
