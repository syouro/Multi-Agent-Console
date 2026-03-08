<div align="center">
  <img src="public/logo.svg" alt="Multi-Agent Console" width="64" height="64">
  <h1>Multi-Agent Console</h1>
</div>


这是一个面向 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)、[Cursor CLI](https://docs.cursor.com/en/cli/overview)、[Codex](https://developers.openai.com/codex) 和 [Gemini CLI](https://geminicli.com/) 的桌面端与移动端界面。它可以在一个浏览器 UI 中统一查看项目、恢复会话、打开 Shell 终端，并协调多个 agent CLI。

<p align="center">
  <a href="https://github.com/siteboon/claudecodeui">上游项目</a> · <a href="https://github.com/siteboon/claudecodeui/issues">上游 Issues</a> · <a href="CONTRIBUTING.md">贡献指南</a>
</p>

<div align="right"><i><a href="./README.md">English</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.ja.md">日本語</a></i></div>

## 当前状态

项目仍在积极开发中。

当前这个 fork 已可用于内部测试，但产品边界、命名和文档仍在持续收敛。可以预期还会有交互粗糙、部分 UX 不完整、行为继续调整的情况，尤其是在多 agent 协同工作流这部分。

## Fork 说明

本仓库起始于 [`siteboon/claudecodeui`](https://github.com/siteboon/claudecodeui) 的 fork，并已经做了大量二次开发。

目前这份 fork 主要增加了：

- 多 agent 协同原语和 `Coordination` 面板
- Pantheon 事件流、handoff 路由和审批中心基础能力
- Claude、Codex、Gemini 会话发现能力的改进
- 工作目录不匹配和 Gemini resume 标识相关的恢复修复
- 面向自托管多 agent 工作流的产品与 UI 清理

## 快速开始

### 本地运行

依赖要求：

- Node.js 22+
- npm
- 已安装你要协同的本地 CLI，例如：
  - Claude Code
  - Codex CLI
  - Gemini CLI

安装依赖并启动：

```bash
npm install
npm run build
npm run server
```

然后打开 `http://localhost:3001`。

这个 fork 目前主要面向本地机器或服务器上的自托管场景，默认假设相关 agent CLI 已经安装完成。

## 当前已可用能力

- 发现现有的 Claude、Codex、Gemini、Cursor 会话
- 恢复会话并打开 provider shell 终端
- 在同一个 UI 中查看文件和项目状态
- 通过 `Coordination` 标签页创建显式 handoff
- 在每个工作区中记录 Pantheon 事件日志
- 为终端原生 agent 使用 MCP handoff

## Coordination 工作流

多 agent 协同的主要入口是 `Coordination` 标签页。

典型流程：

1. 打开项目，在 `Pantheon Sessions` 里注册你要协同的会话。
2. 使用 `Create Handoff` 把任务发给 `@claude`、`@codex`、`@gemini`、`@human` 或 `@all`。
3. 在 `Event Feed` 中观察：
   - `handoff`
   - `handoff_delivery`
   - `manual_attention_required`
4. 使用 `Whiteboard Snapshot` 和 `Approval Center` 跟踪当前工作区状态。

说明：

- 项目展示按路径归并，但实际路由优先使用当前会话自己的工作目录。
- 如果目标会话当前无法自动恢复或注入，handoff 可能会回退为 `manual_attention_required`。

## 终端 MCP Handoff

这个 fork 内置了 Pantheon MCP server，这样终端原生 agent 就不需要依赖文本 `@target` 解析来做正式交接。

当前提供的 MCP 工具：

- `pantheon_handoff`

服务端入口：

- [server/pantheon/mcp-server.js](./server/pantheon/mcp-server.js)

### Claude Code

在 user 作用域注册 Pantheon MCP server，使其在所有 Claude Code 会话中可用：

```bash
claude mcp add --scope user pantheon -- \
  node /path/to/claudecodeui/server/pantheon/mcp-server.js \
  --provider claude \
  --base-url http://127.0.0.1:3001
```

或直接编辑 `~/.claude.json`：

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

MCP server 会将调用转发到：

- `POST /api/pantheon/handoff`

### Codex CLI

可以在 Codex CLI 中注册同一个 MCP server：

```bash
codex mcp add pantheon -- \
  node /root/codexDir/claudecodeui/server/pantheon/mcp-server.js \
  --provider codex \
  --base-url http://127.0.0.1:3001
```

如果启动偏慢，可以在 `~/.codex/config.toml` 中加上：

```toml
[mcp_servers.pantheon]
startup_timeout_sec = 30
```

### Handoff 契约

正式的跨 agent 任务交接建议优先使用 MCP handoff。

推荐字段：

- `to`
- `task`
- `workspacePath`
- 可选 `artifacts`
- 可选 `note`

当前方向是：

- 终端 agent：优先使用 `pantheon_handoff`
- Web UI 会话：文本型的回复末尾 handoff 解析仍作为 fallback 保留

## 当前限制

- 某些 provider 的路由行为仍有粗糙边界
- 某些 handoff 目标仍可能回退到 manual attention，而不是直接送达
- 文档和命名仍在持续清理
- 这个 fork 目前还没有单独发布 npm 包

## 上游项目

原始项目：

- [`siteboon/claudecodeui`](https://github.com/siteboon/claudecodeui)
