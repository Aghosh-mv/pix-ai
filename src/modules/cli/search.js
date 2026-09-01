/**
 * Auto Web Search — Pix AI
 * Detects when to search, fetches results automatically
 * by Aghosh-mv · justcode
 */
const https = require('https');

const SEARCH_INDICATORS = [
  /\b(current|latest|recent|today|now|2026|2025)\b/i,
  /\b(price|cost|how many|statistics|data)\b/i,
  /\b(release|launch|announcement|news|update)\b/i,
  /\b(who is|what is|when did|where is)\b.*\?/i,
  /\b(weather|temperature|forecast)\b/i,
  /\b(version|changelog|breaking change)\b/i,
  /\b(deprecated|removed|replaced)\b/i,
];

class AutoSearch {
  constructor(enabled = true) {
    this.enabled = enabled;
  }

  needsSearch(query) {
    if (!this.enabled) return false;
    return SEARCH_INDICATORS.some(r => r.test(query));
  }

  search(query, cb) {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    https.get(url, { headers: { 'User-Agent': 'Pix/2.4' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const results = [];
        const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
        let match;
        while ((match = snippetRegex.exec(data)) !== null && results.length < 3) {
          const text = match[1].replace(/<[^>]+>/g, '').trim();
          if (text) results.push(text);
        }
        const titleRegex = /<a[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>/gi;
        const titles = [];
        while ((match = titleRegex.exec(data)) !== null && titles.length < 3) {
          titles.push(match[1].replace(/<[^>]+>/g, '').trim());
        }
        cb({ results, titles, raw: results.join('\n') });
      });
    }).on('error', () => cb({ results: [], titles: [], raw: '' }));
  }
}

module.exports = AutoSearch;
