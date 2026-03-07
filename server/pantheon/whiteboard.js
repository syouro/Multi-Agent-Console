function formatList(items = []) {
    if (!items.length) {
        return '- None';
    }

    return items.map((item) => `- ${item}`).join('\n');
}

function formatApprovalLine(approval) {
    const summary = approval.summary || approval.toolName || 'Pending approval';
    const provider = approval.provider || 'unknown';
    const sessionId = approval.sessionId || 'unknown-session';
    return `${summary} (${provider}, session: ${sessionId})`;
}

function formatHandoffLine(event) {
    const from = event.from || 'unknown';
    const to = event.to || 'unknown';
    const message = event.message || 'No message';
    return `${from} -> ${to}: ${message}`;
}

export function renderWhiteboardMarkdown(state) {
    const recentHandoffs = (state.recentHandoffs || []).map(formatHandoffLine);
    const pendingApprovals = (state.pendingApprovals || []).map(formatApprovalLine);
    const blockers = [...(state.blockers || [])];

    if (pendingApprovals.length > 0) {
        blockers.push(...pendingApprovals.map((item) => `Pending approval: ${item}`));
    }

    return `# Pantheon Whiteboard

## Current Task
${state.currentTask || 'No active task'}

## Active Owner
${state.activeOwner || 'Unassigned'}

## Recent Handoffs
${formatList(recentHandoffs)}

## Open Approvals
${formatList(pendingApprovals)}

## Blockers
${formatList(blockers)}

## Related Artifacts
${formatList(state.relatedArtifacts || [])}
`;
}
