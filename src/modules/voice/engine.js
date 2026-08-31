const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class VoiceEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.isListening = false;
    this.isSpeaking = false;
    this.recognition = null;
    this.synthesis = null;
    this.voiceCommands = new Map();
    this.conversationHistory = [];
    this.eventEmitter = new EventEmitter();
    this.audioDir = path.join(os.homedir(), '.pix/audio');
  }

  async initialize() {
    this.logger.info('Initializing Voice Engine...');
    await fs.ensureDir(this.audioDir);
    this.loadDefaultCommands();
    this.logger.info('Voice Engine initialized');
  }

  loadDefaultCommands() {
    const commands = [
      { trigger: 'hey pix', action: 'activate', description: 'Activate Pix assistant' },
      { trigger: 'take screenshot', action: 'screenshot', description: 'Take a screenshot' },
      { trigger: 'open app', action: 'openApp', description: 'Open an application', params: ['appName'] },
      { trigger: 'close app', action: 'closeApp', description: 'Close an application', params: ['appName'] },
      { trigger: 'run code', action: 'runCode', description: 'Execute code in sandbox' },
      { trigger: 'search for', action: 'search', description: 'Search the web', params: ['query'] },
      { trigger: 'what time is it', action: 'time', description: 'Get current time' },
      { trigger: 'what is the weather', action: 'weather', description: 'Get weather info', params: ['location'] },
      { trigger: 'scroll up', action: 'scrollUp', description: 'Scroll up' },
      { trigger: 'scroll down', action: 'scrollDown', description: 'Scroll down' },
      { trigger: 'click', action: 'click', description: 'Click at position', params: ['x', 'y'] },
      { trigger: 'type', action: 'type', description: 'Type text', params: ['text'] },
      { trigger: 'stop listening', action: 'stopListening', description: 'Stop voice recognition' },
      { trigger: 'repeat', action: 'repeat', description: 'Repeat last response' },
      { trigger: 'help', action: 'help', description: 'Show available commands' }
    ];

    commands.forEach(cmd => {
      this.voiceCommands.set(cmd.trigger.toLowerCase(), cmd);
    });
  }

  async startListening(options = {}) {
    if (this.isListening) return;

    this.isListening = true;
    this.logger.info('Voice recognition started');

    const {
      language = 'en-US',
      continuous = true,
      interimResults = true,
      maxAlternatives = 1
    } = options;

    this.eventEmitter.emit('listening:start', { language, continuous });

    return {
      success: true,
      message: 'Voice recognition started',
      language,
      continuous
    };
  }

  async stopListening() {
    this.isListening = false;
    this.logger.info('Voice recognition stopped');
    this.eventEmitter.emit('listening:stop');
    return { success: true };
  }

  async processVoiceInput(transcript) {
    const normalizedTranscript = transcript.toLowerCase().trim();
    this.logger.info(`Processing voice input: "${transcript}"`);

    this.conversationHistory.push({
      role: 'user',
      content: transcript,
      timestamp: new Date().toISOString()
    });

    const matchedCommand = this.matchCommand(normalizedTranscript);

    if (matchedCommand) {
      const result = await this.executeCommand(matchedCommand, normalizedTranscript);
      return {
        type: 'command',
        command: matchedCommand,
        transcript,
        result
      };
    }

    return {
      type: 'conversation',
      transcript,
      response: await this.generateResponse(transcript)
    };
  }

  matchCommand(transcript) {
    for (const [trigger, command] of this.voiceCommands) {
      if (transcript.includes(trigger)) {
        return { ...command, matchedTrigger: trigger };
      }
    }
    return null;
  }

  async executeCommand(command, transcript) {
    this.logger.info(`Executing command: ${command.action}`);

    switch (command.action) {
      case 'activate':
        return { message: 'Yes, how can I help you?' };

      case 'screenshot':
        return { action: 'screenshot', message: 'Taking screenshot...' };

      case 'openApp':
        const appName = this.extractParam(transcript, 'open app');
        return { action: 'openApp', appName, message: `Opening ${appName}...` };

      case 'closeApp':
        const closeAppName = this.extractParam(transcript, 'close app');
        return { action: 'closeApp', appName: closeAppName, message: `Closing ${closeAppName}...` };

      case 'runCode':
        return { action: 'runCode', message: 'Running code in sandbox...' };

      case 'search':
        const query = this.extractParam(transcript, 'search for');
        return { action: 'search', query, message: `Searching for ${query}...` };

      case 'time':
        const time = new Date().toLocaleTimeString();
        return { message: `The current time is ${time}` };

      case 'weather':
        const location = this.extractParam(transcript, 'weather') || 'current location';
        return { action: 'weather', location, message: `Getting weather for ${location}...` };

      case 'scrollUp':
        return { action: 'scroll', direction: 'up', message: 'Scrolling up...' };

      case 'scrollDown':
        return { action: 'scroll', direction: 'down', message: 'Scrolling down...' };

      case 'click':
        return { action: 'click', message: 'Clicking...' };

      case 'type':
        const text = this.extractParam(transcript, 'type');
        return { action: 'type', text, message: `Typing: ${text}` };

      case 'stopListening':
        await this.stopListening();
        return { message: 'Stopped listening' };

      case 'repeat':
        const lastResponse = this.conversationHistory
          .filter(h => h.role === 'assistant')
          .pop();
        return { message: lastResponse?.content || 'Nothing to repeat' };

      case 'help':
        return {
          message: 'Available commands: ' +
            Array.from(this.voiceCommands.values())
              .map(c => c.description)
              .join(', ')
        };

      default:
        return { message: 'Unknown command' };
    }
  }

  extractParam(transcript, trigger) {
    const index = transcript.indexOf(trigger);
    if (index === -1) return null;
    return transcript.substring(index + trigger.length).trim();
  }

  async generateResponse(input) {
    const responses = [
      `I heard you say: "${input}"`,
      `Let me help you with that.`,
      `I'm processing your request.`,
      `That's interesting. Tell me more.`,
      `I'll work on that for you.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  async speak(text, options = {}) {
    const {
      voice = null,
      rate = 1,
      pitch = 1,
      volume = 1
    } = options;

    this.isSpeaking = true;
    this.logger.info(`Speaking: "${text.substring(0, 50)}..."`);

    this.conversationHistory.push({
      role: 'assistant',
      content: text,
      timestamp: new Date().toISOString()
    });

    this.eventEmitter.emit('speech:start', { text, options });

    await new Promise(resolve => setTimeout(resolve, text.length * 50));

    this.isSpeaking = false;
    this.eventEmitter.emit('speech:end');

    return { success: true };
  }

  async translate(text, targetLanguage) {
    this.logger.info(`Translating to ${targetLanguage}: "${text.substring(0, 30)}..."`);
    return {
      original: text,
      translated: `[${targetLanguage}] ${text}`,
      sourceLanguage: 'auto',
      targetLanguage
    };
  }

  async transcribe(audioData) {
    this.logger.info('Transcribing audio...');
    return {
      text: 'Transcribed text would appear here',
      confidence: 0.95,
      language: 'en-US'
    };
  }

  async detectLanguage(text) {
    const languages = {
      'en': ['hello', 'hi', 'the', 'is', 'are'],
      'es': ['hola', 'buenos', 'días', 'el', 'la'],
      'fr': ['bonjour', 'salut', 'le', 'la', 'les'],
      'de': ['hallo', 'guten', 'tag', 'der', 'die'],
      'ja': ['こんにちは', 'はい', 'いいえ', 'です'],
      'zh': ['你好', '是', '不', '的']
    };

    const words = text.toLowerCase().split(' ');
    const scores = {};

    for (const [lang, keywords] of Object.entries(languages)) {
      scores[lang] = words.filter(w => keywords.includes(w)).length;
    }

    const detected = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return {
      language: detected[0],
      confidence: detected[1] > 0 ? 0.8 : 0.2
    };
  }

  addVoiceCommand(trigger, action, description, params = []) {
    this.voiceCommands.set(trigger.toLowerCase(), {
      trigger,
      action,
      description,
      params
    });
  }

  removeVoiceCommand(trigger) {
    this.voiceCommands.delete(trigger.toLowerCase());
  }

  getVoiceCommands() {
    return Array.from(this.voiceCommands.values());
  }

  getConversationHistory() {
    return this.conversationHistory;
  }

  clearConversationHistory() {
    this.conversationHistory = [];
  }

  getStatus() {
    return {
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      commandCount: this.voiceCommands.size,
      historyLength: this.conversationHistory.length
    };
  }
}

module.exports = VoiceEngine;
