# Pantheon Final Implementation Plan

## Purpose

This document is the consolidated implementation plan for the first Pantheon MVP.

It combines:

- the original Pantheon design direction
- provider support analysis
- host platform evaluation
- Claude review feedback
- Gemini implementation blueprint

The goal is to define a version that is:

- small enough to ship
- safe enough to trust
- modular enough to migrate later

## Final Product Decision

Pantheon MVP will be implemented inside **CloudCLI UI** as a thin extension layer.

Reason:

- it already behaves like an operator console
- it already hosts provider sessions
- it is browser-based and fits centralized approval well
- it is lower-cost to modify than Codeg

This is an MVP host decision, not a permanent platform commitment.

Pantheon modules must be written so they can be migrated later if needed.

## Final MVP Goal

Validate one core product hypothesis:

**Can a human coordinate multiple official AI CLIs more effectively through a shared handoff/event layer and a unified Claude-first approval center?**

Everything outside this hypothesis is deferred.

## Final MVP Scope

## In Scope

- explicit handoff routing between `@claude`, `@codex`, `@gemini`, `@human`, `@all`
- append-only event storage in `pantheon/inbox.jsonl`
- a browser-visible coordination event feed
- Claude-first unified approval center
- generated `whiteboard.md` snapshot
- provider/session/workspace attribution on every event

## Out of Scope

- Control Assistant
- `whiteboard.md` as source of truth
- PTY-based approval inference
- Codex semantic approval integration
- Gemini semantic approval integration
- autonomous task planning
- multi-agent concurrent editing controls
- generalized planner/orchestrator intelligence

## Final Architecture

Pantheon is a narrow namespace inside CloudCLI UI.

### Worker Layer

Official provider runtimes remain unchanged in responsibility:

- Claude Code
- Codex
- Gemini CLI

They remain the workers.

### Host Layer

CloudCLI UI remains responsible for:

- session hosting
- provider communication
- WebSocket transport
- UI rendering

### Pantheon Layer

Pantheon adds:

- event recording
- handoff routing
- coordination state projection
- approval aggregation for supported providers

## Final Module Layout

Recommended backend modules:

- `server/pantheon/events.js`
- `server/pantheon/bus.js`
- `server/pantheon/approvals.js`
- `server/pantheon/whiteboard.js`
- `server/pantheon/types.js`

Recommended frontend modules:

- `src/components/coordination/CoordinationPanel.tsx`
- `src/components/coordination/EventFeed.tsx`
- `src/components/coordination/ApprovalCenter.tsx`
- `src/components/coordination/WhiteboardSnapshot.tsx`
- `src/components/coordination/useCoordinationState.ts`

## Data Model

## Source of Truth

Primary coordination state is append-only:

- `pantheon/inbox.jsonl`

Each line is one event.

This is the MVP state source for:

- handoffs
- completions
- approval requests
- approval decisions
- manual attention markers

## Derived State

Human-readable projection:

- `whiteboard.md`

Optional future machine-readable projections:

- `pantheon/tasks.json`
- `pantheon/index.json`

These are not required for the first MVP.

## Event Schema

Minimum event envelope:

```json
{
  "id": "evt_001",
  "type": "handoff",
  "workspacePath": "/workspace/project-x",
  "sessionId": "session_abc",
  "provider": "claude",
  "from": "claude",
  "to": "codex",
  "message": "Validate api_spec.json",
  "artifacts": ["whiteboard.md", "api_spec.json"],
  "status": "queued",
  "createdAt": "2026-03-08T10:00:00Z"
}
```

Approval event example:

```json
{
  "id": "evt_002",
  "type": "approval_request",
  "workspacePath": "/workspace/project-x",
  "sessionId": "session_abc",
  "provider": "claude",
  "requestId": "tool_req_123",
  "toolName": "Bash",
  "summary": "Run npm install",
  "context": {
    "command": "npm install"
  },
  "status": "pending",
  "createdAt": "2026-03-08T10:01:00Z"
}
```

## State Rules

These rules are mandatory for MVP:

- `inbox.jsonl` is authoritative
- `whiteboard.md` is a projection, not the source of truth
- event writes must be append-only
- event records must never be silently mutated in place
- approval decisions must be auditable

## Approval Strategy

## Claude

Claude is the only provider with first-class approval support in MVP.

Pantheon should integrate with explicit host interfaces for:

- new pending approval request
- lookup pending approvals
- resolve approval decision

Pantheon should not depend on raw internal mutable structures if a narrow interface can be exposed instead.

## Codex

Codex is included in MVP as a handoff-capable worker only.

MVP behavior:

- route tasks to Codex
- show Codex-related events in the event feed
- if operator attention is needed, mark it explicitly

Pantheon will not attempt semantic Codex approval parsing in MVP.

## Gemini

Gemini is included in MVP as a handoff-capable worker only.

MVP behavior:

- route tasks to Gemini
- show Gemini-related events in the event feed
- if operator attention is needed, mark it explicitly

Pantheon will not attempt semantic Gemini approval parsing in MVP.

## Failure Policy

This is critical.

If a provider cannot be safely normalized:

- do not guess
- do not silently block
- do not pretend approval state is known

Instead:

- emit a `manual_attention_required` event
- show it in the coordination panel
- let the operator handle it through the existing terminal/session UI

For MVP, false positives are preferable to silent false negatives.

## Handoff Strategy

## Primary MVP Path

The first reliable handoff path should be explicit.

That means:

- user-triggered handoff actions from UI
- or clearly structured Pantheon-generated handoff prompts

## Secondary MVP Path

Text-based `@mention` detection may be added in a conservative way, but it must not be the only handoff mechanism.

Rules:

- detect only obvious targets such as `@claude`, `@codex`, `@gemini`, `@human`, `@all`
- avoid triggering on partial or ambiguous text
- if parsing confidence is low, do not auto-route

This keeps the system debuggable and prevents accidental handoffs.

## Handoff Prompt Format

Injected prompts should be explicit:

```text
[Pantheon Handoff]
From: claude
To: codex
Workspace: /workspace/project-x
Relevant files:
- whiteboard.md
- api_spec.json
Task:
Validate the API contract and report mismatches. Reply to @human when done.
```

## Whiteboard Projection

`whiteboard.md` should be generated from recent event history and current state.

Suggested sections:

- current task
- active owner
- recent handoffs
- open approvals
- blockers
- related artifacts

The whiteboard should be easy for humans and agents to read, but Pantheon should not rely on agents editing it correctly to preserve state.

## WebSocket Protocol

Recommended additions:

### Client to Server

- `pantheon:sync`
- `pantheon:create-handoff`
- `pantheon:list-events`
- `pantheon:list-pending-approvals`
- `pantheon:resolve-approval`

### Server to Client

- `pantheon:state`
- `pantheon:event`
- `pantheon:pending-approvals`
- `pantheon:approval-updated`
- `pantheon:whiteboard-updated`

## Host Integration Boundaries

Pantheon should integrate with CloudCLI UI through narrow seams.

Preferred touchpoints:

- `server/index.js`
  - register Pantheon WebSocket message handlers
  - forward host-level events into Pantheon
- `server/claude-sdk.js`
  - expose approval interfaces usable by Pantheon
- frontend app shell
  - mount a coordination panel

Non-goal:

- embedding Pantheon logic deeply into existing provider-specific execution code

If an internal host change is required, prefer extracting a reusable interface rather than directly wiring Pantheon to implementation details.

## Frontend Plan

Add one operator-focused coordination surface.

The panel should contain:

### 1. Event Feed

Shows:

- handoffs
- completions
- approval requests
- approval decisions
- manual attention markers

### 2. Approval Center

Shows:

- Claude pending approvals in MVP
- provider, session, workspace, summary, timestamp
- approve/reject actions

### 3. Whiteboard Snapshot

Shows:

- current task
- current owner
- blockers
- recent artifacts

This should be a compact operator-facing panel, not a second full chat surface.

## Implementation Phases

## Phase 1: Event Foundation

Deliverables:

- `server/pantheon/events.js`
- append-only `inbox.jsonl` writer
- event loading and replay
- generated `whiteboard.md`
- WebSocket sync for coordination state

Success criteria:

- restarting the server restores the event feed from `inbox.jsonl`
- `whiteboard.md` can be regenerated from stored events

## Phase 2: Handoff Bus

Deliverables:

- `server/pantheon/bus.js`
- explicit handoff creation path
- session lookup and handoff prompt injection
- frontend event feed panel

Success criteria:

- operator can hand off a task from one provider to another
- destination session receives a structured Pantheon handoff
- event feed reflects the transition

## Phase 3: Claude Approval Center

Deliverables:

- `server/pantheon/approvals.js`
- Claude approval bridge
- unified approval cards in coordination panel
- approval decisions written to event log

Success criteria:

- a Claude approval request appears in the Pantheon approval center
- approving or rejecting from the panel resolves the active request
- the approval outcome is recorded in `inbox.jsonl`

## Explicit Non-Goals For MVP

Do not implement these in the first version:

- Control Assistant
- speculative PTY parsing for Codex or Gemini approvals
- autonomous routing decisions
- background task decomposition
- generalized workflow DAGs
- whiteboard merge logic between agents

## Main Risks

### 1. Host Coupling

Risk:

- Pantheon becomes hard-wired into CloudCLI UI internals

Mitigation:

- define narrow interfaces early
- isolate new logic in `server/pantheon/`

### 2. Accidental Scope Growth

Risk:

- handoff, approvals, projections, and assistant logic all get mixed together

Mitigation:

- keep Control Assistant out of MVP
- gate each phase by explicit success criteria

### 3. Ambiguous Handoff Detection

Risk:

- auto-detected `@mentions` misfire

Mitigation:

- explicit handoff path first
- conservative parsing second

### 4. Provider Unevenness

Risk:

- approval model feels inconsistent across providers

Mitigation:

- make Claude-first status explicit
- mark other providers as manual-attention when needed

## Final Recommendation

Build Pantheon MVP now as:

- event-sourced
- CloudCLI-hosted
- explicit-handoff-first
- Claude-first for approvals
- small enough to finish

This is the narrowest version that still tests the core value of multi-agent coordination without pretending provider capabilities are more uniform than they really are.

## Temporary Agent Handoff Rule

For the current test phase, `@mentions` should be treated as a deliberate handoff signal, not normal conversation text.

Rules:

- do not use `@claude`, `@codex`, `@gemini`, `@human`, or `@all` during normal discussion
- use `@target` only when the current agent has finished its part and is explicitly handing work to the next agent
- place the `@target` handoff block at the end of the reply
- use only one `@target` per reply
- if no clear next owner exists, hand off to `@human`

Temporary example:

```text
Finished updating the contract draft.

@codex
task: Validate the API shape and update the related types.
artifacts: api_spec.json, src/types/auth.ts
note: Focus on token fields and error response shape.
```
