import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { GitBranchPlus, RefreshCw, Send } from 'lucide-react';
import type { Project, ProjectSession } from '../../../types/app';

type PantheonEvent = {
    id: string;
    type: string;
    from?: string | null;
    to?: string | null;
    provider?: string | null;
    sessionId?: string | null;
    message?: string;
    status?: string;
    createdAt?: string;
    artifacts?: string[];
};

type PantheonState = {
    currentTask?: string | null;
    activeOwner?: string | null;
    blockers?: string[];
    relatedArtifacts?: string[];
    pendingApprovals?: Array<{
        requestId: string;
        toolName?: string | null;
        summary?: string | null;
        sessionId?: string | null;
        provider?: string | null;
    }>;
};

type CoordinationPanelProps = {
    selectedProject: Project;
    selectedSession: ProjectSession | null;
    sendMessage: (message: unknown) => void;
    latestMessage: unknown;
    isConnected: boolean;
};

const TARGETS = [
    { value: 'claude', label: '@claude' },
    { value: 'codex', label: '@codex' },
    { value: 'gemini', label: '@gemini' },
    { value: 'human', label: '@human' },
    { value: 'all', label: '@all' }
];

function getWorkspacePath(project: Project) {
    return project.path || project.fullPath;
}

function formatTimestamp(value?: string) {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

function detectProvider(session: ProjectSession | null): string {
    return session?.__provider || 'claude';
}

export default function CoordinationPanel({
    selectedProject,
    selectedSession,
    sendMessage,
    latestMessage,
    isConnected
}: CoordinationPanelProps) {
    const workspacePath = getWorkspacePath(selectedProject);
    const [events, setEvents] = useState<PantheonEvent[]>([]);
    const [state, setState] = useState<PantheonState | null>(null);
    const [target, setTarget] = useState('codex');
    const [message, setMessage] = useState('');
    const [artifacts, setArtifacts] = useState('whiteboard.md');

    useEffect(() => {
        if (!isConnected || !workspacePath) {
            return;
        }

        sendMessage({
            type: 'pantheon:sync',
            workspacePath
        });
    }, [isConnected, workspacePath, sendMessage]);

    useEffect(() => {
        if (!latestMessage || typeof latestMessage !== 'object') {
            return;
        }

        const payload = latestMessage as { type?: string; workspacePath?: string; events?: PantheonEvent[]; event?: PantheonEvent; state?: PantheonState };
        if (payload.workspacePath !== workspacePath) {
            return;
        }

        if (payload.type === 'pantheon:state') {
            setEvents(payload.events || []);
            setState(payload.state || null);
        }

        if (payload.type === 'pantheon:event' && payload.event) {
            setEvents((current) => [...current, payload.event as PantheonEvent]);
            setState(payload.state || null);
        }

        if (payload.type === 'pantheon:event-list') {
            setEvents(payload.events || []);
        }
    }, [latestMessage, workspacePath]);

    const recentEvents = useMemo(() => events.slice(-20).reverse(), [events]);

    const handleRefresh = () => {
        sendMessage({
            type: 'pantheon:sync',
            workspacePath
        });
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedMessage = message.trim();
        if (!trimmedMessage) {
            return;
        }

        sendMessage({
            type: 'pantheon:create-handoff',
            workspacePath,
            sessionId: selectedSession?.id || null,
            provider: detectProvider(selectedSession),
            from: detectProvider(selectedSession),
            to: target,
            message: trimmedMessage,
            artifacts: artifacts
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
        });

        setMessage('');
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <div className="border-b border-border/60 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Coordination</h2>
                        <p className="text-xs text-muted-foreground">{selectedProject.displayName}</p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                        type="button"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                <div className="flex min-h-0 flex-col border-b border-border/60 lg:border-b-0 lg:border-r">
                    <div className="border-b border-border/60 px-4 py-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Event Feed</div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                        {recentEvents.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                                No Pantheon events yet.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentEvents.map((item) => (
                                    <div key={item.id} className="rounded-lg border border-border/70 bg-card px-3 py-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                {item.type}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground">{formatTimestamp(item.createdAt)}</div>
                                        </div>
                                        <div className="mt-1 text-sm font-medium text-foreground">
                                            {(item.from || 'unknown')} -&gt; {(item.to || 'unknown')}
                                        </div>
                                        {item.message && (
                                            <div className={`mt-1 text-sm ${item.type === 'manual_attention_required' ? 'font-medium text-amber-700' : 'text-foreground/90'}`}>
                                                {item.message}
                                            </div>
                                        )}
                                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                            {item.provider && <span>Provider: {item.provider}</span>}
                                            {item.sessionId && <span>Session: {item.sessionId}</span>}
                                            {item.status && <span>Status: {item.status}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex min-h-0 flex-col">
                    <div className="border-b border-border/60 px-4 py-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Snapshot</div>
                    </div>
                    <div className="space-y-4 overflow-y-auto px-4 py-4">
                        <section className="rounded-lg border border-border/70 bg-card px-3 py-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Connection</div>
                            <div className="mt-2 text-sm text-foreground">
                                {isConnected ? 'Connected' : 'Disconnected'}
                            </div>
                        </section>

                        <section className="rounded-lg border border-border/70 bg-card px-3 py-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Task</div>
                            <div className="mt-2 text-sm text-foreground">{state?.currentTask || 'No active task'}</div>
                            <div className="mt-3 text-xs text-muted-foreground">Owner: {state?.activeOwner || 'Unassigned'}</div>
                        </section>

                        <section className="rounded-lg border border-border/70 bg-card px-3 py-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Blockers</div>
                            <div className="mt-2 space-y-1 text-sm text-foreground">
                                {(state?.blockers?.length || 0) > 0 ? (
                                    state?.blockers?.map((blocker, index) => <div key={`${blocker}-${index}`}>{blocker}</div>)
                                ) : (
                                    <div className="text-muted-foreground">None</div>
                                )}
                            </div>
                        </section>

                        <section className="rounded-lg border border-border/70 bg-card px-3 py-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Artifacts</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {(state?.relatedArtifacts?.length || 0) > 0 ? (
                                    state?.relatedArtifacts?.map((artifact) => (
                                        <span key={artifact} className="rounded-full border border-border/70 px-2 py-1 text-xs text-foreground">
                                            {artifact}
                                        </span>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground">None</div>
                                )}
                            </div>
                        </section>

                        <section className="rounded-lg border border-border/70 bg-card px-3 py-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approval Center</div>
                            <div className="mt-2 space-y-3">
                                {(state?.pendingApprovals?.length || 0) > 0 ? (
                                    state?.pendingApprovals?.map((approval) => (
                                        <div key={approval.requestId} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3">
                                            <div className="text-sm font-medium text-amber-900">
                                                {approval.summary || approval.toolName || 'Pending approval'}
                                            </div>
                                            <div className="mt-1 text-xs text-amber-800">
                                                Provider: {approval.provider || 'claude'}
                                                {approval.sessionId ? ` · Session: ${approval.sessionId}` : ''}
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => sendMessage({ type: 'pantheon:resolve-approval', requestId: approval.requestId, allow: true })}
                                                    className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => sendMessage({ type: 'pantheon:resolve-approval', requestId: approval.requestId, allow: false, message: 'Denied from Pantheon coordination panel' })}
                                                    className="inline-flex items-center rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                                                >
                                                    Deny
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground">No pending Claude approvals.</div>
                                )}
                            </div>
                        </section>

                        <section className="rounded-lg border border-border/70 bg-card px-3 py-3">
                            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                <GitBranchPlus className="h-3.5 w-3.5" />
                                Create Handoff
                            </div>
                            <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
                                <label className="block">
                                    <div className="mb-1 text-xs text-muted-foreground">Target</div>
                                    <select
                                        value={target}
                                        onChange={(event) => setTarget(event.target.value)}
                                        className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm"
                                    >
                                        {TARGETS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    {target === 'claude' && (
                                        <div className="mt-1 text-[11px] text-amber-600">
                                            Claude handoffs currently fall back to manual attention unless the target session is running in a PTY-backed shell.
                                        </div>
                                    )}
                                </label>

                                <label className="block">
                                    <div className="mb-1 text-xs text-muted-foreground">Message</div>
                                    <textarea
                                        value={message}
                                        onChange={(event) => setMessage(event.target.value)}
                                        rows={4}
                                        className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm"
                                        placeholder="Describe the task and what the next agent should do."
                                    />
                                </label>

                                <label className="block">
                                    <div className="mb-1 text-xs text-muted-foreground">Artifacts</div>
                                    <input
                                        value={artifacts}
                                        onChange={(event) => setArtifacts(event.target.value)}
                                        className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm"
                                        placeholder="whiteboard.md, api_spec.json"
                                    />
                                </label>

                                <button
                                    type="submit"
                                    disabled={!isConnected || !message.trim()}
                                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                    Send Handoff
                                </button>
                            </form>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
