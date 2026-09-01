/**
 * Image Understanding — Pix AI
 * Reads screenshots, images, OCR. Paste or path → Pix sees it.
 * by Aghosh-mv · justcode
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

class ImageUnderstanding {
  constructor(getApiKey) {
    this.getApiKey = getApiKey;
  }

  // ── Analyze image file (send to vision model) ──
  analyze(filePath, question, cb) {
    if (!fs.existsSync(filePath)) { cb(null, 'file not found'); return; }

    const apiKey = this.getApiKey('openai') || this.getApiKey('openrouter');
    if (!apiKey) { cb(null, 'no API key with vision support'); return; }

    // Read image as base64
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' };
    const mime = mimeMap[ext] || 'image/png';
    const base64 = fs.readFileSync(filePath).toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    const messages = [
      { role: 'user', content: [
        { type: 'text', text: question || 'Describe this image in detail. If it contains code, text, or UI elements, extract and describe them.' },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]}
    ];

    const postData = JSON.stringify({ model: 'gpt-4o', messages, max_tokens: 2048 });
    const host = 'api.openai.com';

    const req = https.request({
      hostname: host, port: 443, path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), 'Authorization': `Bearer ${apiKey}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const reply = json.choices?.[0]?.message?.content || json.error?.message;
          cb(reply || null, null);
        } catch (e) { cb(null, 'parse error'); }
      });
    });
    req.on('error', (e) => cb(null, e.message));
    req.write(postData);
    req.end();
  }

  // ── OCR: extract text from image ──
  ocr(filePath, cb) {
    this.analyze(filePath, 'Extract ALL text from this image exactly as it appears. Preserve formatting, line breaks, and structure. Output only the extracted text.', cb);
  }

  // ── Read code from screenshot ──
  readCode(filePath, cb) {
    this.analyze(filePath, 'Extract all code from this screenshot. Output the code exactly as shown, preserving formatting. If there are multiple files, separate them with clear markers.', cb);
  }

  // ── Describe UI ──
  describeUI(filePath, cb) {
    this.analyze(filePath, 'Describe this UI in detail: layout, components, colors, spacing, text content. Give me enough detail to recreate it.', cb);
  }

  // ── Read error from screenshot ──
  readError(filePath, cb) {
    this.analyze(filePath, 'Extract the error message, stack trace, and any relevant context from this error screenshot. Identify the error type and suggest a fix.', cb);
  }

  // ── Analyze multiple images ──
  analyzeBatch(filePaths, question, cb) {
    const results = [];
    let done = 0;
    filePaths.forEach((fp, i) => {
      this.analyze(fp, question, (result, err) => {
        results[i] = { file: fp, result, error: err };
        done++;
        if (done === filePaths.length) cb(results);
      });
    });
  }
}

module.exports = ImageUnderstanding;
