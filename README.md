<div align="center">
  <img src="public/logo.svg" alt="Multi-Agent Console" width="64" height="64">
  <h1>Multi-Agent Console</h1>
</div>


A browser UI for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [Codex](https://developers.openai.com/codex), currently focused on shared session visibility, coordination handoffs, and MCP-based cross-agent messaging.

<p align="center">
  <a href="https://github.com/siteboon/claudecodeui">Upstream Project</a> · <a href="https://github.com/siteboon/claudecodeui/issues">Upstream Issues</a> · <a href="CONTRIBUTING.md">Contributing</a>
</p>

<div align="right"><i><b>English</b> · <a href="./README.ko.md">한국어</a> · <a href="./README.zh-CN.md">中文</a> · <a href="./README.ja.md">日本語</a></i></div>

## Status

This project is under active development.

The current fork is usable for internal testing, but the product surface, naming, and documentation are still being cleaned up. Expect rough edges, incomplete UX, and behavior changes while the multi-agent workflow is being stabilized.

## Fork Notice

This repository started as a fork of [`siteboon/claudecodeui`](https://github.com/siteboon/claudecodeui) and has been heavily modified.

The current fork includes substantial custom work, including:

- Multi-agent coordination primitives and a `Coordination` panel
- Pantheon event sourcing, handoff routing, and approval-center groundwork
- Improved Claude, Codex, and Gemini session discovery
- Session resume fixes for mismatched workspace paths and Gemini resume identifiers
- Product/UI cleanup for a self-hosted multi-agent workflow

## Quick Start

### Local Run

Requirements:

- Node.js 22+
- npm
- Installed local CLIs you want to orchestrate, for example:
  - Claude Code
  - Codex CLI
  - Gemini CLI

Install dependencies and start the app:

```bash
npm install
npm run build
npm run server
```

Then open `http://localhost:3001`.

This fork is currently aimed at self-hosted use from a local machine or server where the agent CLIs are already installed.

## What Works Today

- Discover existing Claude, Codex, Gemini, and Cursor sessions
- Resume sessions and open provider shell terminals
- View files and project state from one UI
- Use the `Coordination` tab to create explicit handoffs between agents
- Record coordination state in per-workspace Pantheon event logs
- Use MCP-based handoffs for terminal-native agent flows

## Coordination Workflow

The main multi-agent entry point is the `Coordination` tab.

Typical flow:

1. Open a project and register the sessions you want to coordinate in `Pantheon Sessions`.
2. Use `Create Handoff` to send a task to `@claude`, `@codex`, `@gemini`, `@human`, or `@all`.
3. Watch `Event Feed` for:
   - `handoff`
   - `handoff_delivery`
   - `manual_attention_required`
4. Use `Whiteboard Snapshot` and `Approval Center` to track the current workspace state.

Notes:

- Project display is path-based, but operational routing uses the active session workspace path.
- A handoff may fall back to `manual_attention_required` if the target session cannot currently be resumed or injected automatically.

## Terminal MCP Handoffs

This fork includes a Pantheon MCP server so terminal-native agents do not have to rely on text `@target` parsing.

Included MCP tool:

- `pantheon_handoff`

Server entrypoint:

- [server/pantheon/mcp-server.js](./server/pantheon/mcp-server.js)

HTTP MCP endpoint:

- `POST /mcp?provider=claude|codex|gemini`

### Claude Code

Register the Pantheon MCP server at user scope so it is available in all Claude Code sessions:

```bash
claude mcp add --scope user pantheon -- \
  node /path/to/claudecodeui/server/pantheon/mcp-server.js \
  --provider claude \
  --base-url http://127.0.0.1:3001
```

Or edit `~/.claude.json` directly:

```json
{
  "mcpServers": {
    "pantheon": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/claudecodeui/server/pantheon/mcp-server.js",
        "--provider", "claude",
        "--base-url", "http://127.0.0.1:3001"
      ]
    }
  }
}
```

The MCP server forwards calls to:

- `POST /api/pantheon/handoff`

### Codex CLI

You can register the same MCP server in Codex CLI with stdio:

```bash
codex mcp add pantheon -- \
  node /root/codexDir/claudecodeui/server/pantheon/mcp-server.js \
  --provider codex \
  --base-url http://127.0.0.1:3001
```

Or use the HTTP endpoint directly:

```bash
codex mcp add pantheon-http --url http://127.0.0.1:3001/mcp?provider=codex
```

If startup is slow, add this to `~/.codex/config.toml`:

```toml
[mcp_servers.pantheon]
startup_timeout_sec = 30
```

### Handoff Contract

Use MCP handoffs for formal cross-agent task transfer.

Recommended fields:

- `to`
- `task`
- `workspacePath`
- optional `artifacts`
- optional `note`

The current direction is:

- Terminal agents: prefer `pantheon_handoff`
- Web UI sessions: text-based end-of-reply handoff parsing remains available as a fallback

## Current Limits

- Some provider-specific routing still has rough edges
- Certain handoff targets can still fall back to manual attention instead of direct delivery
- Documentation and naming are still being cleaned up
- This fork is not packaged separately from the upstream npm package yet

## Upstream

Original project:

- [`siteboon/claudecodeui`](https://github.com/siteboon/claudecodeui)
