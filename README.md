<div align="center">
  <img src="public/logo.svg" alt="Multi-Agent Console" width="64" height="64">
  <h1>Multi-Agent Console</h1>
</div>


A desktop and mobile UI for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Cursor CLI](https://docs.cursor.com/en/cli/overview), [Codex](https://developers.openai.com/codex), and [Gemini CLI](https://geminicli.com/). It lets you inspect projects, resume sessions, open shell terminals, and coordinate multiple agent CLIs from one browser UI.

<p align="center">
  <a href="https://github.com/siteboon/claudecodeui">Upstream Project</a> · <a href="https://github.com/siteboon/claudecodeui/issues">Upstream Issues</a> · <a href="CONTRIBUTING.md">Contributing</a>
</p>

<div align="right"><i><b>English</b> · <a href="./README.ko.md">한국어</a> · <a href="./README.zh-CN.md">中文</a> · <a href="./README.ja.md">日本語</a></i></div>

## Fork Notice

This repository started as a fork of [`siteboon/claudecodeui`](https://github.com/siteboon/claudecodeui) and has been heavily modified.

The current fork includes substantial custom work, including:

- Multi-agent coordination primitives and a `Coordination` panel
- Pantheon event sourcing, handoff routing, and approval-center groundwork
- Improved Claude, Codex, and Gemini session discovery
- Session resume fixes for mismatched workspace paths and Gemini resume identifiers
- Product/UI cleanup for a self-hosted multi-agent workflow

## Screenshots

<div align="center">
  
<table>
<tr>
<td align="center">
<h3>Desktop View</h3>
<img src="public/screenshots/desktop-main.png" alt="Desktop Interface" width="400">
<br>
<em>Main interface showing project overview and chat</em>
</td>
<td align="center">
<h3>Mobile Experience</h3>
<img src="public/screenshots/mobile-chat.png" alt="Mobile Interface" width="250">
<br>
<em>Responsive mobile design with touch navigation</em>
</td>
</tr>
<tr>
<td align="center" colspan="2">
<h3>CLI Selection</h3>
<img src="public/screenshots/cli-selection.png" alt="CLI Selection" width="400">
<br>
<em>Select between Claude Code, Cursor CLI and Codex</em>
</td>
</tr>
</table>



</div>

## Features

- **Responsive Design** - Works seamlessly across desktop, tablet, and mobile so you can also use Agents from mobile 
- **Interactive Chat Interface** - Built-in chat interface for seamless communication with the Agents
- **Integrated Shell Terminal** - Direct access to the Agents CLI through built-in shell functionality
- **File Explorer** - Interactive file tree with syntax highlighting and live editing
- **Git Explorer** - View, stage and commit your changes. You can also switch branches 
- **Session Management** - Resume conversations, manage multiple sessions, and track history
- **TaskMaster AI Integration** *(Optional)* - Advanced project management with AI-powered task planning, PRD parsing, and workflow automation
- **Model Compatibility** - Works with Claude Sonnet 4.5, Opus 4.5, GPT-5.2, and Gemini.


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

---

## Security & Tools Configuration

**🔒 Important Notice**: All Claude Code tools are **disabled by default**. This prevents potentially harmful operations from running automatically.

### Enabling Tools

To use Claude Code's full functionality, you'll need to manually enable tools:

1. **Open Tools Settings** - Click the gear icon in the sidebar
3. **Enable Selectively** - Turn on only the tools you need
4. **Apply Settings** - Your preferences are saved locally

<div align="center">

![Tools Settings Modal](public/screenshots/tools-modal.png)
*Tools Settings interface - enable only what you need*

</div>

**Recommended approach**: Start with basic tools enabled and add more as needed. You can always adjust these settings later.

---
## FAQ

<details>
<summary>How is this different from Claude Code Remote Control?</summary>

Claude Code Remote Control lets you send messages to a session already running in your local terminal. Your machine has to stay on, your terminal has to stay open, and sessions time out after roughly 10 minutes without a network connection.

Multi-Agent Console extends the same local CLI sessions rather than wrapping them in a separate agent runtime. Your MCP servers, permissions, settings, and sessions stay close to the official tools.

Here's what that means in practice:

- **All your sessions, not just one** — the UI auto-discovers sessions from local agent state rather than exposing only one active terminal.
- **Your settings stay local** — configuration changes stay close to the underlying CLI tools and project files.
- **Works with more agents** — Claude Code, Cursor CLI, Codex, and Gemini CLI, not just Claude Code.
- **Full UI, not just a chat window** — file explorer, Git integration, MCP management, and a shell terminal are all built in.

</details>

<details>
<summary>Do I need to pay for an AI subscription separately?</summary>

Yes. This project is only the UI and orchestration layer. You bring your own Claude, Cursor, Codex, or Gemini subscriptions.

</details>

<details>
<summary>Can I use Multi-Agent Console on my phone?</summary>

Yes. Run the server on your machine and open `[yourip]:port` in any browser on your network or through your own reverse proxy.

</details>

<details>
<summary>Will changes I make in the UI affect my local Claude Code setup?</summary>

Yes, for self-hosted setups that point at your real local agent configuration. Changes made through the UI can affect the same sessions, config files, and workspaces used by the official CLIs.

</details>

---

## Community & Support

- **[Upstream Repository](https://github.com/siteboon/claudecodeui)** — original project this fork builds on
- **This fork's GitHub Issues** — bug reports and feature requests for your fork
- **[Contributing Guide](CONTRIBUTING.md)** — how to contribute to the project

## License

GNU General Public License v3.0 - see [LICENSE](LICENSE) file for details.

This project is open source and free to use, modify, and distribute under the GPL v3 license.

## Acknowledgments

### Built With
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's official CLI
- **[Cursor CLI](https://docs.cursor.com/en/cli/overview)** - Cursor's official CLI
- **[Codex](https://developers.openai.com/codex)** - OpenAI Codex
- **[Gemini-CLI](https://geminicli.com/)** - Google Gemini CLI
- **[React](https://react.dev/)** - User interface library
- **[Vite](https://vitejs.dev/)** - Fast build tool and dev server
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[CodeMirror](https://codemirror.net/)** - Advanced code editor
- **[TaskMaster AI](https://github.com/eyaltoledano/claude-task-master)** *(Optional)* - AI-powered project management and task planning


<div align="center">
  <strong>Built for self-hosted multi-agent workflows.</strong>
</div>
