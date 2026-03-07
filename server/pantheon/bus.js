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
        status: typeof input.status === 'string' ? input.status : 'queued'
    });

    return {
        ...result,
        prompt: formatPantheonHandoffPrompt(result.event)
    };
}
