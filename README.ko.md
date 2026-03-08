<div align="center">
  <img src="public/logo.svg" alt="Multi-Agent Console" width="64" height="64">
  <h1>Multi-Agent Console</h1>
</div>


[Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Cursor CLI](https://docs.cursor.com/en/cli/overview), [Codex](https://developers.openai.com/codex), [Gemini CLI](https://geminicli.com/)를 위한 데스크톱 및 모바일 UI입니다. 하나의 브라우저 UI에서 프로젝트 확인, 세션 재개, Shell 터미널 열기, 여러 agent CLI 조정을 할 수 있습니다.

<p align="center">
  <a href="https://github.com/siteboon/claudecodeui">Upstream Project</a> · <a href="https://github.com/siteboon/claudecodeui/issues">Upstream Issues</a> · <a href="CONTRIBUTING.md">Contributing</a>
</p>

<div align="right"><i><a href="./README.md">English</a> · <a href="./README.zh-CN.md">中文</a> · <a href="./README.ja.md">日本語</a></i></div>

## 현재 상태

이 프로젝트는 현재도 활발히 개발 중입니다.

이 fork는 내부 테스트에는 사용할 수 있지만, 제품 경계, 명칭, 문서는 아직 정리 중입니다. 특히 멀티 agent 워크플로우 쪽은 UX 거칠음이나 동작 변경이 계속 있을 수 있습니다.

## Fork 안내

이 저장소는 [`siteboon/claudecodeui`](https://github.com/siteboon/claudecodeui)를 기반으로 시작한 fork이며, 많은 커스텀 수정이 들어가 있습니다.

현재 fork에는 주로 다음이 포함됩니다.

- 멀티 agent 조정을 위한 기본 기능과 `Coordination` 패널
- Pantheon 이벤트 소싱, handoff 라우팅, 승인 센터 기초
- Claude, Codex, Gemini 세션 탐지 개선
- 워크스페이스 불일치 및 Gemini resume identifier 관련 수정
- 셀프호스팅 멀티 agent 워크플로우를 위한 제품/UI 정리

## 빠른 시작

### 로컬 실행

요구 사항:

- Node.js 22+
- npm
- 연동하려는 로컬 CLI가 이미 설치되어 있어야 합니다. 예:
  - Claude Code
  - Codex CLI
  - Gemini CLI

의존성 설치 후 실행:

```bash
npm install
npm run build
npm run server
```

그 다음 `http://localhost:3001`을 엽니다.

이 fork는 현재 관련 agent CLI가 이미 설치된 로컬 머신이나 서버에서 셀프호스팅으로 사용하는 것을 전제로 합니다.

## 현재 가능한 기능

- Claude, Codex, Gemini, Cursor 기존 세션 탐지
- 세션 재개 및 provider Shell 터미널 열기
- 하나의 UI에서 파일과 프로젝트 상태 확인
- `Coordination` 탭에서 명시적 handoff 생성
- 워크스페이스별 Pantheon 이벤트 로그 기록
- 터미널 네이티브 agent를 위한 MCP handoff

## Coordination 워크플로우

멀티 agent 조정의 주요 진입점은 `Coordination` 탭입니다.

일반적인 흐름:

1. 프로젝트를 열고 `Pantheon Sessions`에 조정할 세션을 등록합니다.
2. `Create Handoff`를 사용해 `@claude`, `@codex`, `@gemini`, `@human`, `@all`로 작업을 보냅니다.
3. `Event Feed`에서 다음을 확인합니다.
   - `handoff`
   - `handoff_delivery`
   - `manual_attention_required`
4. `Whiteboard Snapshot`과 `Approval Center`로 현재 워크스페이스 상태를 추적합니다.

참고:

- 프로젝트 표시는 경로 기준으로 묶이지만, 실제 라우팅은 현재 세션의 워크스페이스 경로를 우선 사용합니다.
- 대상 세션을 자동으로 재개하거나 주입할 수 없으면 handoff는 `manual_attention_required`로 fallback 될 수 있습니다.

## 터미널 MCP Handoff

이 fork에는 Pantheon MCP server가 포함되어 있어, 터미널 네이티브 agent가 공식 handoff를 위해 텍스트 `@target` 파싱에 의존할 필요가 없습니다.

현재 포함된 MCP 도구:

- `pantheon_handoff`

서버 엔트리포인트:

- [server/pantheon/mcp-server.js](./server/pantheon/mcp-server.js)

### Claude Code

Pantheon MCP server를 user 범위로 등록하여 모든 Claude Code 세션에서 사용할 수 있게 합니다:

```bash
claude mcp add --scope user pantheon -- \
  node /path/to/claudecodeui/server/pantheon/mcp-server.js \
  --provider claude \
  --base-url http://127.0.0.1:3001
```

또는 `~/.claude.json`을 직접 편집합니다:

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

MCP server는 최종적으로 다음으로 전달됩니다:

- `POST /api/pantheon/handoff`

### Codex CLI

Codex CLI에서는 같은 MCP server를 등록할 수 있습니다.

```bash
codex mcp add pantheon -- \
  node /root/codexDir/claudecodeui/server/pantheon/mcp-server.js \
  --provider codex \
  --base-url http://127.0.0.1:3001
```

시작이 느리면 `~/.codex/config.toml`에 다음을 추가하세요.

```toml
[mcp_servers.pantheon]
startup_timeout_sec = 30
```

### Handoff 계약

공식적인 agent 간 작업 전달에는 MCP handoff를 우선 사용하는 방향입니다.

권장 필드:

- `to`
- `task`
- `workspacePath`
- 선택적 `artifacts`
- 선택적 `note`

현재 방향:

- 터미널 agent: `pantheon_handoff` 우선
- Web UI 세션: 응답 말미의 텍스트 handoff 파싱은 fallback으로 유지

## 현재 제한 사항

- 일부 provider별 라우팅은 아직 거친 부분이 있습니다
- 일부 handoff 대상은 직접 전달 대신 manual attention으로 fallback될 수 있습니다
- 문서와 명칭은 계속 정리 중입니다
- 이 fork는 아직 별도 npm 패키지로 배포되지 않았습니다

## Upstream

원본 프로젝트:

- [`siteboon/claudecodeui`](https://github.com/siteboon/claudecodeui)
