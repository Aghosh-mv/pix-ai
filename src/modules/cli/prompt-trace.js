/**
 * Prompt Transparency — Pix AI
 * Shows user exactly what the model saw in the prompt
 * Highlights: user text, injected context, PII masks, memory, split screen
 * by Aghosh-mv · justcode
 */

// Color codes for terminal highlighting
const H = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  // Sources
  user: '\x1b[42m',        // green bg — user's actual text
  memory: '\x1b[44m',      // blue bg — injected from memory
  splitScreen: '\x1b[45m', // magenta bg — from split screen panels
  pii: '\x1b[43m',         // yellow bg — PII masked
  search: '\x1b[46m',      // cyan bg — web search context
  system: '\x1b[100m',     // gray bg — system instructions
  compacted: '\x1b[41m',   // red bg — from compaction
};

class PromptTransparency {
  constructor() {
    this.enabled = false;
    this.lastPrompt = null;
    this.sources = [];
  }

  // ── Toggle transparency ──
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // ── Build a traced prompt (marks each section) ──
  tracePrompt(opts) {
    const sections = [];
    this.sources = [];

    // 1. System instructions (if any)
    if (opts.systemPrompt) {
      sections.push({
        type: 'system',
        label: 'System Instructions',
        content: opts.systemPrompt,
        color: H.system,
        source: 'pix config / rules',
      });
    }

    // 2. Memory context
    if (opts.memoryContext) {
      sections.push({
        type: 'memory',
        label: 'Persistent Memory',
        content: opts.memoryContext,
        color: H.memory,
        source: `~/.pix/memory/ (${opts.memoryFactCount || 0} facts)`,
      });
    }

    // 3. Compacted context
    if (opts.compactedContext) {
      sections.push({
        type: 'compacted',
        label: 'Compacted Session',
        content: opts.compactedContext,
        color: H.compacted,
        source: `compaction ${opts.compactionId || 'unknown'}`,
      });
    }

    // 4. Split screen content
    if (opts.splitScreenContent?.length > 0) {
      opts.splitScreenContent.forEach(panel => {
        sections.push({
          type: 'splitScreen',
          label: `Split Screen: ${panel.title}`,
          content: panel.content.substring(0, 500),
          color: H.splitScreen,
          source: `panel ${panel.id} (${panel.type})`,
        });
      });
    }

    // 5. Web search results
    if (opts.searchResults) {
      sections.push({
        type: 'search',
        label: 'Web Search Results',
        content: opts.searchResults,
        color: H.search,
        source: `duckduckgo search`,
      });
    }

    // 6. PII-masked content (show what was masked)
    if (opts.piiMasked) {
      sections.push({
        type: 'pii',
        label: 'PII Masked',
        content: opts.piiMasked,
        color: H.pii,
        source: `masked ${opts.piiCount || 0} items`,
      });
    }

    // 7. User's actual message (always last, highlighted green)
    sections.push({
      type: 'user',
      label: 'Your Message',
      content: opts.userMessage,
      color: H.user,
      source: 'typed by you',
    });

    this.lastPrompt = sections;
    this.sources = sections.map(s => ({ type: s.type, label: s.label, source: s.source }));
    return sections;
  }

  // ── Render highlighted prompt in terminal ──
  renderHighlighted(sections) {
    if (!sections) sections = this.lastPrompt;
    if (!sections) return [];

    const lines = [];
    lines.push('');
    lines.push(`  ${H.bold}╔══════════════════════════════════════════╗${H.reset}`);
    lines.push(`  ${H.bold}║     PROMPT TRANSPARENCY — WHAT MODEL SAW  ║${H.reset}`);
    lines.push(`  ${H.bold}╚══════════════════════════════════════════╝${H.reset}`);
    lines.push('');

    sections.forEach((section, i) => {
      // Section header
      lines.push(`  ${section.color} ── ${section.label} ──${H.reset}`);
      lines.push(`  ${H.dim}source: ${section.source}${H.reset}`);

      // Content with highlighting
      const contentLines = section.content.split('\n').slice(0, 8);
      contentLines.forEach(line => {
        lines.push(`  ${section.color}${line}${H.reset}`);
      });

      if (section.content.split('\n').length > 8) {
        lines.push(`  ${H.dim}... (${section.content.split('\n').length - 8} more lines)${H.reset}`);
      }

      if (i < sections.length - 1) lines.push('');
    });

    lines.push('');
    lines.push(`  ${H.bold}Total sections: ${sections.length}${H.reset}`);
    lines.push(`  ${H.dim}Toggle: pix prompt on|off${H.reset}`);
    lines.push('');

    return lines;
  }

  // ── Simple diff: show what changed between user input and what model got ──
  diffPrompt(userInput, finalPrompt) {
    const userWords = userInput.split(/\s+/);
    const modelWords = finalPrompt.split(/\s+/);

    const added = modelWords.filter(w => !userWords.includes(w));
    const removed = userWords.filter(w => !modelWords.includes(w));

    return {
      userLength: userInput.length,
      modelLength: finalPrompt.length,
      overhead: finalPrompt.length - userInput.length,
      addedSections: added.length > 0 ? added.slice(0, 20) : [],
      removedByMask: removed.length > 0 ? removed.slice(0, 20) : [],
      percentUser: Math.round(userInput.length / finalPrompt.length * 100),
    };
  }

  // ── Get summary of what model saw ──
  getSummary() {
    if (!this.lastPrompt) return 'No prompt traced yet.';

    let summary = `Model saw ${this.lastPrompt.length} sections:\n`;
    this.lastPrompt.forEach(s => {
      const preview = s.content.substring(0, 60).replace(/\n/g, ' ');
      summary += `  [${s.type}] ${s.label}: ${preview}...\n`;
    });
    return summary;
  }

  // ── Get source list ──
  getSources() {
    return this.sources;
  }

  // ── Export trace as text ──
  exportTrace() {
    if (!this.lastPrompt) return null;
    let text = 'PROMPT TRANSPARENCY TRACE\n';
    text += '='.repeat(50) + '\n\n';
    this.lastPrompt.forEach(s => {
      text += `[${s.type.toUpperCase()}] ${s.label}\n`;
      text += `Source: ${s.source}\n`;
      text += '-'.repeat(40) + '\n';
      text += s.content + '\n\n';
    });
    return text;
  }
}

module.exports = PromptTransparency;
