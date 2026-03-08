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

export function formatPantheonHandoffPrompt(event) {
    const artifacts = buildArtifacts(event.artifacts);
    const artifactLines = artifacts.length
        ? artifacts.map((artifact) => `- ${artifact}`).join('\n')
        : '- None provided';

    return `[Pantheon Handoff]
From: ${event.from || 'unknown'}
To: ${event.to || 'unknown'}
Workspace: ${event.workspacePath}
Relevant files:
${artifactLines}
Task:
${event.message || 'No task provided'}
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
            projectName: typeof input.projectName === 'string' ? input.projectName : null
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
            projectName: typeof input.projectName === 'string' ? input.projectName : null
        },
        status: 'removed'
    });
}
