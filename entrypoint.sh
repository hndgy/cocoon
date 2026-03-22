#!/bin/bash
set -e

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/home/claude/.claude-config}"

# Ensure the config dir exists
mkdir -p "$CONFIG_DIR"

# Set hasCompletedOnboarding so interactive mode skips the login screen
SETTINGS_LOCAL="$CONFIG_DIR/settings.local.json"
if [ ! -f "$SETTINGS_LOCAL" ]; then
  echo '{"hasCompletedOnboarding":true}' > "$SETTINGS_LOCAL"
fi

# Ensure bypassPermissionsModeAccepted is set in .claude.json
CLAUDE_JSON="$CONFIG_DIR/.claude.json"
if [ ! -f "$CLAUDE_JSON" ]; then
  echo '{"bypassPermissionsModeAccepted":true}' > "$CLAUDE_JSON"
fi

exec sleep infinity
