# Pix - AI Harness

> Built by the creators of Lux and Vokk

Pix is a comprehensive AI harness that gives you full control over your computer through AI. It combines multiple AI providers, automation capabilities, a sandbox environment, and massive storage for code.

## Features

### 🤖 Multi-AI Engine
- **Gemini** - Google's advanced AI model
- **Groq** - Ultra-fast inference with Llama, Mixtral
- **OpenRouter** - Access to Claude, GPT-4, and more
- **Z AI** - Primary AI provider
- Streaming responses, vision capabilities, and conversation memory

### 🔄 Automation
- Take screenshots
- Click, type, and scroll anywhere
- Open and close applications
- Download files
- Record and replay actions
- OCR support

### 🧪 Sandbox Environment
- Execute code in isolated sandboxes
- Support for JavaScript, TypeScript, Python, Ruby, Go, Rust, Bash
- Install packages per sandbox
- File system operations within sandbox
- Configurable timeouts and resource limits

### 💾 Massive Storage
- Store unlimited code files (1M+ lines)
- Organize by category and language
- Search and filter capabilities
- Export/Import functionality
- Compression and backups

### 🧠 Learning System
- Teach Pix new skills
- Pattern recognition
- Knowledge retention
- Learn from other apps using vision

### 📚 Knowledge Base
- Live web search via SERP API
- News aggregation
- Wikipedia integration
- Weather information
- Stock market data

### 📁 File Manager
- Browse and manage stored files
- Grid and list views
- Multi-select operations
- Sort by name, size, date

### ⚙️ Settings
- Configure API keys
- Customize AI behavior
- Adjust automation settings
- UI preferences

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure API keys in Settings

3. Start Pix:
   ```bash
   npm start
   ```

## Keyboard Shortcuts

- `1-9, 0` - Switch between panels
- `Cmd/Ctrl + S` - Save current file
- `Cmd/Ctrl + Enter` - Run code
- `Cmd/Ctrl + L` - Clear terminal

## Architecture

```
pix/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React UI
│   ├── modules/
│   │   ├── ai/         # AI engine (Gemini, Groq, OpenRouter, Z AI)
│   │   ├── automation/ # Screen, mouse, keyboard control
│   │   ├── sandbox/    # Isolated code execution
│   │   ├── storage/    # File storage system
│   │   ├── learning/   # Pattern recognition & skills
│   │   ├── knowledge/  # Web search & data
│   │   ├── plugins/    # Plugin system
│   │   └── tasks/      # Task scheduler
│   ├── config/         # Configuration management
│   └── utils/          # Utilities (logger, etc.)
├── sandbox/            # Sandbox working directories
└── storage/            # Persistent storage
```

## API Keys Required

- **Gemini**: Get from Google AI Studio
- **Groq**: Get from console.groq.com
- **OpenRouter**: Get from openrouter.ai
- **Z AI**: Get from z.ai
- **SERP**: Get from serpapi.com

## License

MIT
