#!/bin/bash
# Pix AI - Install Script
# Usage: curl -fsSL https://raw.githubusercontent.com/Aghosh-mv/pix-ai/main/install.sh | bash

set -e

PIX_DIR="$HOME/.pix"
BIN_DIR="/usr/local/bin"

echo "🚀 Installing Pix AI..."

# Create directories
mkdir -p "$PIX_DIR"

# Clone or update
if [ -d "$PIX_DIR/repo" ]; then
  echo "📦 Updating Pix AI..."
  cd "$PIX_DIR/repo" && git pull
else
  echo "📦 Downloading Pix AI..."
  git clone https://github.com/Aghosh-mv/pix-ai.git "$PIX_DIR/repo"
fi

# Install dependencies
cd "$PIX_DIR/repo" && npm install --ignore-scripts 2>/dev/null

# Create global command
cat > "$BIN_DIR/pix" << 'EOF'
#!/usr/bin/env node
require(process.env.HOME + '/.pix/repo/bin/pix.js');
EOF
chmod +x "$BIN_DIR/pix"

echo ""
echo "✅ Pix AI installed!"
echo ""
echo "Run: pix --help"
echo ""
