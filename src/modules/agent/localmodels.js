const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');

class LocalModelDetector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.detectedModels = new Map();
    this.modelConfigs = new Map();
    this.detectorDir = path.join(os.homedir(), '.pix/localmodels');

    this.modelDirectories = [
      { id: 'ollama', name: 'Ollama', path: path.join(os.homedir(), '.ollama/models'), type: 'ollama', icon: '🦙' },
      { id: 'lmstudio', name: 'LM Studio', path: path.join(os.homedir(), '.cache/lm-studio/models'), type: 'lmstudio', icon: ' Studio' },
      { id: 'gpt4all', name: 'GPT4All', path: path.join(os.homedir(), '.cache/gpt4all'), type: 'gpt4all', icon: '🤖' },
      { id: 'llamacpp', name: 'llama.cpp', path: path.join(os.homedir(), 'models'), type: 'llamacpp', icon: '🦙' },
      { id: 'kobold', name: 'KoboldCpp', path: path.join(os.homedir(), 'KoboldCpp/models'), type: 'kobold', icon: '🐉' },
      { id: 'text-generation', name: 'text-generation-webui', path: path.join(os.homedir(), 'text-generation-webui/models'), type: 'tgw', icon: '📝' },
      { id: 'huggingface', name: 'HuggingFace Cache', path: path.join(os.homedir(), '.cache/huggingface/hub'), type: 'huggingface', icon: '🤗' },
      { id: 'stable-diffusion', name: 'Stable Diffusion', path: path.join(os.homedir(), 'stable-diffusion-webui/models'), type: 'sd', icon: '🎨' },
      { id: 'comfyui', name: 'ComfyUI', path: path.join(os.homedir(), 'ComfyUI/models'), type: 'comfyui', icon: '🔧' },
      { id: 'local-folders', name: 'Custom Folders', paths: [], type: 'custom', icon: '📁' }
    ];

    this.knownModels = [
      { id: 'llama-2-7b', name: 'LLaMA 2 7B', family: 'llama', size: '4GB', capabilities: ['text', 'chat'], provider: 'meta' },
      { id: 'llama-2-13b', name: 'LLaMA 2 13B', family: 'llama', size: '8GB', capabilities: ['text', 'chat'], provider: 'meta' },
      { id: 'llama-2-70b', name: 'LLaMA 2 70B', family: 'llama', size: '40GB', capabilities: ['text', 'chat', 'reasoning'], provider: 'meta' },
      { id: 'llama-3-8b', name: 'LLaMA 3 8B', family: 'llama', size: '5GB', capabilities: ['text', 'chat', 'code'], provider: 'meta' },
      { id: 'llama-3-70b', name: 'LLaMA 3 70B', family: 'llama', size: '40GB', capabilities: ['text', 'chat', 'code', 'reasoning'], provider: 'meta' },
      { id: 'mistral-7b', name: 'Mistral 7B', family: 'mistral', size: '4GB', capabilities: ['text', 'chat', 'code'], provider: 'mistral' },
      { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', family: 'mixtral', size: '26GB', capabilities: ['text', 'chat', 'code', 'reasoning'], provider: 'mistral' },
      { id: 'codellama-7b', name: 'CodeLLaMA 7B', family: 'codellama', size: '4GB', capabilities: ['code', 'chat'], provider: 'meta' },
      { id: 'codellama-13b', name: 'CodeLLaMA 13B', family: 'codellama', size: '8GB', capabilities: ['code', 'chat'], provider: 'meta' },
      { id: 'codellama-34b', name: 'CodeLLaMA 34B', family: 'codellama', size: '20GB', capabilities: ['code', 'chat', 'reasoning'], provider: 'meta' },
      { id: 'phi-2', name: 'Phi-2', family: 'phi', size: '2GB', capabilities: ['text', 'chat', 'code'], provider: 'microsoft' },
      { id: 'phi-3-mini', name: 'Phi-3 Mini', family: 'phi', size: '2GB', capabilities: ['text', 'chat', 'code'], provider: 'microsoft' },
      { id: 'gemma-2b', name: 'Gemma 2B', family: 'gemma', size: '2GB', capabilities: ['text', 'chat'], provider: 'google' },
      { id: 'gemma-7b', name: 'Gemma 7B', family: 'gemma', size: '5GB', capabilities: ['text', 'chat', 'code'], provider: 'google' },
      { id: 'qwen-7b', name: 'Qwen 7B', family: 'qwen', size: '4GB', capabilities: ['text', 'chat', 'code'], provider: 'alibaba' },
      { id: 'vicuna-7b', name: 'Vicuna 7B', family: 'vicuna', size: '4GB', capabilities: ['text', 'chat'], provider: 'lmsys' },
      { id: 'vicuna-13b', name: 'Vicuna 13B', family: 'vicuna', size: '8GB', capabilities: ['text', 'chat'], provider: 'lmsys' },
      { id: 'dolphin-llama', name: 'Dolphin LLaMA', family: 'dolphin', size: '4GB', capabilities: ['text', 'chat', 'uncensored'], provider: 'openhermes' },
      { id: 'neural-chat', name: 'Neural Chat', family: 'neural', size: '4GB', capabilities: ['text', 'chat'], provider: 'intel' },
      { id: 'stablelm', name: 'StableLM', family: 'stablelm', size: '4GB', capabilities: ['text', 'chat', 'code'], provider: 'stability' },
      { id: 'yi-6b', name: 'Yi 6B', family: 'yi', size: '4GB', capabilities: ['text', 'chat'], provider: '01-ai' },
      { id: 'yi-34b', name: 'Yi 34B', family: 'yi', size: '20GB', capabilities: ['text', 'chat', 'reasoning'], provider: '01-ai' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', family: 'deepseek', size: '8GB', capabilities: ['code', 'chat'], provider: 'deepseek' },
      { id: 'openhermes-2.5', name: 'OpenHermes 2.5', family: 'hermes', size: '8GB', capabilities: ['text', 'chat', 'code'], provider: 'teknium' },
      { id: 'solar-10.7b', name: 'Solar 10.7B', family: 'solar', size: '6GB', capabilities: ['text', 'chat'], provider: 'upstage' },
      { id: 'zephyr-7b', name: 'Zephyr 7B', family: 'zephyr', size: '4GB', capabilities: ['text', 'chat'], provider: 'huggingface' },
      { id: 'nous-hermes', name: 'Nous Hermes', family: 'hermes', size: '8GB', capabilities: ['text', 'chat', 'code'], provider: 'nousresearch' },
      { id: 'starling', name: 'Starling', family: 'starling', size: '8GB', capabilities: ['text', 'chat'], provider: 'berkeley' },
      { id: 'tie-7b', name: 'TIE 7B', family: 'tie', size: '4GB', capabilities: ['text', 'chat'], provider: 'berkeley' },
      { id: 'falcon-7b', name: 'Falcon 7B', family: 'falcon', size: '4GB', capabilities: ['text', 'chat'], provider: 'tii' },
      { id: 'falcon-40b', name: 'Falcon 40B', family: 'falcon', size: '22GB', capabilities: ['text', 'chat', 'reasoning'], provider: 'tii' },
      { id: 'mpt-7b', name: 'MPT 7B', family: 'mpt', size: '4GB', capabilities: ['text', 'chat', 'code'], provider: 'mosaic' },
      { id: 'redpajama', name: 'RedPajama', family: 'redpajama', size: '4GB', capabilities: ['text', 'chat'], provider: 'together' },
      { id: 'baize-7b', name: 'Baize 7B', family: 'baize', size: '4GB', capabilities: ['text', 'chat'], provider: 'baize' },
      { id: 'alpaca-7b', name: 'Alpaca 7B', family: 'alpaca', size: '4GB', capabilities: ['text', 'chat'], provider: 'stanford' },
      { id: 'wizard-7b', name: 'Wizard 7B', family: 'wizard', size: '4GB', capabilities: ['text', 'chat', 'code'], provider: 'wizard' },
      { id: 'orca-2', name: 'Orca 2', family: 'orca', size: '7GB', capabilities: ['text', 'chat', 'reasoning'], provider: 'microsoft' },
      { id: 'phi-2-dpo', name: 'Phi-2 DPO', family: 'phi', size: '2GB', capabilities: ['text', 'chat', 'code'], provider: 'microsoft' },
      { id: 'stable-diffusion-xl', name: 'Stable Diffusion XL', family: 'sdxl', size: '7GB', capabilities: ['image'], provider: 'stability' },
      { id: 'stable-diffusion-3', name: 'Stable Diffusion 3', family: 'sd3', size: '12GB', capabilities: ['image'], provider: 'stability' },
      { id: 'dreamshaper', name: 'DreamShaper', family: 'dreamshaper', size: '2GB', capabilities: ['image'], provider: 'lykon' },
      { id: 'real-esrgan', name: 'Real-ESRGAN', family: 'esrgan', size: '100MB', capabilities: ['upscale'], provider: 'xinntao' },
      { id: 'whisper', name: 'Whisper', family: 'whisper', size: '3GB', capabilities: ['audio', 'transcription'], provider: 'openai' },
      { id: 'bark', name: 'Bark', family: 'bark', size: '5GB', capabilities: ['audio', 'tts'], provider: 'suno' },
      { id: 'coqui-tts', name: 'Coqui TTS', family: 'coqui', size: '1GB', capabilities: ['audio', 'tts'], provider: 'coqui' }
    ];

    this.capabilityMap = {
      'text': { name: 'Text Generation', icon: '📝', description: 'Generate and understand text' },
      'chat': { name: 'Chat/Conversation', icon: '💬', description: 'Conversational AI' },
      'code': { name: 'Code Generation', icon: '💻', description: 'Write and understand code' },
      'reasoning': { name: 'Reasoning', icon: '🧠', description: 'Complex reasoning and analysis' },
      'image': { name: 'Image Generation', icon: '🎨', description: 'Generate images from text' },
      'upscale': { name: 'Image Upscaling', icon: '🔍', description: 'Enhance image resolution' },
      'audio': { name: 'Audio Processing', icon: '🎵', description: 'Process audio files' },
      'transcription': { name: 'Transcription', icon: '🎙️', description: 'Speech to text' },
      'tts': { name: 'Text to Speech', icon: '🔊', description: 'Convert text to speech' },
      'uncensored': { name: 'Uncensored', icon: '🔓', description: 'Unrestricted responses' }
    };
  }

  async initialize() {
    this.logger.info('Initializing Local Model Detector...');
    await fs.ensureDir(this.detectorDir);
    await this.loadData();
    this.logger.info('Local Model Detector initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.detectorDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.detectorDir, file));
          if (data.type === 'model') this.detectedModels.set(data.id, data);
          else if (data.type === 'config') this.modelConfigs.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  async detectAllModels() {
    const detected = [];

    for (const dir of this.modelDirectories) {
      const paths = dir.paths || [dir.path];
      for (const dirPath of paths) {
        if (!await fs.pathExists(dirPath)) continue;

        try {
          const models = await this.scanDirectory(dirPath, dir.type);
          detected.push(...models);
        } catch (e) {}
      }
    }

    const ollamaModels = await this.detectOllamaModels();
    detected.push(...ollamaModels);

    for (const model of detected) {
      this.detectedModels.set(model.id, model);
    }

    return detected;
  }

  async scanDirectory(dirPath, sourceType) {
    const models = [];

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (!item.isDirectory()) continue;

        const itemPath = path.join(dirPath, item.name);
        const modelFiles = await this.findModelFiles(itemPath);

        if (modelFiles.length > 0) {
          const modelInfo = this.analyzeModelFiles(modelFiles, item.name);
          models.push({
            id: uuidv4(),
            name: item.name,
            path: itemPath,
            source: sourceType,
            files: modelFiles,
            ...modelInfo,
            detectedAt: new Date().toISOString()
          });
        }
      }
    } catch (e) {}

    return models;
  }

  async findModelFiles(dirPath) {
    const modelExtensions = ['.gguf', '.ggml', '.bin', '.safetensors', '.pt', '.pth', '.onnx', '.bin'];
    const files = [];

    try {
      const items = await fs.readdir(dirPath);
      for (const item of items) {
        const ext = path.extname(item).toLowerCase();
        if (modelExtensions.includes(ext)) {
          const filePath = path.join(dirPath, item);
          const stat = await fs.stat(filePath);
          files.push({
            name: item,
            path: filePath,
            size: stat.size,
            sizeFormatted: this.formatSize(stat.size),
            extension: ext
          });
        }
      }
    } catch (e) {}

    return files;
  }

  analyzeModelFiles(files, name) {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const primaryFile = files.find(f => f.name.toLowerCase().includes(name.toLowerCase())) || files[0];

    let family = 'unknown';
    const nameLower = name.toLowerCase();
    if (nameLower.includes('llama')) family = 'llama';
    else if (nameLower.includes('mistral') || nameLower.includes('mixtral')) family = 'mistral';
    else if (nameLower.includes('codellama')) family = 'codellama';
    else if (nameLower.includes('phi')) family = 'phi';
    else if (nameLower.includes('gemma')) family = 'gemma';
    else if (nameLower.includes('qwen')) family = 'qwen';
    else if (nameLower.includes('deepseek')) family = 'deepseek';
    else if (nameLower.includes('stable') || nameLower.includes('sdxl') || nameLower.includes('sd')) family = 'sdxl';
    else if (nameLower.includes('whisper')) family = 'whisper';
    else if (nameLower.includes('bark')) family = 'bark';

    const capabilities = this.inferCapabilities(nameLower, family);

    return {
      family,
      size: totalSize,
      sizeFormatted: this.formatSize(totalSize),
      primaryFile: primaryFile?.path,
      capabilities,
      quantization: this.detectQuantization(name),
      parameters: this.detectParameters(name)
    };
  }

  inferCapabilities(name, family) {
    const caps = ['text'];

    if (['llama', 'mistral', 'mixtral', 'phi', 'gemma', 'qwen', 'vicuna', 'dolphin', 'neural', 'stablelm', 'yi', 'hermes', 'solar', 'zephyr', 'starling', 'falcon', 'mpt', 'redpajama', 'baize', 'alpaca', 'wizard', 'orca'].includes(family)) {
      caps.push('chat');
    }

    if (['codellama', 'deepseek', 'mpt'].includes(family) || name.includes('code')) {
      caps.push('code');
    }

    if (['mixtral', 'llama', 'yi', 'falcon'].includes(family)) {
      caps.push('reasoning');
    }

    if (['sdxl', 'sd3', 'dreamshaper'].includes(family)) {
      return ['image'];
    }

    if (family === 'whisper') return ['audio', 'transcription'];
    if (family === 'bark') return ['audio', 'tts'];

    return caps;
  }

  detectQuantization(name) {
    const nameLower = name.toLowerCase();
    const quantPatterns = ['q2_k', 'q3_k', 'q4_0', 'q4_k', 'q5_0', 'q5_k', 'q6_k', 'q8_0', 'f16', 'f32'];

    for (const q of quantPatterns) {
      if (nameLower.includes(q)) return q.toUpperCase();
    }

    if (nameLower.includes('gptq')) return 'GPTQ';
    if (nameLower.includes('awq')) return 'AWQ';
    if (nameLower.includes('gguf')) return 'GGUF';
    if (nameLower.includes('ggml')) return 'GGML';

    return 'unknown';
  }

  detectParameters(name) {
    const nameLower = name.toLowerCase();
    const patterns = [
      { regex: /(\d+\.?\d*)[bB]/, extract: (m) => m[1] + 'B' },
      { regex: /(\d+\.?\d*)\s*billion/i, extract: (m) => m[1] + 'B' },
      { regex: /(\d+\.?\d*)m/i, extract: (m) => m[1] + 'M' }
    ];

    for (const pattern of patterns) {
      const match = nameLower.match(pattern.regex);
      if (match) return pattern.extract(match);
    }

    return 'unknown';
  }

  async detectOllamaModels() {
    const models = [];

    try {
      const output = execSync('ollama list 2>/dev/null || echo ""').toString();
      const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('NAME'));

      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          models.push({
            id: uuidv4(),
            name: parts[0],
            source: 'ollama',
            path: path.join(os.homedir(), '.ollama/models', parts[0]),
            family: this.guessFamily(parts[0]),
            sizeFormatted: parts[2] || 'unknown',
            capabilities: ['text', 'chat'],
            detectedAt: new Date().toISOString()
          });
        }
      }
    } catch (e) {}

    return models;
  }

  guessFamily(name) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('llama')) return 'llama';
    if (nameLower.includes('mistral') || nameLower.includes('mixtral')) return 'mistral';
    if (nameLower.includes('codellama')) return 'codellama';
    if (nameLower.includes('phi')) return 'phi';
    if (nameLower.includes('gemma')) return 'gemma';
    if (nameLower.includes('qwen')) return 'qwen';
    if (nameLower.includes('deepseek')) return 'deepseek';
    if (nameLower.includes('stable')) return 'stable';
    return 'unknown';
  }

  async wireUpModel(params) {
    const { modelId, port = 11434, host = 'localhost', autoStart = true } = params;
    const model = this.detectedModels.get(modelId);
    if (!model) throw new Error(`Model not found: ${modelId}`);

    const config = {
      id: uuidv4(),
      modelId,
      modelName: model.name,
      source: model.source,
      port,
      host,
      autoStart,
      status: 'configured',
      endpoint: `http://${host}:${port}`,
      type: 'config',
      createdAt: new Date().toISOString()
    };

    this.modelConfigs.set(config.id, config);
    await this.saveConfig(config);

    return config;
  }

  async getModelRecommendations(task) {
    const taskLower = task.toLowerCase();
    const models = Array.from(this.detectedModels.values());

    const scored = models.map(model => {
      let score = 50;

      if (taskLower.includes('code') && model.capabilities?.includes('code')) score += 30;
      if (taskLower.includes('chat') && model.capabilities?.includes('chat')) score += 20;
      if (taskLower.includes('reason') && model.capabilities?.includes('reasoning')) score += 25;
      if (taskLower.includes('image') && model.capabilities?.includes('image')) score += 30;
      if (taskLower.includes('audio') && model.capabilities?.includes('audio')) score += 30;

      if (model.size && model.size < 5 * 1024 * 1024 * 1024) score += 10;

      return { ...model, score };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  async getSystemInfo() {
    const info = {
      platform: os.platform(),
      arch: os.arch(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      gpu: await this.detectGPU()
    };

    return info;
  }

  async detectGPU() {
    try {
      const output = execSync('system_profiler SPDisplaysDataType 2>/dev/null || echo "No GPU detected"').toString();
      return output;
    } catch (e) {
      return 'GPU detection not available';
    }
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async getDetectedModels() {
    return Array.from(this.detectedModels.values());
  }

  async getModelConfigs() {
    return Array.from(this.modelConfigs.values());
  }

  getCapabilityMap() {
    return this.capabilityMap;
  }

  getModelDirectories() {
    return this.modelDirectories;
  }

  async getStats() {
    const models = Array.from(this.detectedModels.values());
    const configs = Array.from(this.modelConfigs.values());

    return {
      detectedModels: models.length,
      configuredModels: configs.length,
      totalSize: models.reduce((sum, m) => sum + (m.size || 0), 0),
      bySource: {
        ollama: models.filter(m => m.source === 'ollama').length,
        lmstudio: models.filter(m => m.source === 'lmstudio').length,
        gpt4all: models.filter(m => m.source === 'gpt4all').length,
        huggingface: models.filter(m => m.source === 'huggingface').length,
        other: models.filter(m => !['ollama', 'lmstudio', 'gpt4all', 'huggingface'].includes(m.source)).length
      },
      byCapability: {
        text: models.filter(m => m.capabilities?.includes('text')).length,
        chat: models.filter(m => m.capabilities?.includes('chat')).length,
        code: models.filter(m => m.capabilities?.includes('code')).length,
        image: models.filter(m => m.capabilities?.includes('image')).length,
        audio: models.filter(m => m.capabilities?.includes('audio')).length
      }
    };
  }

  async saveModel(model) {
    const filePath = path.join(this.detectorDir, `model-${model.id}.json`);
    await fs.writeJson(filePath, model, { spaces: 2 });
  }

  async saveConfig(config) {
    const filePath = path.join(this.detectorDir, `config-${config.id}.json`);
    await fs.writeJson(filePath, config, { spaces: 2 });
  }

  async exportDetector(format = 'json') {
    const data = {
      models: Array.from(this.detectedModels.values()),
      configs: Array.from(this.modelConfigs.values()),
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = LocalModelDetector;
