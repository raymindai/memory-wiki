#!/usr/bin/env bash
# mdfy skill installer for AI coding tools.
#
# Defaults to Claude Code. Pass --target=cursor for the Cursor rule.
#
# Claude Code:
#   curl -fsSL https://staging.memory.wiki/skills/memorywiki/install.sh | sh
#
# Cursor:
#   curl -fsSL https://staging.memory.wiki/skills/memorywiki/install.sh | sh -s -- --target=cursor
#
# Idempotent and safe to rerun.

set -euo pipefail

BASE_URL="${MDFY_BASE_URL:-https://staging.memory.wiki}"
TARGET="claude"
for arg in "$@"; do
  case "$arg" in
    --target=*) TARGET="${arg#--target=}" ;;
    *) ;;
  esac
done

fetch() {
  local url="$1"; local out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$out"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$out" "$url"
  else
    echo "mdfy install requires curl or wget. Install one and retry." >&2
    exit 1
  fi
}

case "$TARGET" in
  claude|claude-code)
    SKILL_DIR="${HOME}/.claude/skills/memorywiki"
    mkdir -p "$SKILL_DIR"
    fetch "$BASE_URL/skills/memorywiki/SKILL.md" "$SKILL_DIR/SKILL.md"
    cat <<EOF
mdfy skill installed at: $SKILL_DIR/SKILL.md

Restart Claude Code (or run /reload-skills) to pick it up.
Then in any chat, say:

  /mdfy capture <title>     save this conversation
  /mdfy bundle <topic>      group related docs into a bundle
  /mdfy hub                 get your hub URL

Sign in at $BASE_URL to claim captures.
EOF
    ;;
  cursor)
    # Cursor reads ~/.cursor/rules/*.mdc as global rules. Project-scoped
    # rules go under <repo>/.cursor/rules/. We install globally so the
    # user's mdfy actions are available in every Cursor project.
    RULES_DIR="${HOME}/.cursor/rules"
    mkdir -p "$RULES_DIR"
    fetch "$BASE_URL/skills/memorywiki/cursor-rule.mdc" "$RULES_DIR/mdfy.mdc"
    cat <<EOF
mdfy rule installed at: $RULES_DIR/mdfy.mdc

Restart Cursor (or open Settings -> Rules and toggle once) to pick
it up. Then in any chat, say things like:

  Save this to mdfy as "<title>"
  Bundle my docs about <topic>
  Give me my hub URL

Sign in at $BASE_URL to claim captures.
EOF
    ;;
  codex)
    # Codex CLI reads ~/.codex/AGENTS.md as the global agent prompt.
    # Per-project agents live under <repo>/AGENTS.md. We install the
    # mdfy actions globally and append rather than overwrite so the
    # user's existing AGENTS.md content is preserved.
    AGENTS_DIR="${HOME}/.codex"
    AGENTS_FILE="$AGENTS_DIR/AGENTS.md"
    mkdir -p "$AGENTS_DIR"
    TMP_FILE=$(mktemp)
    fetch "$BASE_URL/skills/memorywiki/agent-prompt.md" "$TMP_FILE"
    if [ -f "$AGENTS_FILE" ] && grep -q "mdfy actions" "$AGENTS_FILE"; then
      # Already installed; replace the mdfy block in place.
      python3 -c "
import re, sys
path = '$AGENTS_FILE'
new = open('$TMP_FILE').read().rstrip() + '\n'
old = open(path).read()
out = re.sub(r'<!-- mdfy:start -->.*?<!-- mdfy:end -->\n?', new, old, flags=re.S)
open(path,'w').write(out)
" || cp "$TMP_FILE" "$AGENTS_FILE"
    elif [ -f "$AGENTS_FILE" ]; then
      printf '\n' >> "$AGENTS_FILE"
      cat "$TMP_FILE" >> "$AGENTS_FILE"
    else
      cp "$TMP_FILE" "$AGENTS_FILE"
    fi
    rm -f "$TMP_FILE"
    cat <<EOF
mdfy actions appended to: $AGENTS_FILE

Restart Codex CLI (or run \`codex reload\`) to pick it up. Then in
any session say things like:

  Save this to mdfy as "<title>"
  Bundle my docs about <topic>
  Give me my hub URL

Sign in at $BASE_URL to claim captures.
EOF
    ;;
  aider)
    # Aider loads <repo>/.aider/conventions.md when present and pulls
    # ~/.aider.conf.yml conventions automatically. We install a global
    # conventions file at ~/.aider/conventions.md and let the user opt
    # in per-repo by referencing it in their config.
    AIDER_DIR="${HOME}/.aider"
    AIDER_FILE="$AIDER_DIR/conventions.md"
    mkdir -p "$AIDER_DIR"
    fetch "$BASE_URL/skills/memorywiki/agent-prompt.md" "$AIDER_FILE"
    cat <<EOF
mdfy conventions installed at: $AIDER_FILE

To use them in any aider session, add this line to your repo's
.aider.conf.yml (or to ~/.aider.conf.yml for global use):

  read: ~/.aider/conventions.md

Then in any aider chat:

  Save this to mdfy as "<title>"
  Bundle my docs about <topic>
  Give me my hub URL

Sign in at $BASE_URL to claim captures.
EOF
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    echo "Supported targets: claude, cursor, codex, aider" >&2
    exit 2
    ;;
esac
