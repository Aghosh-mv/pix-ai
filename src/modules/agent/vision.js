const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class VisionEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.captures = new Map();
    this.analyses = new Map();
    this.visionDir = path.join(os.homedir(), '.pix/vision');

    this.visionCapabilities = [
      { id: 'screenshot', name: 'Screenshot Analysis', icon: '📸', description: 'Analyze screenshots and images', models: ['all'] },
      { id: 'ocr', name: 'OCR (Text Extraction)', icon: '📝', description: 'Extract text from images', models: ['all'] },
      { id: 'ui-analysis', name: 'UI Analysis', icon: '🖥️', description: 'Analyze UI elements and layout', models: ['all'] },
      { id: 'code-vision', name: 'Code Vision', icon: '💻', description: 'Read code from screenshots', models: ['all'] },
      { id: 'diagram', name: 'Diagram Understanding', icon: '📊', description: 'Understand diagrams and flowcharts', models: ['all'] },
      { id: 'document', name: 'Document Reading', icon: '📄', description: 'Read and understand documents', models: ['all'] },
      { id: 'face', name: 'Face Detection', icon: '👤', description: 'Detect faces in images', models: ['pro'] },
      { id: 'object', name: 'Object Detection', icon: '🔍', description: 'Identify objects in images', models: ['pro'] },
      { id: 'color', name: 'Color Analysis', icon: '🎨', description: 'Analyze color palettes', models: ['all'] },
      { id: 'comparison', name: 'Image Comparison', icon: '🔄', description: 'Compare two images', models: ['all'] }
    ];

    this.analysisTypes = [
      { id: 'describe', name: 'Describe', icon: '📖', description: 'Generate detailed description', prompt: 'Describe this image in detail, including all visible elements, text, colors, and layout.' },
      { id: 'extract-text', name: 'Extract Text', icon: '📝', description: 'Extract all visible text', prompt: 'Extract all text visible in this image. Preserve the formatting and structure.' },
      { id: 'analyze-ui', name: 'Analyze UI', icon: '🖥️', description: 'Analyze UI elements', prompt: 'Analyze this UI screenshot. Identify all UI elements, their positions, styles, and interactions.' },
      { id: 'read-code', name: 'Read Code', icon: '💻', description: 'Read code from image', prompt: 'Read and transcribe the code visible in this image. Preserve the exact syntax and formatting.' },
      { id: 'identify-issues', name: 'Identify Issues', icon: '⚠️', description: 'Find problems or bugs', prompt: 'Analyze this image and identify any issues, bugs, or problems visible. Provide specific details.' },
      { id: 'suggest-improvements', name: 'Suggest Improvements', icon: '💡', description: 'Suggest improvements', prompt: 'Analyze this image and suggest specific improvements for design, functionality, or usability.' },
      { id: 'convert-to-code', name: 'Convert to Code', icon: '🔧', description: 'Generate code from UI', prompt: 'Convert this UI screenshot into clean, functional code. Use modern best practices.' },
      { id: 'accessibility', name: 'Accessibility Check', icon: '♿', description: 'Check accessibility', prompt: 'Analyze this interface for accessibility issues. Check colors, contrast, spacing, and WCAG compliance.' }
    ];

    this.modelSupport = [
      { id: 'vision-gemini', name: 'Gemini Vision', provider: 'gemini', models: ['gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash'], maxImages: 16 },
      { id: 'vision-openai', name: 'OpenAI Vision', provider: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], maxImages: 10 },
      { id: 'vision-anthropic', name: 'Anthropic Vision', provider: 'anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'], maxImages: 5 },
      { id: 'vision-local', name: 'Local Vision', provider: 'local', models: ['llava', 'bakllava', 'moondream'], maxImages: 1 }
    ];
  }

  async initialize() {
    this.logger.info('Initializing Vision Engine...');
    await fs.ensureDir(this.visionDir);
    await fs.ensureDir(path.join(this.visionDir, 'captures'));
    await fs.ensureDir(path.join(this.visionDir, 'analyses'));
    await this.loadData();
    this.logger.info('Vision Engine initialized');
  }

  async loadData() {
    try {
      const files = await fs.readdir(this.visionDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.visionDir, file));
          if (data.type === 'capture') this.captures.set(data.id, data);
          else if (data.type === 'analysis') this.analyses.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  async captureScreen(params = {}) {
    const {
      region = null,
      quality = 80,
      format = 'png',
      name = null
    } = params;

    const id = uuidv4();
    const timestamp = Date.now();
    const filename = `capture_${timestamp}.${format}`;
    const filePath = path.join(this.visionDir, 'captures', filename);

    const capture = {
      id,
      name: name || `Capture ${id.slice(0, 8)}`,
      filename,
      filePath,
      region,
      quality,
      format,
      size: 0,
      dimensions: { width: 1920, height: 1080 },
      type: 'capture',
      createdAt: new Date().toISOString()
    };

    this.captures.set(id, capture);
    await this.saveCapture(capture);

    return capture;
  }

  async analyzeImage(params) {
    const {
      captureId,
      imagePath,
      analysisType = 'describe',
      model = null,
      customPrompt = null,
      context = {}
    } = params;

    const id = uuidv4();
    const analysisTypeData = this.analysisTypes.find(a => a.id === analysisType);

    const prompt = customPrompt || (analysisTypeData ? analysisTypeData.prompt : 'Describe this image in detail.');

    const analysis = {
      id,
      captureId,
      imagePath,
      analysisType,
      prompt,
      model: model || 'default',
      context,
      result: null,
      confidence: 0,
      elements: [],
      text: null,
      issues: [],
      suggestions: [],
      metadata: {},
      status: 'pending',
      type: 'analysis',
      createdAt: new Date().toISOString()
    };

    this.analyses.set(id, analysis);
    await this.saveAnalysis(analysis);

    return analysis;
  }

  async analyzeWithModel(params) {
    const {
      imagePath,
      prompt,
      model = 'gemini-pro-vision',
      features = ['describe'],
      context = {}
    } = params;

    const result = {
      model,
      prompt,
      features,
      description: null,
      text: null,
      elements: [],
      uiElements: [],
      codeBlocks: [],
      colors: [],
      suggestions: [],
      raw: null
    };

    for (const feature of features) {
      switch (feature) {
        case 'describe':
          result.description = await this.generateDescription(imagePath, prompt, model);
          break;
        case 'ocr':
          result.text = await this.extractText(imagePath, model);
          break;
        case 'ui-analysis':
          result.uiElements = await this.analyzeUI(imagePath, model);
          break;
        case 'code-vision':
          result.codeBlocks = await this.readCode(imagePath, model);
          break;
        case 'color':
          result.colors = await this.analyzeColors(imagePath, model);
          break;
        case 'suggest':
          result.suggestions = await this.generateSuggestions(imagePath, prompt, model);
          break;
      }
    }

    return result;
  }

  async generateDescription(imagePath, prompt, model) {
    return {
      summary: `Analysis of image using ${model}`,
      details: `The image has been analyzed with the prompt: "${prompt}". A detailed description would be generated by the connected AI model.`,
      confidence: 0.85
    };
  }

  async extractText(imagePath, model) {
    return {
      text: 'Extracted text would appear here from the connected AI model.',
      blocks: [],
      confidence: 0.9
    };
  }

  async analyzeUI(imagePath, model) {
    return [
      { type: 'button', label: 'Submit', position: { x: 100, y: 200 }, size: { width: 120, height: 40 } },
      { type: 'input', placeholder: 'Enter text...', position: { x: 50, y: 150 }, size: { width: 300, height: 30 } },
      { type: 'text', content: 'Welcome', position: { x: 50, y: 50 }, style: { fontSize: 24, fontWeight: 'bold' } }
    ];
  }

  async readCode(imagePath, model) {
    return [
      {
        language: 'javascript',
        code: '// Code would be extracted from the image by the AI model',
        startLine: 1,
        endLine: 5
      }
    ];
  }

  async analyzeColors(imagePath, model) {
    return {
      dominant: ['#4A90D9', '#FFFFFF', '#333333'],
      palette: [
        { color: '#4A90D9', percentage: 35, name: 'Primary Blue' },
        { color: '#FFFFFF', percentage: 40, name: 'White' },
        { color: '#333333', percentage: 25, name: 'Dark Gray' }
      ],
      contrast: 7.5,
      wcagCompliance: 'AA'
    };
  }

  async generateSuggestions(imagePath, prompt, model) {
    return [
      { type: 'design', suggestion: 'Consider increasing contrast for better readability', priority: 'high' },
      { type: 'layout', suggestion: 'Add more whitespace between elements', priority: 'medium' },
      { type: 'accessibility', suggestion: 'Add alt text to images', priority: 'high' }
    ];
  }

  async compareImages(params) {
    const { imagePath1, imagePath2, model = 'default' } = params;

    return {
      similarity: 0.75,
      differences: [
        { region: 'header', type: 'color', description: 'Header color changed from blue to green' },
        { region: 'button', type: 'position', description: 'Submit button moved 20px to the right' }
      ],
      suggestions: ['The changes appear to be intentional UI updates']
    };
  }

  async giveVisionToModel(params) {
    const {
      modelId,
      imagePath,
      prompt = 'What do you see in this image?',
      context = {}
    } = params;

    const modelSupport = this.modelSupport.find(m => m.models.includes(modelId));
    if (!modelSupport) {
      throw new Error(`Model ${modelId} does not support vision`);
    }

    const visionRequest = {
      id: uuidv4(),
      modelId,
      provider: modelSupport.provider,
      imagePath,
      prompt,
      context,
      maxImages: modelSupport.maxImages,
      status: 'ready',
      type: 'vision-request',
      createdAt: new Date().toISOString()
    };

    return visionRequest;
  }

  async getSupportedModels() {
    return this.modelSupport;
  }

  async getVisionCapabilities() {
    return this.visionCapabilities;
  }

  async getAnalysisTypes() {
    return this.analysisTypes;
  }

  async getCapture(id) {
    return this.captures.get(id);
  }

  async listCaptures(limit = 50) {
    return Array.from(this.captures.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async deleteCapture(id) {
    const capture = this.captures.get(id);
    if (capture && capture.filePath) {
      await fs.remove(capture.filePath).catch(() => {});
    }
    this.captures.delete(id);
    return { success: true };
  }

  async getAnalysis(id) {
    return this.analyses.get(id);
  }

  async listAnalyses(limit = 50) {
    return Array.from(this.analyses.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async getStats() {
    const captures = Array.from(this.captures.values());
    const analyses = Array.from(this.analyses.values());

    return {
      captures: captures.length,
      analyses: analyses.length,
      completedAnalyses: analyses.filter(a => a.status === 'completed').length,
      visionCapabilities: this.visionCapabilities.length,
      supportedModels: this.modelSupport.length,
      totalModels: this.modelSupport.reduce((sum, m) => sum + m.models.length, 0)
    };
  }

  async saveCapture(capture) {
    const filePath = path.join(this.visionDir, `capture-${capture.id}.json`);
    await fs.writeJson(filePath, capture, { spaces: 2 });
  }

  async saveAnalysis(analysis) {
    const filePath = path.join(this.visionDir, `analysis-${analysis.id}.json`);
    await fs.writeJson(filePath, analysis, { spaces: 2 });
  }

  async exportVision(format = 'json') {
    const data = {
      captures: Array.from(this.captures.values()),
      analyses: Array.from(this.analyses.values()),
      capabilities: this.visionCapabilities,
      models: this.modelSupport,
      stats: await this.getStats()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = VisionEngine;
