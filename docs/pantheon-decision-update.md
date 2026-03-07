# Pantheon Decision Update

## Purpose

This document updates the Pantheon direction after reviewing:

- [pantheon-extension-design.md](/root/codexDir/claudecodeui/docs/pantheon-extension-design.md)
- [provider-support-analysis.md](/root/codexDir/claudecodeui/docs/provider-support-analysis.md)
- [host-platform-evaluation.md](/root/codexDir/claudecodeui/docs/host-platform-evaluation.md)
- [pantheon-design-review-claude.md](/root/codexDir/claudecodeui/docs/pantheon-design-review-claude.md)

The goal is to tighten the MVP and clarify decisions before asking Gemini for further review.

## Current Decision

Pantheon remains:

- a thin coordination layer
- hosted inside CloudCLI UI for the first MVP
- built around official CLIs as workers
- centered on handoff, event visibility, and human approval

Pantheon is still **not**:

- a replacement for official CLIs
- a new autonomous agent runtime
- a full task planner
- a control assistant-led workflow

## Decisions After Claude Review

## Adopted Changes

### 1. `pantheon/inbox.jsonl` becomes required for MVP

Adopted.

Reason:

- append-only events are safer than shared markdown writes
- easier to audit
- easier to replay
- lower concurrency risk

This file becomes the primary state source for handoff and completion events.

### 2. `whiteboard.md` is downgraded to a generated snapshot

Adopted.

Reason:

- markdown is a poor primary state source under concurrent writes
- state should be machine-safe first, human-readable second

Revised role of `whiteboard.md`:

- current summary
- current owner
- recent decisions
- blockers
- artifact pointers

It should be generated or refreshed from event/state data, not treated as the authoritative source.

### 3. Remove Control Assistant from MVP

Adopted.

Reason:

- it is not needed to validate the core hypothesis
- it adds product and safety ambiguity
- it increases scope too early

Control Assistant is now explicitly deferred until after the first working handoff + approval loop is proven valuable.

### 4. Do not implement Tier 2 PTY approval parsing in MVP

Adopted.

Reason:

- output parsing is brittle
- maintenance cost is high
- false negatives are dangerous

For non-Claude providers in MVP:

- do not attempt semantic approval detection from PTY output
- fall back to `manual attention required`

### 5. Tighten module boundaries

Adopted in principle.

Reason:

- Pantheon should remain migratable
- coupling directly to CloudCLI UI internals would make later extraction painful

Revised guidance:

- Pantheon modules should talk to host provider modules through narrow interfaces
- avoid direct reads of internal mutable maps where possible
- avoid embedding Pantheon logic inside unrelated provider internals

## Partially Adopted Changes

### 6. GPL-3.0 should be treated as a strategic constraint

Partially adopted.

Updated stance:

- GPL-3.0 is now treated as a real long-term product constraint
- it does not block MVP exploration
- it should remain part of host selection and commercialization decisions

Current decision:

- still use CloudCLI UI for the first MVP
- keep Pantheon modules logically isolated enough that migration to another host remains possible

## Revised MVP

The revised MVP is intentionally smaller.

### In Scope

- `@claude`, `@codex`, `@gemini`, `@human`, `@all` handoff routing
- append-only event log via `pantheon/inbox.jsonl`
- event feed in the operator console
- Claude-first approval center
- generated `whiteboard.md` snapshot
- explicit provider/session/workspace attribution for every event

### Out of Scope

- Control Assistant
- `whiteboard.md` as source of truth
- Codex approval normalization
- Gemini approval normalization
- PTY-based approval inference
- autonomous task planning
- multi-agent simultaneous editing controls

## Revised State Model

### Source of Truth

Primary source:

- `pantheon/inbox.jsonl`

Optional supporting state:

- `pantheon/tasks.json`
- `pantheon/artifacts.json`

### Human-Readable Projection

Derived files:

- `whiteboard.md`
- `design_spec.md`
- `api_spec.json`

These may still be edited by humans or workers as artifacts, but the coordination state itself should be derived from append-only event data.

## Revised Approval Strategy

### Claude

First-class provider for approval support in MVP.

Use existing host capabilities:

- pending approval request lookup
- approval resolution
- reconnect-safe approval recovery

### Codex

MVP behavior:

- supported as a worker for handoff and session routing
- not included in unified semantic approval support yet
- if approval handling is unclear, surface manual attention

### Gemini

MVP behavior:

- supported as a worker for handoff and session routing
- not included in unified semantic approval support yet
- if approval handling is unclear, surface manual attention

## Revised Module Boundaries

Pantheon should be built as a narrow extension namespace.

Suggested modules:

- `server/pantheon/bus.js`
- `server/pantheon/events.js`
- `server/pantheon/approvals.js`
- `server/pantheon/whiteboard.js`

Preferred integration pattern:

- host modules expose callbacks or query methods
- Pantheon consumes those interfaces
- Pantheon does not directly own provider execution logic

If host internals must be touched, changes should aim to create reusable interfaces rather than embed Pantheon-specific logic.

## Open Questions For Gemini Review

These are the highest-value questions still worth asking Gemini:

### 1. Is `claudecodeui` still the right MVP host after this scope reduction?

The answer may change now that Pantheon is smaller and more event-driven.

### 2. Is `pantheon/inbox.jsonl` enough as the sole MVP state source?

Or should there be a compact indexed state file from day one?

### 3. Is `@mention` routing enough, or should handoff creation be explicit UI-first actions in MVP?

This affects product complexity and debugging.

### 4. Should `whiteboard.md` be strictly generated-only in MVP, or human-editable with clear overwrite rules?

This affects usability versus consistency.

### 5. Is there a cleaner interface pattern for integrating with Claude approvals without coupling to current internals?

This is the most important technical boundary question.

## Bottom Line

After Claude review, Pantheon is now defined more narrowly and more safely:

- event-sourced instead of markdown-sourced
- Claude-first for approvals
- handoff-focused
- no Control Assistant in MVP
- no PTY approval inference in MVP

This is a better first version because it validates the core hypothesis with fewer moving parts and lower safety risk.
