#!/bin/bash
set -e

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/home/claude/.claude-config}"
HOST_CLAUDE="/home/claude/.claude-host"

# Ensure the config dir exists
mkdir -p "$CONFIG_DIR"

# Copy credentials from host mount if they exist and config dir doesn't have them yet
if [ -f "$HOST_CLAUDE/.credentials.json" ] && [ ! -f "$CONFIG_DIR/.credentials.json" ]; then
  cp "$HOST_CLAUDE/.credentials.json" "$CONFIG_DIR/.credentials.json"
fi

# Copy settings from host if config dir doesn't have them yet
if [ -f "$HOST_CLAUDE/settings.json" ] && [ ! -f "$CONFIG_DIR/settings.json" ]; then
  cp "$HOST_CLAUDE/settings.json" "$CONFIG_DIR/settings.json"
fi

# Set hasCompletedOnboarding
SETTINGS_LOCAL="$CONFIG_DIR/settings.local.json"
if [ ! -f "$SETTINGS_LOCAL" ]; then
  echo '{"hasCompletedOnboarding":true}' > "$SETTINGS_LOCAL"
fi

# Ensure bypassPermissionsModeAccepted is set
CLAUDE_JSON="$CONFIG_DIR/.claude.json"
if [ ! -f "$CLAUDE_JSON" ]; then
  echo '{"bypassPermissionsModeAccepted":true}' > "$CLAUDE_JSON"
fi

exec sleep infinity
