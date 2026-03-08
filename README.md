<div align="center">
  <img src="public/logo.svg" alt="Multi-Agent Console" width="64" height="64">
  <h1>Multi-Agent Console</h1>
</div>


A desktop and mobile UI for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Cursor CLI](https://docs.cursor.com/en/cli/overview), [Codex](https://developers.openai.com/codex), and [Gemini CLI](https://geminicli.com/). It lets you inspect projects, resume sessions, open shell terminals, and coordinate multiple agent CLIs from one browser UI.

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

### Self-Hosted

Try Multi-Agent Console instantly with **npx** (requires **Node.js** v22+):

```
npx @siteboon/claude-code-ui
```

Or install it **globally** for regular use:

```
npm install -g @siteboon/claude-code-ui
cloudcli
```

Open `http://localhost:3001` — all your existing sessions are discovered automatically.

This fork currently focuses on self-hosted workflows. If you want a managed hosted service, refer to the upstream project and its documentation.
