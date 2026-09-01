/**
 * Voice Mode — Pix AI
 * TTS output, voice input via mic, voice commands
 * by Aghosh-mv · justcode
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

class VoiceMode {
  constructor(getApiKey) {
    this.getApiKey = getApiKey;
    this.enabled = false;
    this.voice = 'alloy'; // openai TTS voice
    this.speaking = false;
  }

  // ── Text to Speech ──
  speak(text, cb) {
    const apiKey = this.getApiKey('openai');
    if (!apiKey) {
      // Fallback to macOS say
      try {
        execSync(`say "${text.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
        if (cb) cb(true);
      } catch (e) { if (cb) cb(false, 'no TTS available'); }
      return;
    }

    const postData = JSON.stringify({ model: 'tts-1', input: text, voice: this.voice });
    const tmpFile = path.join(os.tmpdir(), `pix-tts-${Date.now()}.mp3`);

    const req = https.request({
      hostname: 'api.openai.com', port: 443, path: '/v1/audio/speech', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const audio = Buffer.concat(chunks);
        fs.writeFileSync(tmpFile, audio);
        try {
          // macOS: afplay, Linux: aplay/paplay
          execSync(`afplay "${tmpFile}" 2>/dev/null || aplay "${tmpFile}" 2>/dev/null || paplay "${tmpFile}" 2>/dev/null`, { stdio: 'pipe' });
          fs.unlinkSync(tmpFile);
          if (cb) cb(true);
        } catch (e) { if (cb) cb(false, 'no audio player'); }
      });
    });
    req.on('error', (e) => { if (cb) cb(false, e.message); });
    req.write(postData);
    req.end();
  }

  // ── Speech to Text (record + transcribe) ──
  listen(cb) {
    const apiKey = this.getApiKey('openai');
    const tmpFile = path.join(os.tmpdir(), `pix-mic-${Date.now()}.wav`);

    // Record from mic (macOS: sox or sox, Linux: arecord)
    try {
      execSync(`rec "${tmpFile}" trim 0 10 2>/dev/null || sox -d "${tmpFile}" trim 0 10 2>/dev/null`, { timeout: 12000, stdio: 'pipe' });
    } catch (e) {
      // Timeout is expected (10 sec recording)
      if (!fs.existsSync(tmpFile)) { cb(null, 'mic not available'); return; }
    }

    if (!apiKey) { cb(null, 'no API key for transcription'); return; }

    // Transcribe with Whisper
    const FormData = require('form-data') || null;
    // Simple approach: send raw WAV
    const audioData = fs.readFileSync(tmpFile);
    const boundary = '----PixBoundary' + Date.now();
    let body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`;
    body += audioData.toString('binary');
    body += `\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n--${boundary}--\r\n`;

    const req = https.request({
      hostname: 'api.openai.com', port: 443, path: '/v1/audio/transcriptions', method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Authorization': `Bearer ${apiKey}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          cb(json.text || null, null);
        } catch (e) { cb(null, 'parse error'); }
        try { fs.unlinkSync(tmpFile); } catch (e) {}
      });
    });
    req.on('error', (e) => { cb(null, e.message); try { fs.unlinkSync(tmpFile); } catch (e) {} });
    req.write(body);
    req.end();
  }

  // ── Voice command detection ──
  isVoiceCommand(text) {
    const patterns = [
      /^(hey pix|pix|assistant)/i,
      /^(run|execute|build|test|commit|push|deploy)/i,
      /^(search|find|look|google)/i,
      /^(what|how|why|when|where|who|explain)/i,
      /^(help|status|config|version)/i,
    ];
    return patterns.some(p => p.test(text.trim()));
  }

  // ── Toggle voice mode ──
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // ── Set voice ──
  setVoice(voice) {
    const valid = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (valid.includes(voice)) { this.voice = voice; return true; }
    return false;
  }

  getStatus() {
    return { enabled: this.enabled, voice: this.voice, speaking: this.speaking };
  }
}

module.exports = VoiceMode;
