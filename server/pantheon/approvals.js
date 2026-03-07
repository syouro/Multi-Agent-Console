export function normalizeClaudeApprovalRequest(event) {
    const summary = event.toolName === 'Bash' && event.input && typeof event.input === 'object' && typeof event.input.command === 'string'
        ? event.input.command
        : event.toolName || 'Pending approval';

    return {
        type: 'approval_request',
        provider: 'claude',
        sessionId: event.sessionId || null,
        requestId: event.requestId,
        toolName: event.toolName || 'UnknownTool',
        summary,
        context: event.context || null,
        status: 'pending'
    };
}

export function normalizeClaudeApprovalDecision(event) {
    const status = event.type === 'cancelled'
        ? 'cancelled'
        : event.decision?.allow
            ? 'approved'
            : 'denied';

    const message = event.type === 'cancelled'
        ? (event.reason || 'Approval request cancelled')
        : (event.decision?.message || (event.decision?.allow ? 'Approval granted' : 'Approval denied'));

    return {
        type: 'approval_decision',
        provider: 'claude',
        sessionId: event.sessionId || null,
        requestId: event.requestId,
        toolName: event.toolName || 'UnknownTool',
        summary: message,
        context: event.context || null,
        status
    };
}
