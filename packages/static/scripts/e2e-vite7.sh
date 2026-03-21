#!/usr/bin/env bash
# Runs E2E tests against Vite 7 by temporarily swapping the pnpm catalog.
#
# Usage:
#   ./scripts/e2e-vite7.sh          # production build tests
#   ./scripts/e2e-vite7.sh dev      # dev server tests
#
# This works by replacing the default catalog vite/plugin-react versions
# with the vite7 catalog values, reinstalling, running tests, then restoring.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WORKSPACE_FILE="$REPO_ROOT/pnpm-workspace.yaml"
BACKUP_FILE="$WORKSPACE_FILE.bak"

# Restore workspace file on exit (always, even on error)
cleanup() {
  if [ -f "$BACKUP_FILE" ]; then
    mv "$BACKUP_FILE" "$WORKSPACE_FILE"
    echo "Restored pnpm-workspace.yaml"
    echo "Reinstalling default deps..."
    (cd "$REPO_ROOT" && pnpm install --no-frozen-lockfile)
  fi
}
trap cleanup EXIT

# Backup current workspace file
cp "$WORKSPACE_FILE" "$BACKUP_FILE"

# Swap catalog to use vite 7 versions
sed -i \
  -e 's|"@vitejs/plugin-react": \^6\.0\.1|"@vitejs/plugin-react": ^5.1.4|' \
  -e 's|vite: \^8\.0\.0|vite: ^7.3.1|' \
  "$WORKSPACE_FILE"

echo "Switched catalog to Vite 7"
echo "Installing Vite 7 deps..."
(cd "$REPO_ROOT" && pnpm install --no-frozen-lockfile)

echo "Building @funstack/static..."
(cd "$REPO_ROOT" && pnpm --filter @funstack/static build)

# Determine which playwright config to use
if [ "${1:-}" = "dev" ]; then
  CONFIG="e2e/playwright-dev.config.ts"
  echo "Running E2E tests (dev server) with Vite 7..."
else
  CONFIG="e2e/playwright.config.ts"
  echo "Running E2E tests (production build) with Vite 7..."
fi

cd "$REPO_ROOT/packages/static"
pnpm playwright test --config "$CONFIG"
