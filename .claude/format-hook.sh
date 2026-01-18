#!/bin/bash
# Read the file path from Claude Code hook input (JSON via stdin)
file_path=$(jq -r '.tool_input.file_path')

# Check if file matches JS/TS extensions
if [[ "$file_path" =~ \.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$ ]]; then
  pnpm exec prettier --write "$file_path"
fi
