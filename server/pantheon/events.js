import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import { validateWorkspacePath } from '../utils/workspace-validation.js';
import { renderWhiteboardMarkdown } from './whiteboard.js';

const PANTHEON_DIRNAME = 'pantheon';
const INBOX_FILENAME = 'inbox.jsonl';
const WHITEBOARD_FILENAME = 'whiteboard.md';

function createEventId() {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return crypto.randomBytes(16).toString('hex');
}

async function ensureWorkspacePath(workspacePath) {
    if (!workspacePath || typeof workspacePath !== 'string') {
        throw new Error('workspacePath is required');
    }

    const validation = await validateWorkspacePath(workspacePath);
    if (!validation.valid || !validation.resolvedPath) {
        throw new Error(validation.error || 'Invalid workspace path');
    }

    return validation.resolvedPath;
}

async function ensurePantheonDir(workspacePath) {
    const resolvedWorkspacePath = await ensureWorkspacePath(workspacePath);
    const pantheonDir = path.join(resolvedWorkspacePath, PANTHEON_DIRNAME);
    await fs.mkdir(pantheonDir, { recursive: true });

    return {
        workspacePath: resolvedWorkspacePath,
        pantheonDir,
        inboxPath: path.join(pantheonDir, INBOX_FILENAME),
        whiteboardPath: path.join(resolvedWorkspacePath, WHITEBOARD_FILENAME)
    };
}

function normalizeArtifacts(artifacts) {
    if (!Array.isArray(artifacts)) {
        return [];
    }

    return artifacts
        .filter((artifact) => typeof artifact === 'string' && artifact.trim())
        .map((artifact) => artifact.trim());
}

function normalizeEvent(event, workspacePath) {
    const createdAt = event.createdAt || new Date().toISOString();
    const type = typeof event.type === 'string' ? event.type : 'note';
    const status = typeof event.status === 'string' ? event.status : 'recorded';

    return {
        id: event.id || createEventId(),
        type,
        workspacePath,
        sessionId: typeof event.sessionId === 'string' ? event.sessionId : null,
        provider: typeof event.provider === 'string' ? event.provider : null,
        from: typeof event.from === 'string' ? event.from : null,
        to: typeof event.to === 'string' ? event.to : null,
        message: typeof event.message === 'string' ? event.message : '',
        summary: typeof event.summary === 'string' ? event.summary : null,
        toolName: typeof event.toolName === 'string' ? event.toolName : null,
        requestId: typeof event.requestId === 'string' ? event.requestId : null,
        context: event.context && typeof event.context === 'object' ? event.context : null,
        artifacts: normalizeArtifacts(event.artifacts),
        status,
        createdAt
    };
}

function safeJsonParse(line) {
    try {
        return JSON.parse(line);
    } catch {
        return null;
    }
}

export async function loadPantheonEvents(workspacePath) {
    const { inboxPath } = await ensurePantheonDir(workspacePath);

    try {
        const contents = await fs.readFile(inboxPath, 'utf8');
        return contents
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map(safeJsonParse)
            .filter(Boolean);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }

        throw error;
    }
}

export function buildPantheonState(events = []) {
    const state = {
        currentTask: null,
        activeOwner: null,
        blockers: [],
        relatedArtifacts: [],
        pendingApprovals: [],
        registeredSessions: [],
        recentHandoffs: [],
        recentEvents: events.slice(-50)
    };

    const artifactSet = new Set();
    const pendingApprovals = new Map();
    const registeredSessions = new Map();

    for (const event of events) {
        for (const artifact of normalizeArtifacts(event.artifacts)) {
            artifactSet.add(artifact);
        }

        switch (event.type) {
            case 'handoff':
                state.currentTask = event.message || state.currentTask;
                state.activeOwner = event.to || state.activeOwner;
                state.recentHandoffs.push(event);
                break;
            case 'register_session':
                if (event.provider && event.sessionId) {
                    const entryId = `${event.provider}:${event.sessionId}`;
                    registeredSessions.set(entryId, {
                        entryId,
                        provider: event.provider,
                        sessionId: event.sessionId,
                        title: event.summary || event.message || null,
                        registeredAt: event.createdAt,
                        projectName: typeof event.context?.projectName === 'string' ? event.context.projectName : null
                    });
                }
                break;
            case 'unregister_session':
                if (event.provider && event.sessionId) {
                    registeredSessions.delete(`${event.provider}:${event.sessionId}`);
                }
                break;
            case 'completion':
                state.currentTask = event.message || state.currentTask;
                if (event.to === 'human' || event.to === '@human') {
                    state.activeOwner = 'human';
                }
                break;
            case 'approval_request':
                if (event.requestId) {
                    pendingApprovals.set(event.requestId, event);
                }
                break;
            case 'approval_decision':
                if (event.requestId) {
                    pendingApprovals.delete(event.requestId);
                }
                break;
            case 'manual_attention_required':
                if (event.message) {
                    state.blockers.push(event.message);
                }
                break;
            default:
                break;
        }
    }

    state.relatedArtifacts = Array.from(artifactSet).slice(0, 20);
    state.pendingApprovals = Array.from(pendingApprovals.values());
    state.registeredSessions = Array.from(registeredSessions.values());
    state.recentHandoffs = state.recentHandoffs.slice(-10);

    return state;
}

export async function projectPantheonWhiteboard(workspacePath, state = null) {
    const paths = await ensurePantheonDir(workspacePath);
    const events = state ? null : await loadPantheonEvents(workspacePath);
    const resolvedState = state || buildPantheonState(events);
    const markdown = renderWhiteboardMarkdown(resolvedState);
    await fs.writeFile(paths.whiteboardPath, markdown, 'utf8');

    return {
        whiteboardPath: paths.whiteboardPath,
        markdown,
        state: resolvedState
    };
}

export async function appendPantheonEvent(workspacePath, eventInput) {
    const paths = await ensurePantheonDir(workspacePath);
    const event = normalizeEvent(eventInput, paths.workspacePath);
    await fs.appendFile(paths.inboxPath, `${JSON.stringify(event)}\n`, 'utf8');

    const events = await loadPantheonEvents(paths.workspacePath);
    const state = buildPantheonState(events);
    await projectPantheonWhiteboard(paths.workspacePath, state);

    return {
        event,
        state,
        inboxPath: paths.inboxPath,
        whiteboardPath: paths.whiteboardPath
    };
}

export async function syncPantheonWorkspace(workspacePath) {
    const paths = await ensurePantheonDir(workspacePath);
    const events = await loadPantheonEvents(paths.workspacePath);
    const state = buildPantheonState(events);
    await projectPantheonWhiteboard(paths.workspacePath, state);

    return {
        workspacePath: paths.workspacePath,
        inboxPath: paths.inboxPath,
        whiteboardPath: paths.whiteboardPath,
        events,
        state
    };
}
