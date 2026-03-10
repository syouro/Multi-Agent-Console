export const PANTHEON_MCP_TOOL = {
    name: 'pantheon_handoff',
    description: 'Create a structured Pantheon handoff and dispatch it through the host coordination bus.',
    inputSchema: {
        type: 'object',
        properties: {
            to: {
                type: 'string',
                description: 'Logical Pantheon target: claude, codex, gemini, human, or all.'
            },
            task: {
                type: 'string',
                description: 'Primary handoff task.'
            },
            artifacts: {
                type: 'array',
                items: { type: 'string' },
                description: 'Relevant files or artifacts.'
            },
            note: {
                type: 'string',
                description: 'Optional additional context for the next agent.'
            },
            workspacePath: {
                type: 'string',
                description: 'Authoritative workspace path for the handoff.'
            },
            targetSessionId: {
                type: 'string',
                description: 'Optional explicit Pantheon target session.'
            },
            targetProvider: {
                type: 'string',
                description: 'Optional explicit target provider override.'
            },
            from: {
                type: 'string',
                description: 'Optional caller identity override.'
            }
        },
        required: ['to', 'task', 'workspacePath']
    }
};

export const PANTHEON_MCP_SERVER_INFO = {
    name: 'pantheon-mcp',
    version: '0.1.0'
};

function buildJsonRpcResult(id, result) {
    return {
        jsonrpc: '2.0',
        id,
        result
    };
}

function buildJsonRpcError(id, code, message, data = undefined) {
    return {
        jsonrpc: '2.0',
        id,
        error: {
            code,
            message,
            ...(data !== undefined ? { data } : {})
        }
    };
}

export function buildPantheonMcpHandler({ provider, callPantheonHandoff }) {
    return async function handlePantheonMcpRequest(request) {
        const { id, method, params } = request || {};

        if (method === 'initialize') {
            return buildJsonRpcResult(id, {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                serverInfo: PANTHEON_MCP_SERVER_INFO
            });
        }

        if (method === 'notifications/initialized') {
            return null;
        }

        if (method === 'tools/list') {
            return buildJsonRpcResult(id, {
                tools: [PANTHEON_MCP_TOOL]
            });
        }

        if (method === 'tools/call') {
            const toolName = params?.name;
            if (toolName !== 'pantheon_handoff') {
                return buildJsonRpcError(id, -32602, `Unknown tool: ${toolName}`);
            }

            try {
                const result = await callPantheonHandoff({
                    ...(params?.arguments || {}),
                    from: typeof params?.arguments?.from === 'string' && params.arguments.from.trim()
                        ? params.arguments.from.trim()
                        : provider
                });

                return buildJsonRpcResult(id, {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ],
                    structuredContent: result,
                    isError: false
                });
            } catch (error) {
                return buildJsonRpcResult(id, {
                    content: [
                        {
                            type: 'text',
                            text: error instanceof Error ? error.message : 'Pantheon handoff failed'
                        }
                    ],
                    isError: true
                });
            }
        }

        return buildJsonRpcError(id, -32601, `Method not found: ${method}`);
    };
}
