#!/bin/bash
set -e

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/home/claude/.claude-config}"
CLAUDE_JSON="$CONFIG_DIR/.claude.json"
HOST_CONFIG="/home/claude/.host-claude-config"

# Seed credentials from the host mount, but only if the container isn't already
# authenticated — never clobber a token refreshed or a login done inside the
# container. (macOS hosts keep credentials in the Keychain rather than this file;
# the CLI handles that case by injecting them after startup.)
if [ ! -s "$CONFIG_DIR/.credentials.json" ] && [ -f "$HOST_CONFIG/.credentials.json" ]; then
  cp "$HOST_CONFIG/.credentials.json" "$CONFIG_DIR/.credentials.json"
  chmod 600 "$CONFIG_DIR/.credentials.json"
fi

# Ensure bypassPermissionsModeAccepted and hasCompletedOnboarding are set
# This prevents the login/onboarding screen when using --dangerously-skip-permissions
if [ ! -f "$CLAUDE_JSON" ]; then
  echo '{"bypassPermissionsModeAccepted":true,"hasCompletedOnboarding":true}' > "$CLAUDE_JSON"
elif ! grep -q '"bypassPermissionsModeAccepted"' "$CLAUDE_JSON" 2>/dev/null; then
  # Add the flags to existing .claude.json using node (jq not available)
  node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('$CLAUDE_JSON', 'utf-8'));
    data.bypassPermissionsModeAccepted = true;
    data.hasCompletedOnboarding = true;
    fs.writeFileSync('$CLAUDE_JSON', JSON.stringify(data, null, 2));
  " 2>/dev/null || true
fi

exec sleep infinity
