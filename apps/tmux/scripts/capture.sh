#!/usr/bin/env bash
# Capture current tmux pane and publish to mdfy.app
# Called by memorywiki.tmux keybinding

# Check if mdfy CLI is installed
if ! command -v mdfy &> /dev/null; then
  tmux display-message "mdfy not found. Install: npm install -g memory-wiki-cli"
  exit 1
fi

# Capture pane content (last 3000 lines)
content=$(tmux capture-pane -p -S -3000)

if [ -z "$content" ]; then
  tmux display-message "Empty pane — nothing to capture"
  exit 0
fi

# Publish via mdfy CLI capture command
url=$(echo "$content" | mw capture 2>/dev/null)

if [ -n "$url" ]; then
  # Copy URL to tmux buffer and system clipboard
  tmux set-buffer "$url"
  echo -n "$url" | pbcopy 2>/dev/null || echo -n "$url" | xclip -selection clipboard 2>/dev/null

  tmux display-message "Published: $url (copied)"
else
  tmux display-message "Publish failed"
fi
