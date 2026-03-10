#!/usr/bin/env node

import { buildPantheonMcpHandler } from './mcp-protocol.js';

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
            } catch {
                // Ignore malformed JSON-RPC messages.
            }
        }
    };
}

async function main() {
    const config = parseArgs(process.argv);
    const handleRequest = buildPantheonMcpHandler({
        provider: config.provider,
        callPantheonHandoff: (args) => callPantheonHandoff(config, args)
    });

    const parseChunk = createStdioMessageParser((message) => {
        Promise.resolve(handleRequest(message))
            .then((response) => {
                if (response) {
                    sendMessage(response);
                }
            })
            .catch((error) => {
                if (message?.id !== undefined) {
                    sendMessage({
                        jsonrpc: '2.0',
                        id: message.id,
                        error: {
                            code: -32000,
                            message: error instanceof Error ? error.message : 'Unhandled Pantheon MCP error'
                        }
                    });
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
