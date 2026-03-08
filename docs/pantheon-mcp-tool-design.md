# Pantheon MCP Tool Design

## Goal

Add a first-class MCP tool for cross-agent handoffs so terminal-native agents like Claude Code do not need to rely on reply-text parsing or WebSocket-only UI flows.

Working name:

- `pantheon_handoff`

Primary outcome:

- An agent can call a tool with structured input like `to`, `task`, `artifacts`, and `workspacePath`.
- The server converts that directly into a Pantheon handoff event and dispatches it through the existing bus.

This is intended to replace text-based `@target` parsing as the long-term path for terminal agents.

## Why MCP

Current state:

- `claudecodeui` WebSocket sessions can trigger automatic handoffs by parsing final assistant replies.
- Native terminal sessions outside the `claudecodeui` WebSocket path are invisible to that parser.
- Text parsing is fragile even in the UI path because it depends on reply formatting and provider-specific streaming events.

MCP improves this by making handoff an explicit tool call instead of an inferred text convention.

Benefits:

- No ambiguous `@target` parsing
- Works for terminal agents
- Easier auditing
- Easier validation and permission control
- Same server-side delivery path as current Pantheon handoffs

## Scope

MVP scope for MCP integration:

- Add a Pantheon MCP server with one tool: `pantheon_handoff`
- Tool call writes a normal Pantheon `handoff` event via existing `createPantheonHandoff`
- Tool call reuses current dispatch logic in `dispatchPantheonHandoffResult`
- Keep current text-based parser as fallback for `claudecodeui` UI sessions

Out of scope for this first MCP iteration:

- New planning/orchestration logic
- Automatic multi-target decomposition
- Replacing the existing `Coordination` UI
- New approval center behavior
- General MCP marketplace or agent registry changes

## Proposed Architecture

### 1. New Pantheon MCP server

Add a lightweight MCP server process that exposes:

- `pantheon_handoff`
- optionally later:
  - `pantheon_list_sessions`
  - `pantheon_get_whiteboard`
  - `pantheon_get_state`

Implementation shape:

- new MCP wrapper process, for example:
  - `server/pantheon/mcp-server.js`
- stdio transport first
- registered into Claude Code / Codex / Gemini CLI as a normal MCP server

This keeps Pantheon logic inside the existing app and does not require a second database or second coordination layer.

Important constraint:

- the MCP server should not own Pantheon dispatch logic
- the `claudecodeui` server process remains the source of truth for:
  - event creation
  - handoff dispatch
  - WebSocket broadcast
  - UI synchronization

### 2. Tool handler path

Tool invocation flow:

1. Agent calls `pantheon_handoff`
2. MCP server validates and normalizes input
3. MCP server sends a request to the host app:
   - `POST /api/pantheon/handoff`
4. Host app calls existing Pantheon functions:
   - `createPantheonHandoff(workspacePath, input)`
   - `dispatchPantheonHandoffResult(result)`
5. Existing Pantheon bus decides:
   - target session
   - chat send vs shell fallback
   - event feed updates
   - `manual_attention_required` if delivery fails

That means MCP is only a new ingress path, not a parallel orchestration system.

This also solves the IPC boundary cleanly:

- the MCP server is a separate stdio process
- the host app remains the only process that touches WebSocket broadcasts
- MCP does not need direct access to `connectedClients`, writers, or closure-scoped dispatch helpers

## Tool Contract

### Tool name

- `pantheon_handoff`

### Input schema

```json
{
  "to": "claude | codex | gemini | human | all",
  "task": "string",
  "artifacts": ["string"],
  "note": "string",
  "workspacePath": "string",
  "targetSessionId": "string",
  "targetProvider": "string",
  "from": "string"
}
```

### Required fields

- `to`
- `task`
- `workspacePath`

### Optional fields

- `artifacts`
- `note`
- `targetSessionId`
- `targetProvider`
- `from`

### Semantics

- `to`
  - logical Pantheon target
  - usually `claude`, `codex`, `gemini`, `human`, or `all`
- `task`
  - main handoff payload
- `artifacts`
  - relevant files, doc paths, or contract references
- `note`
  - extra context appended after the task
- `workspacePath`
  - authoritative workspace for this handoff
  - should be the calling session's real cwd/project root
- `targetSessionId`
  - optional explicit target session
  - if omitted, existing Pantheon resolution rules apply
- `targetProvider`
  - optional explicit provider override
  - defaults to `to`
- `from`
  - optional in tool input
  - defaults to the MCP server's configured provider identity
  - examples:
    - `claude`
    - `codex`
    - `gemini`

### Normalized message

Server combines `task` and `note` into the existing Pantheon event `message` field:

```text
<task>

Note: <note>
```

This keeps the MCP path compatible with the current event format and UI rendering.

## Output schema

Recommended MCP tool result:

```json
{
  "ok": true,
  "eventId": "string",
  "workspacePath": "string",
  "to": "string",
  "targetProvider": "string",
  "targetSessionId": "string | null",
  "status": "queued | delivered | attention",
  "prompt": "string"
}
```

If delivery is not immediate, the tool should still return success for handoff creation as long as the event is recorded successfully.

Recommended behavior:

- `ok: true` if the handoff event was created
- delivery outcome still reflected in Pantheon events
- if input validation fails, return MCP tool error

## Server Integration Plan

### Minimal code path

Add a new function that can be reused by both WebSocket and REST entrypoints:

- `createAndDispatchPantheonHandoff(workspacePath, input)`

Suggested behavior:

1. `const result = await createPantheonHandoff(workspacePath, input)`
2. `await dispatchPantheonHandoffResult(result)`
3. return a small normalized result object

This avoids duplicating logic between:

- `pantheon:create-handoff` WebSocket handler
- future REST endpoint used by the MCP server

### Recommended extraction

Current server code already has:

- `createPantheonHandoff`
- `dispatchPantheonHandoffResult`

The main cleanup would be to expose a shared helper in a Pantheon service module instead of leaving dispatch only inside the WebSocket connection scope.

Suggested module:

- `server/pantheon/service.js`

Exports:

- `createAndDispatchPantheonHandoff`
- optionally later:
  - `syncPantheonWorkspace`
  - `registerPantheonSession`
  - `unregisterPantheonSession`

This service module should accept host-process dependencies explicitly, for example:

- `broadcastPantheonPayload`
- any helper needed to resolve target sessions

That keeps the service testable while still allowing the main server process to own live WebSocket state.

### REST bridge

Recommended host-side endpoint:

- `POST /api/pantheon/handoff`

Suggested request body:

```json
{
  "workspacePath": "/root/codexDir/MeowPaw2",
  "to": "codex",
  "task": "Implement the API contract updates.",
  "artifacts": ["whiteboard.md", "api_spec.json"],
  "note": "Focus on token shape.",
  "targetSessionId": "optional-session-id",
  "targetProvider": "optional-provider",
  "from": "claude"
}
```

Suggested behavior:

- validate body
- call `createAndDispatchPantheonHandoff`
- return normalized result JSON

This is the recommended IPC path between the MCP stdio process and the host UI/server process.

## Registration Model

There are two ways to expose the MCP server.

### Option A. User/local MCP registration in Claude Code

Register Pantheon as a local MCP server using existing Claude MCP config flow.

Pros:

- Matches how Claude Code already loads MCP servers
- Reuses current MCP UI/admin surface in `claudecodeui`

Cons:

- Only directly solves Claude-side installation first

### Option B. Per-provider MCP adapters

Add provider-specific install docs for:

- Claude Code
- Codex CLI
- Gemini CLI

Pros:

- Makes Pantheon available everywhere

Cons:

- More setup documentation
- Provider-specific config differences

Recommendation:

- Build the MCP server once
- document Claude Code first
- add Codex/Gemini install recipes after validation

## Suggested Tool Usage Policy

Add guidance to shared docs and `CLAUDE.md`:

- Do not use text `@target` when MCP tool is available
- Use `pantheon_handoff` for formal task transfer
- Only hand off one target at a time
- If unsure who should take the next step, hand off to `human`

Example instruction:

```text
When you want to transfer work to another agent, call the `pantheon_handoff` tool.
Do not emit plain-text @mentions for formal handoffs unless the MCP tool is unavailable.
```

## Example Tool Calls

### Claude to Codex

```json
{
  "to": "codex",
  "task": "Implement the API contract updates for login response handling.",
  "artifacts": [
    "whiteboard.md",
    "api_spec.json",
    "src/types/auth.ts"
  ],
  "note": "Focus on token shape and error response consistency.",
  "workspacePath": "/root/codexDir/MeowPaw2"
}
```

### Codex back to Claude for review

```json
{
  "to": "claude",
  "task": "Review the login API implementation and identify regressions.",
  "artifacts": [
    "src/server/auth.ts",
    "src/types/auth.ts"
  ],
  "workspacePath": "/root/codexDir/MeowPaw2"
}
```

### Agent escalation to human

```json
{
  "to": "human",
  "task": "Approval flow is blocked because target session is unavailable. Please decide whether to retry or redirect.",
  "artifacts": [
    "whiteboard.md"
  ],
  "workspacePath": "/root/codexDir/MeowPaw2"
}
```

## Failure Modes

### 1. Valid tool call, delivery fails

Example:

- target session not registered
- target provider unavailable
- chat send and shell fallback both fail

Desired behavior:

- MCP tool returns success for event creation
- Pantheon writes `manual_attention_required`
- UI/event log shows the failure reason

### 2. Invalid workspace path

Desired behavior:

- reject tool call
- return structured error
- do not create event

### 3. Invalid target

Desired behavior:

- reject tool call
- do not create event

### 4. Ambiguous target session

Desired behavior:

- if no explicit `targetSessionId`, use existing Pantheon resolution rules
- if the caller requires exact routing, it should provide `targetSessionId`

## Provider Identity

The MCP server needs a stable notion of who the caller is.

Recommended approach:

- the MCP server process starts with a provider identity flag
- example:
  - `--provider claude`
  - `--provider codex`
  - `--provider gemini`

Then:

- tool input `from` becomes optional
- if omitted, the server uses the configured provider identity

This is safer than relying on the model to always include `from` correctly in every call.

## Security Notes

The MCP tool should be constrained to Pantheon-safe actions only:

- create a handoff
- read Pantheon state in future extensions

It should not:

- execute arbitrary shell commands
- modify arbitrary files
- bypass existing approval checks

Server-side validation should still use:

- `validateWorkspacePath`
- existing Pantheon target normalization

## Recommended Rollout

### Phase 1

- Design and host-side extraction only
- introduce `createAndDispatchPantheonHandoff`
- move dispatch/broadcast logic into `server/pantheon/service.js`
- no MCP process yet

### Phase 2

- Add host endpoint:
  - `POST /api/pantheon/handoff`
- Add `pantheon_handoff` MCP server as a thin stdio wrapper over that REST endpoint
- document Claude Code integration
- verify end-to-end from terminal Claude Code into Pantheon bus

### Phase 3

- Add provider setup docs for Codex CLI and Gemini CLI
- optionally add:
  - `pantheon_get_state`
  - `pantheon_list_sessions`

## Implementation Decision

For IPC between the MCP tool process and the host app, use:

- REST bridge

Do not use as the primary path:

- direct inbox writes from the MCP process
- direct access from the MCP process to WebSocket internals
- embedded MCP transport changes as the first implementation

Reason:

- REST keeps host ownership of dispatch and broadcast
- REST is simple to test
- REST minimizes process-coupling
- REST matches the current architecture better than file-watcher polling

## Recommendation

Build `pantheon_handoff` as the next formal ingress path for cross-agent coordination.

Rationale:

- UI handoffs are already working
- terminal-native handoffs are currently the missing link
- MCP is cleaner and more durable than transcript hooks or plain-text parsing
- the current Pantheon bus already provides almost all downstream behavior needed

Short version:

- keep text parsing for `claudecodeui` UI replies as a fallback
- use MCP tool calls as the long-term path for official terminal CLIs
- bridge MCP to the host app through `POST /api/pantheon/handoff`
