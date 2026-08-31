const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class VoiceInputOutputEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.recordings = new Map();
    this.transcriptions = new Map();
    this.syntheses = new Map();
    this.voiceDir = path.join(os.homedir(), '.pix/voice');

    this.voiceCommands = [
      { id: 'hey-pix', phrase: 'Hey Pix', action: 'activate', description: 'Activate voice mode' },
      { id: 'stop-listening', phrase: 'Stop listening', action: 'deactivate', description: 'Deactivate voice mode' },
      { id: 'think-about', phrase: 'Think about', action: 'think', description: 'Deep thinking mode' },
      { id: 'research', phrase: 'Research', action: 'research', description: 'Research a topic' },
      { id: 'build', phrase: 'Build', action: 'build', description: 'Build something' },
      { id: 'run', phrase: 'Run', action: 'execute', description: 'Execute a command' },
      { id: 'open', phrase: 'Open', action: 'open', description: 'Open a file or app' },
      { id: 'close', phrase: 'Close', action: 'close', description: 'Close current item' },
      { id: 'save', phrase: 'Save', action: 'save', description: 'Save current work' },
      { id: 'undo', phrase: 'Undo', action: 'undo', description: 'Undo last action' },
      { id: 'redo', phrase: 'Redo', action: 'redo', description: 'Redo last action' },
      { id: 'help', phrase: 'Help', action: 'help', description: 'Show help' },
      { id: 'clear', phrase: 'Clear', action: 'clear', description: 'Clear screen' },
      { id: 'exit', phrase: 'Exit', action: 'exit', description: 'Exit current mode' }
    ];

    this.languages = [
      { id: 'en-US', name: 'English (US)', code: 'en-US', quality: 'high' },
      { id: 'en-GB', name: 'English (UK)', code: 'en-GB', quality: 'high' },
      { id: 'es-ES', name: 'Spanish', code: 'es-ES', quality: 'high' },
      { id: 'fr-FR', name: 'French', code: 'fr-FR', quality: 'high' },
      { id: 'de-DE', name: 'German', code: 'de-DE', quality: 'high' },
      { id: 'it-IT', name: 'Italian', code: 'it-IT', quality: 'high' },
      { id: 'pt-BR', name: 'Portuguese', code: 'pt-BR', quality: 'high' },
      { id: 'ja-JP', name: 'Japanese', code: 'ja-JP', quality: 'medium' },
      { id: 'ko-KR', name: 'Korean', code: 'ko-KR', quality: 'medium' },
      { id: 'zh-CN', name: 'Chinese', code: 'zh-CN', quality: 'medium' },
      { id: 'hi-IN', name: 'Hindi', code: 'hi-IN', quality: 'medium' },
      { id: 'ar-SA', name: 'Arabic', code: 'ar-SA', quality: 'medium' },
      { id: 'ru-RU', name: 'Russian', code: 'ru-RU', quality: 'medium' },
      { id: 'nl-NL', name: 'Dutch', code: 'nl-NL', quality: 'high' },
      { id: 'sv-SE', name: 'Swedish', code: 'sv-SE', quality: 'high' }
    ];

    this.ttsVoices = [
      { id: 'default', name: 'Default', gender: 'neutral', quality: 'standard' },
      { id: 'male-1', name: 'Male 1', gender: 'male', quality: 'natural' },
      { id: 'female-1', name: 'Female 1', gender: 'female', quality: 'natural' },
      { id: 'male-2', name: 'Male 2', gender: 'male', quality: 'premium' },
      { id: 'female-2', name: 'Female 2', gender: 'female', quality: 'premium' },
      { id: 'child', name: 'Child', gender: 'neutral', quality: 'natural' },
      { id: 'elder', name: 'Elder', gender: 'neutral', quality: 'natural' }
    ];

    this.recognitionEngines = [
      { id: 'whisper', name: 'Whisper', type: 'local', quality: 'excellent', speed: 'medium', languages: 'all' },
      { id: 'google', name: 'Google Speech', type: 'cloud', quality: 'good', speed: 'fast', languages: 'many' },
      { id: 'azure', name: 'Azure Speech', type: 'cloud', quality: 'excellent', speed: 'fast', languages: 'many' },
      { id: 'aws', name: 'AWS Transcribe', type: 'cloud', quality: 'good', speed: 'fast', languages: 'many' },
      { id: 'vosk', name: 'Vosk', type: 'local', quality: 'good', speed: 'fast', languages: 'many' },
      { id: 'deepspeech', name: 'DeepSpeech', type: 'local', quality: 'fair', speed: 'medium', languages: 'limited' }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Voice Input/Output Engine...');
    await fs.ensureDir(this.voiceDir);
    await fs.ensureDir(path.join(this.voiceDir, 'recordings'));
    await fs.ensureDir(path.join(this.voiceDir, 'transcriptions'));
    await this.loadData();
    this.loadSettings();
    this.logger.info('Voice Input/Output Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.voiceDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.voiceDir, file));
          if (data.type === 'recording') this.recordings.set(data.id, data);
          else if (data.type === 'transcription') this.transcriptions.set(data.id, data);
          else if (data.type === 'synthesis') this.syntheses.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadSettings() {
    this.settings = {
      enabled: false,
      language: 'en-US',
      voice: 'default',
      engine: 'whisper',
      autoDetect: true,
      continuous: false,
      wakeWord: 'Hey Pix',
      volume: 0.8,
      speed: 1.0,
      pitch: 1.0,
      noiseReduction: true,
      echoCancellation: true,
      autoStop: true,
      confidenceThreshold: 0.7,
      maxRecordingLength: 300
    };
  }

  async startRecording(params = {}) {
    const { language = this.settings.language, duration = 30 } = params;

    const id = uuidv4();
    const recording = {
      id,
      language,
      duration,
      status: 'recording',
      startedAt: new Date().toISOString(),
      audioData: null,
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
    recording.actualDuration = new Date(recording.completedAt) - new Date(recording.startedAt);

    this.recordings.set(id, recording);
    await this.saveRecording(recording);

    return recording;
  }

  async transcribe(params) {
    const { recordingId, language = this.settings.language, engine = this.settings.engine } = params;

    const id = uuidv4();
    const transcription = {
      id,
      recordingId,
      language,
      engine,
      text: '',
      confidence: 0,
      words: [],
      segments: [],
      status: 'processing',
      type: 'transcription'
    };

    this.transcriptions.set(id, transcription);
    await this.saveTranscription(transcription);

    return transcription;
  }

  async synthesizeSpeech(params) {
    const { text, voice = this.settings.voice, speed = this.settings.speed, pitch = this.settings.pitch } = params;

    const id = uuidv4();
    const synthesis = {
      id,
      text,
      voice,
      speed,
      pitch,
      status: 'processing',
      audioData: null,
      duration: 0,
      type: 'synthesis'
    };

    this.syntheses.set(id, synthesis);
    await this.saveSynthesis(synthesis);

    return synthesis;
  }

  async processVoiceInput(params) {
    const { audioData, language = this.settings.language } = params;

    const command = this.detectVoiceCommand(audioData);

    if (command) {
      return {
        type: 'command',
        command,
        text: audioData,
        confidence: 0.9
      };
    }

    return {
      type: 'speech',
      text: audioData,
      language,
      confidence: 0.85
    };
  }

  detectVoiceCommand(text) {
    const textLower = text.toLowerCase();

    for (const cmd of this.voiceCommands) {
      if (textLower.includes(cmd.phrase.toLowerCase())) {
        return cmd;
      }
    }

    return null;
  }

  async getRecordings() {
    return Array.from(this.recordings.values());
  }

  async getTranscriptions() {
    return Array.from(this.transcriptions.values());
  }

  async getSyntheses() {
    return Array.from(this.syntheses.values());
  }

  getVoiceCommands() {
    return this.voiceCommands;
  }

  getLanguages() {
    return this.languages;
  }

  getTTSVoices() {
    return this.ttsVoices;
  }

  getRecognitionEngines() {
    return this.recognitionEngines;
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
    const transcriptions = Array.from(this.transcriptions.values());
    const syntheses = Array.from(this.syntheses.values());

    return {
      recordings: recordings.length,
      transcriptions: transcriptions.length,
      syntheses: syntheses.length,
      totalDuration: recordings.reduce((sum, r) => sum + (r.actualDuration || 0), 0),
      languages: this.languages.length,
      voices: this.ttsVoices.length,
      engines: this.recognitionEngines.length
    };
  }

  async saveRecording(recording) {
    const filePath = path.join(this.voiceDir, `recording-${recording.id}.json`);
    await fs.writeJson(filePath, recording, { spaces: 2 });
  }

  async saveTranscription(transcription) {
    const filePath = path.join(this.voiceDir, `transcription-${transcription.id}.json`);
    await fs.writeJson(filePath, transcription, { spaces: 2 });
  }

  async saveSynthesis(synthesis) {
    const filePath = path.join(this.voiceDir, `synthesis-${synthesis.id}.json`);
    await fs.writeJson(filePath, synthesis, { spaces: 2 });
  }
}

module.exports = VoiceInputOutputEngine;
