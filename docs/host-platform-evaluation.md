# Host Platform Evaluation

## Purpose

This document compares two candidate host platforms for Pantheon:

- CloudCLI UI (`claudecodeui`)
- Codeg

The goal is to decide which one is the better base for building:

- multi-agent handoff
- approval aggregation
- shared operator console
- whiteboard-aware coordination
- optional control assistant

This is a host selection document, not a feature specification.

## Executive Recommendation

If the priority is **fastest path to a web-based Pantheon MVP**, prefer **CloudCLI UI**.

If the priority is **strongest long-term multi-agent desktop workspace foundation**, prefer **Codeg**.

For the specific Pantheon direction discussed so far, my recommendation is:

1. Use **CloudCLI UI** if you want to validate the product idea quickly.
2. Use **Codeg** if you decide Pantheon should become a heavier multi-agent workspace product rather than a thin control plane.

Right now, Pantheon still looks closer to a control plane than a full workstation, so **CloudCLI UI is the better immediate fit**.

## High-Level Comparison

| Area | CloudCLI UI | Codeg |
|---|---|---|
| Product shape | Web UI for existing agent sessions | Desktop multi-agent workspace |
| Runtime model | Node.js server + React frontend | Tauri + Rust backend + Next.js frontend |
| Initial complexity | Lower | Higher |
| Provider support | Claude, Codex, Gemini, Cursor | Claude, Codex, Gemini, OpenCode, and many ACP agents |
| Approval UX | Present, strongest for Claude | Present, more formally modeled through ACP |
| Agent lifecycle abstraction | Mixed provider-specific adapters | More unified connection manager |
| Session import/aggregation | Yes | Stronger and broader |
| Worktree support | Limited relative to Codeg | First-class |
| Best fit for a thin coordination layer | Better | Possible, but heavier |
| Best fit for a long-term agent workspace | Decent | Better |

## Option A: CloudCLI UI

Repository:

- `/root/codexDir/claudecodeui`

### Strengths

CloudCLI UI is a strong candidate because it is already close to Pantheon's operator-console shape.

It already has:

- browser-based UI
- provider adapters for Claude, Codex, Gemini
- WebSocket transport
- session discovery and resume
- integrated shell/chat/file/Git views
- existing pending-permission recovery for Claude

Relevant files:

- [server/index.js](/root/codexDir/claudecodeui/server/index.js)
- [server/claude-sdk.js](/root/codexDir/claudecodeui/server/claude-sdk.js)
- [server/openai-codex.js](/root/codexDir/claudecodeui/server/openai-codex.js)
- [server/gemini-cli.js](/root/codexDir/claudecodeui/server/gemini-cli.js)

### Why It Fits Pantheon Well

Pantheon currently wants to add:

- a bus
- a handoff/event layer
- a shared approval center
- a coordination panel

CloudCLI UI is already a session host and browser console. That means Pantheon can be added as an extension layer rather than a product rewrite.

The key benefit is narrowness:

- easier to reason about
- faster to modify
- easier to run remotely
- easier to expose in one browser window

### Weaknesses

CloudCLI UI is not yet a strong generalized multi-agent runtime.

Limitations:

- provider abstractions are uneven
- approval flow is strongest for Claude, less normalized for others
- orchestration is not a first-class concept yet
- worktree and deeper task/workspace modeling are less mature than Codeg

### Best Use Case

Choose CloudCLI UI if the first goal is:

- "prove that Pantheon works"
- "show multiple agents in one place"
- "support @handoff and approvals in one browser UI"

## Option B: Codeg

Repository:

- `/root/codexDir/codeg`

### Strengths

Codeg is already architected more like a serious multi-agent runtime/workspace.

It already has:

- a unified ACP connection manager
- explicit permission response flow
- a formal desktop runtime via Tauri
- richer local session aggregation
- worktree support
- MCP and skills management
- stronger "workspace" framing than CloudCLI UI

Relevant files:

- [README.md](/root/codexDir/codeg/README.md)
- [src-tauri/src/acp/manager.rs](/root/codexDir/codeg/src-tauri/src/acp/manager.rs)
- [src/lib/tauri.ts](/root/codexDir/codeg/src/lib/tauri.ts)
- [src/components/chat/permission-dialog.tsx](/root/codexDir/codeg/src/components/chat/permission-dialog.tsx)
- [src/hooks/use-connection.ts](/root/codexDir/codeg/src/hooks/use-connection.ts)

### Why It Fits Pantheon Well

If Pantheon eventually becomes a full agent workspace, Codeg may be the stronger foundation.

In particular, it already has:

- more explicit connection lifecycle modeling
- clearer permission request handling
- broader agent support
- infrastructure for deeper local workflows

### Weaknesses

Codeg is heavier.

That matters because Pantheon is still not fully settled as a product.

Costs:

- larger architecture
- Rust + Tauri + Next.js means a higher change surface
- slower iteration if the product direction changes
- desktop-centric bias, while your current framing also values centralized remote/web monitoring

### Best Use Case

Choose Codeg if the first goal is:

- "build a serious multi-agent desktop development platform"
- "treat agents, worktrees, permissions, and local tooling as one integrated runtime"

## Most Important Architectural Difference

This is the real decision point.

### CloudCLI UI

Feels like:

- a web host for existing agent sessions
- an operator console
- a lightweight coordination surface

### Codeg

Feels like:

- a local desktop workspace platform
- a runtime for agent lifecycle and engineering tasks
- a broader multi-agent IDE layer

Pantheon currently sounds more like the first category.

That is why CloudCLI UI wins for now.

## Approval Model Comparison

### CloudCLI UI

Pros:

- already has visible Claude approval recovery
- browser delivery is convenient for centralized human approval

Cons:

- provider approval model is uneven
- less formally unified across providers

### Codeg

Pros:

- permission interaction appears more deeply modeled in the runtime
- ACP structure suggests a stronger long-term normalization path

Cons:

- current UI seems centered around per-connection permission handling
- no clear evidence yet of the exact Pantheon-style cross-agent approval dashboard you want

Conclusion:

- Codeg may be stronger for approval internals
- CloudCLI UI may be faster for approval aggregation in a single browser operator console

## Coordination and Handoff Fit

### CloudCLI UI

Better for adding:

- event feed
- whiteboard snapshot
- approval dashboard
- browser-based coordination panel

Because it already behaves like a control console.

### Codeg

Better for adding:

- richer task execution graph
- per-agent workspace ownership
- deeper lifecycle-aware orchestration

Because it already behaves like a runtime/workspace platform.

## Deployment Considerations

### CloudCLI UI

Pros:

- easy to host on a Linux box
- easy to access remotely in browser
- aligns with your desire to monitor and approve from one window

### Codeg

Pros:

- stronger local desktop experience
- may be better for a single developer machine setup

Cons:

- Tauri desktop model is less naturally aligned with "central Linux server + browser console"

This is a meaningful factor. Your original Pantheon concept was very Linux-host and console-centric.

## Licensing

### CloudCLI UI

- GPL-3.0

### Codeg

- Apache-2.0

If you care about downstream licensing flexibility, Codeg is easier.

If you do not care, this should not dominate the decision.

## Recommendation by Scenario

### Scenario 1: Validate Pantheon Quickly

Pick **CloudCLI UI**.

Why:

- lower integration cost
- already browser-based
- already session-centric
- easier place to add a coordination tab

### Scenario 2: Build the Strongest Long-Term Product

Pick **Codeg**.

Why:

- stronger runtime abstraction
- better multi-agent workspace trajectory
- richer local engineering platform

### Scenario 3: Preserve Optionality

Use **CloudCLI UI** as the MVP host and keep Pantheon modules logically separated enough that they could later migrate to Codeg or another host.

This is probably the safest strategic path.

## Final Verdict

For the Pantheon described so far, **CloudCLI UI is the better host to modify first**.

Reason:

- Pantheon is still a coordination layer idea, not yet a full agent workspace product
- CloudCLI UI is already an operator console
- it is easier to prototype `@handoff`, approval aggregation, and a control assistant there

However:

- Codeg is the stronger long-term foundation if Pantheon grows into a serious multi-agent development platform with deeper runtime control

So the practical answer is:

- **modify CloudCLI UI first**
- **treat Codeg as a strategic reference and possible future migration target**
