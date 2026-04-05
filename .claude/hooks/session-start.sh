#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Load nvm
export NVM_DIR="${NVM_DIR:-/opt/nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Install and use Node.js 24
nvm install 24
nvm alias default 24

# Make Node.js 24 available for this session
echo 'export NVM_DIR="${NVM_DIR:-/opt/nvm}"' >> "$CLAUDE_ENV_FILE"
echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"' >> "$CLAUDE_ENV_FILE"
echo 'nvm use 24 > /dev/null 2>&1' >> "$CLAUDE_ENV_FILE"

# Install dependencies
cd "$CLAUDE_PROJECT_DIR"
pnpm install
