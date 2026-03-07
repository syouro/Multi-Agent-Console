# Provider Support Analysis

## Purpose

This document summarizes how CloudCLI UI currently supports Claude, Codex, and Gemini CLI, with a focus on:

- session model
- execution model
- resume behavior
- approval behavior
- orchestration readiness for Pantheon

This is an analysis document only. It does not propose implementation details beyond identifying current strengths and gaps.

## Short Answer

CloudCLI UI already supports all three providers as usable agents:

- Claude
- Codex
- Gemini CLI

But support depth is not identical.

The current order of orchestration readiness is:

1. Claude
2. Codex
3. Gemini CLI

That ranking is mostly about approval and control-plane integration, not about model quality.

## Evidence in This Repository

Provider adapters exist here:

- [server/claude-sdk.js](/root/codexDir/claudecodeui/server/claude-sdk.js)
- [server/openai-codex.js](/root/codexDir/claudecodeui/server/openai-codex.js)
- [server/gemini-cli.js](/root/codexDir/claudecodeui/server/gemini-cli.js)

The main server imports all three in:

- [server/index.js](/root/codexDir/claudecodeui/server/index.js)

The project README also states support for Claude Code, Codex, and Gemini CLI:

- [README.md](/root/codexDir/claudecodeui/README.md)

## Provider Comparison

| Capability | Claude | Codex | Gemini CLI |
|---|---|---|---|
| Integration style | Native SDK | Native SDK | Child process / CLI wrapper |
| Active session tracking | Yes | Yes | Yes |
| Resume existing session | Yes | Yes | Yes, via stored CLI session ID |
| Structured streaming events | Strong | Strong | Partial, parsed from CLI output |
| Explicit approval control path | Yes | Partial at config level, not yet exposed as shared request objects | Mostly CLI approval modes, not shared request objects |
| Reconnect-safe pending approval recovery | Yes | Not found in same form | Not found in same form |
| Best fit for first Pantheon approval center | Yes | Maybe later | Later / fallback path |

## Claude

### Current Model

Claude is the deepest current integration.

It uses the Anthropic SDK directly rather than wrapping a terminal process:

- [server/claude-sdk.js](/root/codexDir/claudecodeui/server/claude-sdk.js)

This gives the app stronger control over:

- session lifecycle
- event streaming
- tool approval interception
- reconnect behavior

### Current Strengths

Claude already has:

- active session registry
- explicit pending approval tracking
- per-request approval resolution
- reconnect-safe approval recovery via WebSocket

Relevant code paths:

- pending approval registry in [server/claude-sdk.js](/root/codexDir/claudecodeui/server/claude-sdk.js)
- approval resolution and pending lookup wired in [server/index.js](/root/codexDir/claudecodeui/server/index.js)
- frontend recovery flow in [src/components/app/AppContent.tsx](/root/codexDir/claudecodeui/src/components/app/AppContent.tsx)
- frontend handling in [src/components/chat/hooks/useChatRealtimeHandlers.ts](/root/codexDir/claudecodeui/src/components/chat/hooks/useChatRealtimeHandlers.ts)

### What This Means for Pantheon

Claude is the strongest starting point for:

- unified approval center
- session handoff tracking
- operator-visible control flow

If Pantheon needs a first-class approval center in MVP, Claude should be the first provider integrated into it.

## Codex

### Current Model

Codex is also integrated as an SDK-based provider:

- [server/openai-codex.js](/root/codexDir/claudecodeui/server/openai-codex.js)

It starts or resumes threads and streams structured events from the SDK.

The session model is cleaner than a raw terminal wrapper:

- `startThread(...)`
- `resumeThread(...)`
- streamed turn events
- abort via `AbortController`

### Current Strengths

Codex already has:

- active session registry
- start/resume support
- abort support
- event transformation into UI-friendly items
- permission mode mapping to sandbox and approval policy

Examples in code:

- `mapPermissionModeToCodexOptions(...)` in [server/openai-codex.js](/root/codexDir/claudecodeui/server/openai-codex.js)
- `resumeThread(...)` use in [server/openai-codex.js](/root/codexDir/claudecodeui/server/openai-codex.js)

### Current Limitations

What I do not currently see in the same maturity level as Claude:

- a pending approval request registry
- a provider-neutral approval object emitted to the shared UI
- reconnect-safe pending approval recovery flow

Codex clearly supports approval policy configuration:

- `approvalPolicy: 'untrusted'`
- `approvalPolicy: 'never'`

But that is not the same as a shared approval center implementation.

### What This Means for Pantheon

Codex is a good second target after Claude.

It is likely orchestration-friendly because:

- it is SDK-based
- it has structured events
- it already maps sandbox and approval settings

But there is not yet enough evidence in this repo that approvals are surfaced as first-class pending requests the way Claude does.

So the current judgment is:

- good for handoff and session routing
- medium readiness for shared approval center

## Gemini CLI

### Current Model

Gemini uses a CLI process wrapper:

- [server/gemini-cli.js](/root/codexDir/claudecodeui/server/gemini-cli.js)

This is a different integration style from Claude and Codex.

Instead of talking to a provider SDK directly, the app:

- spawns the CLI
- passes arguments
- captures stdout/stderr
- parses response output
- stores session linkage through `sessionManager`

### Current Strengths

Gemini already has:

- active process tracking
- resume support using a saved provider session ID
- custom handling for images and MCP config
- permission mode mapping to CLI flags
- internal message/session persistence through `sessionManager`

Resume behavior is real, but implemented indirectly:

- CloudCLI session ID maps to Gemini CLI session ID
- the CLI session ID is stored on the app session object

### Current Limitations

Gemini is currently the least structured integration of the three.

The main constraints are:

- approval behavior is mostly expressed as CLI flags, not explicit shared approval objects
- output must be interpreted from CLI/NDJSON handling rather than native SDK state objects
- approval interception appears less mature than Claude's flow

This does not mean Gemini support is weak for normal usage. It means it is harder to build a provider-neutral orchestration layer on top of it.

### What This Means for Pantheon

Gemini is suitable for:

- worker participation
- handoff-based asynchronous tasks
- session preservation

But for approvals and deep control-plane features, it should likely start with a fallback mode:

- terminal passthrough
- "manual attention required" cards
- later semantic normalization if the CLI exposes richer events

## Current Approval Picture

This is the most important practical distinction.

### Claude

Strongest current support:

- pending approval request storage
- approval decision callback path
- UI recovery on reconnect

### Codex

Configurable approval policy exists, but I did not find equivalent shared pending approval objects in the current code.

### Gemini CLI

Approval mode flags exist, but I did not find equivalent shared pending approval objects in the current code.

## Practical Recommendation

If you want Claude and Gemini to review this and converge on a build plan, the cleanest current statement is:

1. The repo already supports Claude, Codex, and Gemini as providers.
2. Claude has the strongest existing control-plane hooks.
3. Codex is structurally promising and likely the next easiest provider to lift into Pantheon.
4. Gemini should be treated as a worker-capable provider first and a fully normalized approval provider later.

## Recommended Pantheon Rollout Order

### Phase A

- shared handoff/event bus for all providers
- no assumption of uniform approval semantics

### Phase B

- unified approval center for Claude

### Phase C

- Codex approval normalization if the SDK surfaces enough detail

### Phase D

- Gemini fallback approval cards first
- semantic approval integration only if CLI behavior proves stable enough

## Bottom Line

CloudCLI UI is already multi-provider today.

What is not equal yet is the depth of orchestration control:

- Claude is already close to Pantheon-ready
- Codex is partially ready
- Gemini is session-ready but less approval-ready

That is the right baseline for further design review with Claude and Gemini.
