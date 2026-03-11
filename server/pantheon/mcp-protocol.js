import { syncPantheonWorkspace } from './events.js';
import { renderWhiteboardMarkdown } from './whiteboard.js';

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

const PANTHEON_SERVER_RESOURCES = [
    {
        uri: 'pantheon://server/info',
        name: 'Pantheon MCP Server Info',
        description: 'Describes the Pantheon MCP server and the capabilities it exposes.',
        mimeType: 'application/json'
    },
    {
        uri: 'pantheon://server/resource-guide',
        name: 'Pantheon Resource Guide',
        description: 'Explains how to read workspace-scoped Pantheon resources.',
        mimeType: 'text/markdown'
    }
];

const PANTHEON_RESOURCE_TEMPLATES = [
    {
        uriTemplate: 'pantheon://state?workspacePath={workspacePath}',
        name: 'Pantheon Workspace State',
        description: 'Structured Pantheon state for a workspace.',
        mimeType: 'application/json'
    },
    {
        uriTemplate: 'pantheon://whiteboard?workspacePath={workspacePath}',
        name: 'Pantheon Whiteboard',
        description: 'Rendered whiteboard markdown for a workspace.',
        mimeType: 'text/markdown'
    },
    {
        uriTemplate: 'pantheon://events?workspacePath={workspacePath}',
        name: 'Pantheon Event Log',
        description: 'Recent Pantheon events for a workspace as JSON.',
        mimeType: 'application/json'
    },
    {
        uriTemplate: 'pantheon://sessions?workspacePath={workspacePath}',
        name: 'Pantheon Registered Sessions',
        description: 'Registered Pantheon sessions for a workspace as JSON.',
        mimeType: 'application/json'
    }
];

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

function buildWorkspaceResourceUri(kind, workspacePath) {
    return `pantheon://${kind}?workspacePath=${encodeURIComponent(workspacePath)}`;
}

function readServerResource(uri) {
    if (uri === 'pantheon://server/info') {
        return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
                serverInfo: PANTHEON_MCP_SERVER_INFO,
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: ['pantheon_handoff'],
                    resources: PANTHEON_SERVER_RESOURCES.map((resource) => resource.uri),
                    resourceTemplates: PANTHEON_RESOURCE_TEMPLATES.map((template) => template.uriTemplate)
                }
            }, null, 2)
        };
    }

    if (uri === 'pantheon://server/resource-guide') {
        return {
            uri,
            mimeType: 'text/markdown',
            text: `# Pantheon MCP Resources

Use the workspace-scoped templates below with a real workspace path:

- \`pantheon://state?workspacePath={workspacePath}\`
- \`pantheon://whiteboard?workspacePath={workspacePath}\`
- \`pantheon://events?workspacePath={workspacePath}\`
- \`pantheon://sessions?workspacePath={workspacePath}\`

Example workspace path:

- \`/root/codexDir/claudecodeui\`
`
        };
    }

    return null;
}

function parsePantheonResourceUri(uri) {
    try {
        const parsed = new URL(uri);
        const workspacePath = parsed.searchParams.get('workspacePath');

        return {
            kind: parsed.hostname,
            workspacePath: typeof workspacePath === 'string' ? workspacePath.trim() : ''
        };
    } catch {
        return {
            kind: null,
            workspacePath: ''
        };
    }
}

async function readWorkspaceResource(uri, syncPantheonWorkspaceState) {
    const { kind, workspacePath } = parsePantheonResourceUri(uri);
    if (!kind || !workspacePath) {
        throw new Error('workspacePath is required for Pantheon workspace resources');
    }

    const synced = await syncPantheonWorkspaceState(workspacePath);

    if (kind === 'state') {
        return {
            contents: [
                {
                    uri: buildWorkspaceResourceUri('state', synced.workspacePath),
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        workspacePath: synced.workspacePath,
                        inboxPath: synced.inboxPath,
                        whiteboardPath: synced.whiteboardPath,
                        state: synced.state
                    }, null, 2)
                }
            ]
        };
    }

    if (kind === 'whiteboard') {
        return {
            contents: [
                {
                    uri: buildWorkspaceResourceUri('whiteboard', synced.workspacePath),
                    mimeType: 'text/markdown',
                    text: renderWhiteboardMarkdown(synced.state)
                }
            ]
        };
    }

    if (kind === 'events') {
        return {
            contents: [
                {
                    uri: buildWorkspaceResourceUri('events', synced.workspacePath),
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        workspacePath: synced.workspacePath,
                        events: synced.events
                    }, null, 2)
                }
            ]
        };
    }

    if (kind === 'sessions') {
        return {
            contents: [
                {
                    uri: buildWorkspaceResourceUri('sessions', synced.workspacePath),
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        workspacePath: synced.workspacePath,
                        registeredSessions: synced.state.registeredSessions || []
                    }, null, 2)
                }
            ]
        };
    }

    throw new Error(`Unknown Pantheon resource: ${uri}`);
}

export function buildPantheonMcpHandler({ provider, callPantheonHandoff, syncPantheonWorkspaceState = syncPantheonWorkspace }) {
    return async function handlePantheonMcpRequest(request) {
        const { id, method, params } = request || {};

        if (method === 'initialize') {
            return buildJsonRpcResult(id, {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {},
                    resources: {},
                    resourceTemplates: {}
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

        if (method === 'resources/list') {
            return buildJsonRpcResult(id, {
                resources: PANTHEON_SERVER_RESOURCES
            });
        }

        if (method === 'resources/templates/list') {
            return buildJsonRpcResult(id, {
                resourceTemplates: PANTHEON_RESOURCE_TEMPLATES
            });
        }

        if (method === 'resources/read') {
            const uri = params?.uri;
            if (typeof uri !== 'string' || !uri.trim()) {
                return buildJsonRpcError(id, -32602, 'resources/read requires a resource uri');
            }

            const serverResource = readServerResource(uri);
            if (serverResource) {
                return buildJsonRpcResult(id, {
                    contents: [serverResource]
                });
            }

            try {
                return buildJsonRpcResult(id, await readWorkspaceResource(uri, syncPantheonWorkspaceState));
            } catch (error) {
                return buildJsonRpcError(
                    id,
                    -32000,
                    error instanceof Error ? error.message : 'Failed to read Pantheon resource'
                );
            }
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
