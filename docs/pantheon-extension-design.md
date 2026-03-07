# Pantheon Extension Design

## Summary

This document proposes a minimal, reversible way to extend CloudCLI UI into a multi-agent collaboration console for official AI CLIs such as Claude Code, Codex, and Gemini CLI.

The core idea is:

- Keep official CLIs as the workers
- Keep CloudCLI UI as the operator console and session host
- Add a thin orchestration layer for handoff, routing, approval aggregation, and shared state

This is an event-driven async collaboration model, not a fully autonomous swarm.

## Product Positioning

Pantheon should not replace provider-specific agent logic.

Pantheon should provide:

- persistent sessions
- targeted handoffs between agents
- shared task state
- unified approval visibility
- human-in-the-loop control
- optional control-assistant summaries for the operator

Pantheon should not provide:

- a new code generation engine
- a custom editor/runtime for agent work
- direct business-code mutation outside the provider CLIs
- a second approval system that conflicts with provider-native permissions

## Operating Model

Each provider session remains long-lived and resumable, but usually idle.

Typical flow:

1. Human or agent updates `whiteboard.md` and creates or changes a task.
2. A handoff message is sent to a target agent, for example `@codex validate api_spec.json`.
3. The target agent resumes its own context, reads the relevant files, and works.
4. If the agent needs approval, the request is surfaced in the shared approval center.
5. When done, the agent sends a completion or handoff event back to another agent or the human.

This reduces conflicts compared with concurrent multi-agent editing.

## Roles

### Worker Agents

- `claude`: implementation and refactoring
- `codex`: contract review, API and schema consistency
- `gemini`: product, design, document-heavy analysis

Worker agents own execution in their native CLIs.

### Human Operator

- approves risky actions
- resolves disagreements
- triggers handoffs
- edits shared task intent when needed

### Control Assistant

An optional read-mostly LLM attached to the operator console.

It should:

- summarize current state
- explain pending approvals
- identify blockers
- recommend the next handoff

It should not directly execute code or shell commands by default.

## Architecture

### Existing Useful Subsystems

CloudCLI UI already contains strong building blocks:

- WebSocket server and session orchestration in `server/index.js`
- provider-specific adapters in:
  - `server/claude-sdk.js`
  - `server/openai-codex.js`
  - `server/gemini-cli.js`
  - `server/cursor-cli.js`
- persistent UI session handling
- pending permission recovery for Claude sessions
- integrated shell, chat, file tree, and project views

This makes CloudCLI UI a suitable host for Pantheon.

### New Pantheon Modules

Add a narrow extension layer instead of modifying provider adapters deeply.

#### 1. Collaboration Bus

Responsibilities:

- receive handoff messages
- parse mentions such as `@claude`, `@codex`, `@gemini`, `@all`, `@human`
- persist routing events
- deliver routed prompts into the correct session

Recommended location:

- `server/pantheon/bus.js`

#### 2. Shared State Store

Responsibilities:

- track collaboration tasks and ownership
- maintain whiteboard metadata
- record artifact references
- store handoff history and completion signals

Recommended storage for MVP:

- markdown/json files inside the project workspace
- lightweight metadata in existing app database only when useful for indexing

Recommended location:

- `server/pantheon/state.js`

#### 3. Approval Center

Responsibilities:

- aggregate provider approval requests into one operator view
- expose provider, session, requested action, context, and age
- return operator decisions to the provider-specific resolver

Recommended location:

- `server/pantheon/approvals.js`

#### 4. Control Assistant Service

Responsibilities:

- consume recent bus events and state snapshots
- produce operator summaries and suggestions
- stay isolated from worker execution

Recommended location:

- `server/pantheon/control-assistant.js`

## State Model

### Workspace Files

These should live in the target project, not in CloudCLI UI itself.

- `whiteboard.md`
  - task summary
  - active owner
  - current blockers
  - recent decisions
- `design_spec.md`
  - UI and interaction output
- `api_spec.json`
  - API and data contract output

Optional later:

- `pantheon/inbox.jsonl`
- `pantheon/events.jsonl`
- `pantheon/tasks.json`

### Collaboration Records

For the MVP, model a handoff event like this:

```json
{
  "id": "evt_01",
  "type": "handoff",
  "from": "human",
  "to": "codex",
  "workspacePath": "/workspace/project-x",
  "sessionId": "session_abc",
  "message": "Validate api_spec.json and report mismatches.",
  "artifacts": ["api_spec.json", "whiteboard.md"],
  "status": "queued",
  "createdAt": "2026-03-07T12:00:00Z"
}
```

Approval events should use a provider-neutral shape:

```json
{
  "id": "apr_01",
  "provider": "claude",
  "sessionId": "session_abc",
  "requestId": "tool_req_123",
  "kind": "tool_approval",
  "toolName": "Bash",
  "summary": "Run npm install",
  "context": {
    "command": "npm install"
  },
  "status": "pending",
  "receivedAt": "2026-03-07T12:01:00Z"
}
```

## Event Flow

### Handoff Flow

1. Operator or worker emits a message containing one or more mentions.
2. Collaboration bus parses the target mentions.
3. Bus stores an event record.
4. Bus resolves the target session for the provider and workspace.
5. Bus writes a wrapped prompt into the target session.
6. UI shows the new handoff in the event feed and whiteboard snapshot.

Wrapped prompts should stay explicit and minimal, for example:

```text
[Pantheon Handoff]
From: codex
Workspace: /workspace/project-x
Relevant files:
- whiteboard.md
- api_spec.json
Task:
Validate the contract and report mismatches. Reply with @claude or @human when complete.
```

### Approval Flow

1. Provider-native adapter emits or exposes a pending approval request.
2. Approval center normalizes that request.
3. UI shows it in a shared approval panel.
4. Operator approves or denies.
5. Approval center forwards the decision back to the provider-specific resolver.
6. Event feed records the decision.

For Claude, the current implementation already exposes:

- pending approval lookup
- approval resolution
- reconnect-safe permission recovery

Pantheon should extend this pattern to other providers where possible and fall back to terminal passthrough where semantic approval events are unavailable.

### Control Assistant Flow

1. Operator asks a question such as "what is blocked?".
2. Control assistant reads recent bus events, pending approvals, and whiteboard summary.
3. It responds with:
   - status summary
   - blockers
   - recommended next handoff

The control assistant should not directly inject prompts into worker sessions without an explicit operator action.

## UI Design

### Additions to the Existing Console

CloudCLI UI already has chat, shell, sessions, and project navigation. Pantheon should add one top-level operator surface instead of scattering controls everywhere.

Recommended new panel or tab: `Coordination`

It should contain four sections:

#### 1. Event Feed

Shows:

- handoffs
- completions
- approval requests
- approval decisions
- whiteboard updates

#### 2. Approval Center

Shows all pending approvals across providers in one place.

Each card should include:

- provider
- workspace
- session
- summary
- raw details
- approve and reject actions

#### 3. Whiteboard Snapshot

Shows:

- current task
- current owner
- last decision
- known blockers
- related artifacts

#### 4. Control Assistant

Shows:

- short status summaries
- recommended next step
- explanation of approval risk

## Integration Points in This Repository

These are the most likely extension points for the MVP.

### Backend

- `server/index.js`
  - register new WebSocket message types
  - broadcast coordination events
  - expose pending approvals beyond a single session view
- `server/claude-sdk.js`
  - adapt current per-session approval tracking into a shared approval registry
- `server/routes/agent.js`
  - optional REST endpoints for handoff creation and task operations

### Frontend

- `src/components/app/AppContent.tsx`
  - bootstrapping for coordination state sync
- `src/components/chat/hooks/useChatRealtimeHandlers.ts`
  - already handles pending permissions; can subscribe to broader coordination events
- new feature folder:
  - `src/components/coordination/`

## WebSocket Protocol Additions

Suggested message types for the MVP:

### Client to Server

- `pantheon:create-handoff`
- `pantheon:list-events`
- `pantheon:list-pending-approvals`
- `pantheon:resolve-approval`
- `pantheon:get-control-summary`

### Server to Client

- `pantheon:event`
- `pantheon:pending-approvals`
- `pantheon:approval-updated`
- `pantheon:control-summary`
- `pantheon:whiteboard-updated`

These should coexist with existing provider-specific message types.

## Approval Strategy

Provider-native approval behaviors differ, so the design should be layered.

### Tier 1

Use structured provider-native approval APIs when available.

Current best candidate:

- Claude via `resolveToolApproval` and `getPendingApprovalsForSession`

### Tier 2

If a provider does not expose structured approval events, detect approval states conservatively from PTY output and present the terminal content directly.

### Tier 3

If approval cannot be normalized safely, do not automate it. Surface the session as "manual attention required" and let the operator act through the terminal view.

This keeps the system safe and avoids pretending all providers behave the same way.

## Security Model

Pantheon should preserve provider-native safety, not bypass it.

Key rules:

- approvals are always tied to a specific provider session
- approval actions must be auditable
- the control assistant cannot auto-approve
- worker-to-worker routing cannot silently escalate permissions
- whiteboard and event logs should record human overrides

## MVP Scope

The first usable version should stay narrow.

### In Scope

- route `@claude`, `@codex`, `@gemini`, `@human`, `@all`
- event feed
- shared approval center for Claude first
- whiteboard snapshot
- control assistant with read-only summaries

### Out of Scope

- autonomous multi-agent planning
- simultaneous file locking and merge resolution
- deep provider-specific approval automation for every CLI
- direct code editing by the control assistant

## Phased Delivery

### Phase 1

- backend collaboration bus
- event log
- handoff UI
- operator-visible event feed

### Phase 2

- unified approval center
- provider-neutral approval cards
- approval audit trail

### Phase 3

- whiteboard-aware control assistant
- next-step recommendations
- blocker summaries

### Phase 4

- richer artifact tracking
- optional task graph
- workspace-level inbox and notification rules

## Recommendation

Implement Pantheon as an extension layer inside CloudCLI UI, not as a rewrite and not as a separate competing UI.

The repository already has the right primitives:

- session hosting
- provider adapters
- WebSocket transport
- reconnect behavior
- operator-facing interface

The safest path is to add:

- one new backend namespace for coordination
- one new frontend coordination surface
- one provider-neutral approval registry
- one strictly limited control assistant

That should be enough to validate the product without fighting the existing architecture.
