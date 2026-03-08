#!/usr/bin/env node

function parseArgs(argv) {
    const args = {
        provider: 'claude',
        baseUrl: process.env.PANTHEON_BASE_URL || `http://127.0.0.1:${process.env.PORT || '39021'}`,
        apiKey: process.env.PANTHEON_API_KEY || process.env.API_KEY || null
    };

    for (let index = 2; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];

        if (arg === '--provider' && next) {
            args.provider = next;
            index += 1;
            continue;
        }

        if (arg === '--base-url' && next) {
            args.baseUrl = next;
            index += 1;
            continue;
        }

        if (arg === '--api-key' && next) {
            args.apiKey = next;
            index += 1;
        }
    }

    return args;
}

function sendMessage(message) {
    const body = JSON.stringify(message);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}

function sendResult(id, result) {
    sendMessage({
        jsonrpc: '2.0',
        id,
        result
    });
}

function sendError(id, code, message, data = undefined) {
    sendMessage({
        jsonrpc: '2.0',
        id,
        error: {
            code,
            message,
            ...(data !== undefined ? { data } : {})
        }
    });
}

const TOOL_DEFINITION = {
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

async function callPantheonHandoff(config, args) {
    const payload = {
        ...args,
        from: typeof args.from === 'string' && args.from.trim() ? args.from.trim() : config.provider
    };

    const headers = {
        'Content-Type': 'application/json'
    };

    if (config.apiKey) {
        headers['x-api-key'] = config.apiKey;
    }

    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/api/pantheon/handoff`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Pantheon handoff request failed with status ${response.status}`);
    }

    return data;
}

async function handleRequest(config, request) {
    const { id, method, params } = request;

    if (method === 'initialize') {
        sendResult(id, {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: 'pantheon-mcp',
                version: '0.1.0'
            }
        });
        return;
    }

    if (method === 'notifications/initialized') {
        return;
    }

    if (method === 'tools/list') {
        sendResult(id, {
            tools: [TOOL_DEFINITION]
        });
        return;
    }

    if (method === 'tools/call') {
        const toolName = params?.name;
        if (toolName !== 'pantheon_handoff') {
            sendError(id, -32602, `Unknown tool: ${toolName}`);
            return;
        }

        try {
            const result = await callPantheonHandoff(config, params?.arguments || {});
            sendResult(id, {
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
            sendResult(id, {
                content: [
                    {
                        type: 'text',
                        text: error instanceof Error ? error.message : 'Pantheon handoff failed'
                    }
                ],
                isError: true
            });
        }
        return;
    }

    sendError(id, -32601, `Method not found: ${method}`);
}

function createStdioMessageParser(onMessage) {
    let buffer = Buffer.alloc(0);

    return (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (true) {
            const headerEnd = buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1) {
                return;
            }

            const headerText = buffer.slice(0, headerEnd).toString('utf8');
            const contentLengthMatch = headerText.match(/Content-Length:\s*(\d+)/i);
            if (!contentLengthMatch) {
                buffer = Buffer.alloc(0);
                return;
            }

            const contentLength = Number.parseInt(contentLengthMatch[1], 10);
            const messageStart = headerEnd + 4;
            const messageEnd = messageStart + contentLength;
            if (buffer.length < messageEnd) {
                return;
            }

            const body = buffer.slice(messageStart, messageEnd).toString('utf8');
            buffer = buffer.slice(messageEnd);

            try {
                const message = JSON.parse(body);
                onMessage(message);
            } catch (error) {
                // Ignore malformed JSON-RPC messages.
            }
        }
    };
}

async function main() {
    const config = parseArgs(process.argv);

    const parseChunk = createStdioMessageParser((message) => {
        Promise.resolve(handleRequest(config, message)).catch((error) => {
            if (message?.id !== undefined) {
                sendError(message.id, -32000, error instanceof Error ? error.message : 'Unhandled Pantheon MCP error');
            }
        });
    });

    process.stdin.on('data', parseChunk);
    process.stdin.on('error', (error) => {
        console.error('[Pantheon MCP] stdin error:', error);
    });
}

main().catch((error) => {
    console.error('[Pantheon MCP] fatal error:', error);
    process.exit(1);
});
