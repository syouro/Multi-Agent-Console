<div align="center">
  <img src="public/logo.svg" alt="Multi-Agent Console" width="64" height="64">
  <h1>Multi-Agent Console</h1>
</div>


[Claude Code](https://docs.anthropic.com/en/docs/claude-code)、[Cursor CLI](https://docs.cursor.com/en/cli/overview)、[Codex](https://developers.openai.com/codex)、[Gemini CLI](https://geminicli.com/) 向けのデスクトップ・モバイル UI です。1 つのブラウザ UI から、プロジェクト確認、セッション再開、Shell 端末の起動、複数 agent CLI の調整を行えます。

<p align="center">
  <a href="https://github.com/siteboon/claudecodeui">Upstream Project</a> · <a href="https://github.com/siteboon/claudecodeui/issues">Upstream Issues</a> · <a href="CONTRIBUTING.md">Contributing</a>
</p>

<div align="right"><i><a href="./README.md">English</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.zh-CN.md">中文</a></i></div>

## 現在の状態

このプロジェクトは現在も活発に開発中です。

この fork は内部検証には使えますが、プロダクト境界、命名、ドキュメントはまだ整理中です。特にマルチ agent ワークフロー周りでは、UX の粗さや今後の挙動変更を前提にしてください。

## Fork について

このリポジトリは [`siteboon/claudecodeui`](https://github.com/siteboon/claudecodeui) をベースにした fork で、多くの独自改修が入っています。

現在の fork には主に以下が含まれます。

- マルチ agent 協調のための基本機能と `Coordination` パネル
- Pantheon イベントソーシング、handoff ルーティング、承認センターの基盤
- Claude、Codex、Gemini セッション検出の改善
- ワークスペース不一致や Gemini resume identifier に関する修正
- セルフホスト前提のマルチ agent ワークフロー向け UI / プロダクト整理

## クイックスタート

### ローカル実行

必要要件：

- Node.js 22+
- npm
- 連携したいローカル CLI がインストール済みであること。例：
  - Claude Code
  - Codex CLI
  - Gemini CLI

依存関係をインストールして起動：

```bash
npm install
npm run build
npm run server
```

その後 `http://localhost:3001` を開いてください。

この fork は現在、対象の agent CLI がすでにインストール済みのローカルマシンまたはサーバー上でのセルフホスト利用を前提にしています。

## 現在動作していること

- Claude、Codex、Gemini、Cursor の既存セッション検出
- セッション再開と provider Shell 端末の起動
- 1 つの UI でのファイル閲覧とプロジェクト状態確認
- `Coordination` タブからの明示的 handoff 作成
- ワークスペース単位の Pantheon イベントログ記録
- 端末ネイティブ agent 向けの MCP handoff

## Coordination ワークフロー

マルチ agent 協調の主な入口は `Coordination` タブです。

一般的な流れ：

1. プロジェクトを開き、`Pantheon Sessions` に協調対象のセッションを登録する。
2. `Create Handoff` で `@claude`、`@codex`、`@gemini`、`@human`、`@all` にタスクを送る。
3. `Event Feed` で以下を確認する。
   - `handoff`
   - `handoff_delivery`
   - `manual_attention_required`
4. `Whiteboard Snapshot` と `Approval Center` で現在のワークスペース状態を追う。

補足：

- プロジェクト表示はパス単位でまとめられますが、実際のルーティングは現在セッションのワークスペースパスを優先します。
- 対象セッションを自動で再開または注入できない場合、handoff は `manual_attention_required` にフォールバックすることがあります。

## ターミナル MCP Handoff

この fork には Pantheon MCP server が含まれているため、ターミナルネイティブ agent は正式な handoff のためにテキスト `@target` 解析へ依存する必要がありません。

利用できる MCP ツール：

- `pantheon_handoff`

サーバー入口：

- [server/pantheon/mcp-server.js](./server/pantheon/mcp-server.js)

### Claude Code

Claude Code からローカル Pantheon MCP server を参照し、provider identity を `claude` に設定します。

この MCP server は最終的に以下へ転送します。

- `POST /api/pantheon/handoff`

### Codex CLI

Codex CLI では同じ MCP server を登録できます。

```bash
codex mcp add pantheon -- \
  node /root/codexDir/claudecodeui/server/pantheon/mcp-server.js \
  --provider codex \
  --base-url http://127.0.0.1:3001
```

起動が遅い場合は `~/.codex/config.toml` に以下を追加してください。

```toml
[mcp_servers.pantheon]
startup_timeout_sec = 30
```

### Handoff 契約

正式な agent 間タスク移譲には、MCP handoff を優先して使う想定です。

推奨フィールド：

- `to`
- `task`
- `workspacePath`
- 任意で `artifacts`
- 任意で `note`

現在の方針：

- ターミナル agent：`pantheon_handoff` を優先
- Web UI セッション：返信末尾のテキスト handoff 解析は fallback として維持

## 現在の制限

- provider ごとのルーティングにはまだ粗い部分があります
- 一部の handoff 先は直接配信ではなく manual attention にフォールバックする場合があります
- ドキュメントと命名は引き続き整理中です
- この fork はまだ独立した npm package としては公開していません

## Upstream

元プロジェクト：

- [`siteboon/claudecodeui`](https://github.com/siteboon/claudecodeui)
