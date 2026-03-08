import { createPantheonHandoff } from './bus.js';

function resolvePantheonTargetFromState(state, handoffEvent) {
    const context = handoffEvent.context && typeof handoffEvent.context === 'object' ? handoffEvent.context : {};
    const requestedProvider = typeof context.targetProvider === 'string' ? context.targetProvider : handoffEvent.to;
    const requestedSessionId = typeof context.targetSessionId === 'string' ? context.targetSessionId : null;

    if (requestedProvider === 'human' || requestedProvider === 'all') {
        return { provider: requestedProvider, sessionId: requestedSessionId, workspacePath: null };
    }

    if (requestedProvider && requestedSessionId) {
        return { provider: requestedProvider, sessionId: requestedSessionId, workspacePath: null };
    }

    const registeredSessions = Array.isArray(state?.registeredSessions) ? state.registeredSessions : [];
    const matchingSessions = registeredSessions.filter((entry) =>
        entry.provider === requestedProvider && entry.sessionId
    );
    const preferred = matchingSessions[matchingSessions.length - 1];

    return preferred ? {
        provider: preferred.provider,
        sessionId: preferred.sessionId,
        workspacePath: preferred.workspacePath || null
    } : null;
}

export function createPantheonService(dependencies) {
    const {
        broadcastPantheonPayload,
        broadcastPantheonEvent,
        enrichPantheonState = (state) => state,
        findProjectByWorkspacePath,
        resolveProviderSessionWorkspacePath,
        resolveGeminiResumeSessionId,
        queryCodex,
        spawnGemini,
        queryClaudeSDK,
        injectPromptIntoProviderSession,
        createBackgroundWriter,
        getLatestSessionId
    } = dependencies;

    const dispatchPantheonChatHandoff = async (workspacePath, targetInfo, prompt) => {
        if (!targetInfo?.provider || !targetInfo?.sessionId || targetInfo.provider === 'human' || targetInfo.provider === 'all') {
            return { delivered: false, reason: 'No target chat session found' };
        }

        const writer = createBackgroundWriter(targetInfo.provider, workspacePath);

        try {
            if (targetInfo.provider === 'codex') {
                await queryCodex(prompt, {
                    cwd: workspacePath,
                    projectPath: workspacePath,
                    sessionId: targetInfo.sessionId,
                    resume: true
                }, writer);
                return { delivered: true, channel: 'chat' };
            }

            if (targetInfo.provider === 'gemini') {
                const resumeSessionId = await resolveGeminiResumeSessionId(workspacePath, targetInfo.sessionId);
                await spawnGemini(prompt, {
                    cwd: workspacePath,
                    projectPath: workspacePath,
                    sessionId: targetInfo.sessionId,
                    resumeSessionId,
                    resume: true
                }, writer);
                return { delivered: true, channel: 'chat' };
            }

            if (targetInfo.provider === 'claude') {
                await queryClaudeSDK(prompt, {
                    cwd: workspacePath,
                    projectPath: workspacePath,
                    sessionId: targetInfo.sessionId,
                    resume: true
                }, writer);
                return { delivered: true, channel: 'chat' };
            }
        } catch (error) {
            console.error('[Pantheon] Chat handoff dispatch failed:', error);
            return {
                delivered: false,
                reason: error instanceof Error ? error.message : 'Chat handoff dispatch failed'
            };
        }

        return { delivered: false, reason: 'Unsupported provider for chat handoff' };
    };

    const resolvePantheonTarget = async (workspacePath, handoffEvent) => {
        const context = handoffEvent.context && typeof handoffEvent.context === 'object' ? handoffEvent.context : {};
        const requestedProvider = typeof context.targetProvider === 'string' ? context.targetProvider : handoffEvent.to;
        const requestedSessionId = typeof context.targetSessionId === 'string' ? context.targetSessionId : null;

        if (requestedProvider === 'human' || requestedProvider === 'all') {
            return { provider: requestedProvider, sessionId: requestedSessionId, workspacePath: null };
        }

        if (requestedProvider && requestedSessionId) {
            return { provider: requestedProvider, sessionId: requestedSessionId, workspacePath: null };
        }

        const project = await findProjectByWorkspacePath(workspacePath);
        return {
            provider: requestedProvider,
            sessionId: getLatestSessionId(project, requestedProvider),
            workspacePath: project?.path || project?.fullPath || workspacePath
        };
    };

    const resolveDeliveryWorkspacePath = async (targetInfo, fallbackWorkspacePath) => {
        if (!targetInfo?.provider || !targetInfo?.sessionId) {
            return fallbackWorkspacePath;
        }

        return await resolveProviderSessionWorkspacePath(
            targetInfo.provider,
            targetInfo.sessionId,
            targetInfo.workspacePath || fallbackWorkspacePath
        );
    };

    const deliverPantheonHandoff = async (workspacePath, handoffEvent, prompt, targetInfo) => {
        const chatResult = await dispatchPantheonChatHandoff(workspacePath, targetInfo, prompt);

        if (chatResult.delivered) {
            await broadcastPantheonEvent(workspacePath, {
                type: 'handoff_delivery',
                provider: targetInfo.provider,
                sessionId: targetInfo.sessionId,
                from: handoffEvent.from,
                to: handoffEvent.to,
                message: `Dispatched handoff to ${targetInfo.provider} session ${targetInfo.sessionId} via chat`,
                artifacts: handoffEvent.artifacts,
                status: 'delivered'
            });
            return { delivered: true, channel: 'chat' };
        }

        const injectionResult = injectPromptIntoProviderSession(
            workspacePath,
            targetInfo.provider,
            targetInfo.sessionId,
            prompt
        );

        if (injectionResult.delivered) {
            await broadcastPantheonEvent(workspacePath, {
                type: 'handoff_delivery',
                provider: targetInfo.provider,
                sessionId: targetInfo.sessionId,
                from: handoffEvent.from,
                to: handoffEvent.to,
                message: `Delivered handoff to ${targetInfo.provider} session ${targetInfo.sessionId} via shell`,
                artifacts: handoffEvent.artifacts,
                status: 'delivered'
            });
            return { delivered: true, channel: 'shell' };
        }

        await broadcastPantheonEvent(workspacePath, {
            type: 'manual_attention_required',
            provider: targetInfo.provider,
            sessionId: targetInfo.sessionId,
            from: handoffEvent.from,
            to: handoffEvent.to,
            message: chatResult.reason || injectionResult.reason,
            artifacts: handoffEvent.artifacts,
            status: 'attention'
        });

        return {
            delivered: false,
            channel: null,
            reason: chatResult.reason || injectionResult.reason
        };
    };

    const dispatchPantheonHandoffResult = async (result) => {
        broadcastPantheonPayload({
            type: 'pantheon:event',
            workspacePath: result.event.workspacePath,
            event: result.event,
            state: enrichPantheonState(result.state),
            prompt: result.prompt
        });

        if (result.event.to === 'all') {
            const registeredSessions = result.state?.registeredSessions || [];
            const deliverableSessions = registeredSessions.filter((entry) =>
                entry.provider && entry.sessionId && entry.provider !== 'human'
            );

            if (deliverableSessions.length === 0) {
                await broadcastPantheonEvent(result.event.workspacePath, {
                    type: 'manual_attention_required',
                    provider: 'all',
                    sessionId: null,
                    from: result.event.from,
                    to: result.event.to,
                    message: 'No registered sessions are available to receive this @all handoff',
                    artifacts: result.event.artifacts,
                    status: 'attention'
                });
            }

            const deliveries = [];
            for (const entry of deliverableSessions) {
                const deliveryWorkspacePath = await resolveDeliveryWorkspacePath(entry, result.event.workspacePath);
                const delivery = await deliverPantheonHandoff(deliveryWorkspacePath, result.event, result.prompt, {
                    provider: entry.provider,
                    sessionId: entry.sessionId,
                    workspacePath: deliveryWorkspacePath
                });
                deliveries.push({
                    provider: entry.provider,
                    sessionId: entry.sessionId,
                    workspacePath: deliveryWorkspacePath,
                    ...delivery
                });
            }

            return deliveries;
        }

        if (!result.event.to || result.event.to === 'human') {
            return [];
        }

        const targetInfo =
            resolvePantheonTargetFromState(result.state, result.event) ||
            await resolvePantheonTarget(result.event.workspacePath, result.event);

        const deliveryWorkspacePath = await resolveDeliveryWorkspacePath(targetInfo, result.event.workspacePath);
        const delivery = await deliverPantheonHandoff(deliveryWorkspacePath, result.event, result.prompt, {
            ...targetInfo,
            workspacePath: deliveryWorkspacePath
        });

        return [{
            provider: targetInfo?.provider || null,
            sessionId: targetInfo?.sessionId || null,
            workspacePath: deliveryWorkspacePath,
            ...delivery
        }];
    };

    const createAndDispatchPantheonHandoff = async (workspacePath, input = {}) => {
        const result = await createPantheonHandoff(workspacePath, input);
        const deliveries = await dispatchPantheonHandoffResult(result);

        return {
            ...result,
            deliveries
        };
    };

    return {
        createAndDispatchPantheonHandoff,
        dispatchPantheonHandoffResult
    };
}
