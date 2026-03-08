import { appendPantheonEvent } from './events.js';

const VALID_TARGETS = new Set(['claude', 'codex', 'gemini', 'human', 'all']);

function normalizeTarget(target) {
    if (typeof target !== 'string') {
        return null;
    }

    const cleaned = target.trim().replace(/^@/, '').toLowerCase();
    return VALID_TARGETS.has(cleaned) ? cleaned : null;
}

function buildArtifacts(artifacts = []) {
    if (!Array.isArray(artifacts)) {
        return [];
    }

    return artifacts
        .filter((artifact) => typeof artifact === 'string' && artifact.trim())
        .map((artifact) => artifact.trim());
}

function parseDelimitedList(value) {
    if (typeof value !== 'string') {
        return [];
    }

    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

export function parsePantheonHandoff(text) {
    if (typeof text !== 'string' || !text.trim()) {
        return null;
    }

    const lines = text.replace(/\r\n/g, '\n').split('\n');

    while (lines.length > 0 && !lines[lines.length - 1].trim()) {
        lines.pop();
    }

    let targetIndex = -1;
    let target = null;
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const normalized = normalizeTarget(lines[index]);
        if (normalized) {
            targetIndex = index;
            target = normalized;
            break;
        }
    }

    if (targetIndex === -1 || !target) {
        return null;
    }

    const blockLines = lines.slice(targetIndex + 1);
    if (blockLines.length === 0) {
        return null;
    }

    const fields = new Map();
    let currentKey = null;

    for (const rawLine of blockLines) {
        const line = rawLine.trimEnd();
        if (!line.trim()) {
            continue;
        }

        const fieldMatch = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
        if (fieldMatch) {
            currentKey = fieldMatch[1].toLowerCase();
            fields.set(currentKey, fieldMatch[2].trim());
            continue;
        }

        if (currentKey) {
            const previousValue = fields.get(currentKey) || '';
            fields.set(currentKey, previousValue ? `${previousValue}\n${line.trim()}` : line.trim());
        }
    }

    const task = fields.get('task') || '';
    const note = fields.get('note') || '';
    const messageParts = [];
    if (task) {
        messageParts.push(task);
    }
    if (note) {
        messageParts.push(`Note: ${note}`);
    }

    const message = messageParts.join('\n\n').trim();
    if (!message) {
        return null;
    }

    return {
        to: target,
        message,
        artifacts: buildArtifacts(parseDelimitedList(fields.get('artifacts'))),
        rawBlock: lines.slice(targetIndex).join('\n').trim(),
        body: lines.slice(0, targetIndex).join('\n').trim()
    };
}

export function formatPantheonHandoffPrompt(event) {
    const artifacts = buildArtifacts(event.artifacts);
    const artifactLines = artifacts.length
        ? artifacts.map((artifact) => `- ${artifact}`).join('\n')
        : '- None provided';

    const returnTarget = event.from && event.from !== 'human' ? event.from : 'human';

    return `[Pantheon Handoff]
From: ${event.from || 'unknown'}
To: ${event.to || 'unknown'}
Workspace: ${event.workspacePath}
Relevant files:
${artifactLines}
Task:
${event.message || 'No task provided'}

When you finish, pass control back by ending your response with a handoff block on its own lines (no extra text on the same line):

@${returnTarget}
task: <brief description of what you completed and what needs to happen next>
note: <any context the next agent needs>

If no further action is needed, use @human instead and summarize what was done.
`;
}

function normalizeSessionProvider(provider) {
    return normalizeTarget(provider);
}

export async function createPantheonHandoff(workspacePath, input = {}) {
    const to = normalizeTarget(input.to);
    if (!to) {
        throw new Error('Invalid handoff target');
    }

    const result = await appendPantheonEvent(workspacePath, {
        type: 'handoff',
        provider: input.provider || null,
        sessionId: input.sessionId || null,
        from: typeof input.from === 'string' ? input.from : 'human',
        to,
        message: typeof input.message === 'string' ? input.message.trim() : '',
        artifacts: buildArtifacts(input.artifacts),
        context: {
            targetSessionId: typeof input.targetSessionId === 'string' ? input.targetSessionId : null,
            targetProvider: normalizeSessionProvider(input.targetProvider || input.to)
        },
        status: typeof input.status === 'string' ? input.status : 'queued'
    });

    return {
        ...result,
        prompt: formatPantheonHandoffPrompt(result.event)
    };
}

export async function registerPantheonSession(workspacePath, input = {}) {
    const provider = normalizeSessionProvider(input.provider);
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
    if (!provider || !sessionId) {
        throw new Error('provider and sessionId are required to register a Pantheon session');
    }

    return appendPantheonEvent(workspacePath, {
        type: 'register_session',
        provider,
        sessionId,
        from: typeof input.from === 'string' ? input.from : 'human',
        to: 'pantheon',
        message: typeof input.message === 'string' ? input.message.trim() : 'Registered Pantheon session',
        summary: typeof input.summary === 'string' ? input.summary.trim() : null,
        context: {
            projectName: typeof input.projectName === 'string' ? input.projectName : null,
            workspacePath: typeof input.workspacePath === 'string' ? input.workspacePath : workspacePath
        },
        status: 'registered'
    });
}

export async function unregisterPantheonSession(workspacePath, input = {}) {
    const provider = normalizeSessionProvider(input.provider);
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
    if (!provider || !sessionId) {
        throw new Error('provider and sessionId are required to unregister a Pantheon session');
    }

    return appendPantheonEvent(workspacePath, {
        type: 'unregister_session',
        provider,
        sessionId,
        from: typeof input.from === 'string' ? input.from : 'human',
        to: 'pantheon',
        message: typeof input.message === 'string' ? input.message.trim() : 'Unregistered Pantheon session',
        summary: typeof input.summary === 'string' ? input.summary.trim() : null,
        context: {
            projectName: typeof input.projectName === 'string' ? input.projectName : null,
            workspacePath: typeof input.workspacePath === 'string' ? input.workspacePath : workspacePath
        },
        status: 'removed'
    });
}
