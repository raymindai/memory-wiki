# mdfy tmux plugin

Capture terminal output and AI conversations from tmux and publish to mdfy.app.

Press `prefix + M` to capture the current pane and get a shareable URL.

## Install

### Option 1: Manual

```bash
mkdir -p ~/.tmux/plugins/mdfy
cp -r apps/tmux/* ~/.tmux/plugins/mdfy/
```

Add to `~/.tmux.conf`:
```bash
run-shell ~/.tmux/plugins/mdfy/memorywiki.tmux
```

### Option 2: TPM (Tmux Plugin Manager)

Add to `~/.tmux.conf`:
```bash
set -g @plugin 'raymindai/mw-tmux'
```

### Prerequisite

```bash
npm install -g memory-wiki-cli
```

## Usage

| Key | Action |
|-----|--------|
| `prefix + M` | Capture current pane → publish → URL copied |

## What it captures

- **AI conversations** (Claude Code, ChatGPT CLI, Ollama) → formatted with User/Assistant roles
- **CLI sessions** → wrapped in code blocks
- **Plain output** → published as-is

ANSI escape codes are automatically stripped.

## Configuration

Set custom key in `.tmux.conf` (before `run-shell`):

```bash
MDFY_KEY="m"  # lowercase m instead of M
```

## CLI capture command

The tmux plugin uses `mw capture` under the hood. You can also use it directly:

```bash
# Auto-detect: tmux pane if in tmux, clipboard otherwise
mw capture

# Explicit sources
mw capture tmux       # Capture current tmux pane
mw capture clipboard  # Capture system clipboard
mw capture last       # Pipe: some-cmd | mw capture last
```
