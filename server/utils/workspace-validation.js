import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

// Configure allowed workspace root (defaults to user's home directory)
const WORKSPACES_ROOT = process.env.WORKSPACES_ROOT || os.homedir();

// System-critical paths that should never be used as workspace directories
const FORBIDDEN_PATHS = [
    '/',
    '/etc',
    '/bin',
    '/sbin',
    '/usr',
    '/dev',
    '/proc',
    '/sys',
    '/var',
    '/boot',
    '/root',
    '/lib',
    '/lib64',
    '/opt',
    '/tmp',
    '/run',
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    'C:\\ProgramData',
    'C:\\System Volume Information',
    'C:\\$Recycle.Bin'
];

async function resolveWorkspaceRoot() {
    return fs.realpath(WORKSPACES_ROOT);
}

async function resolveCandidatePath(absolutePath) {
    try {
        await fs.access(absolutePath);
        return await fs.realpath(absolutePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }

        const parentPath = path.dirname(absolutePath);
        try {
            const parentRealPath = await fs.realpath(parentPath);
            return path.join(parentRealPath, path.basename(absolutePath));
        } catch (parentError) {
            if (parentError.code === 'ENOENT') {
                return absolutePath;
            }

            throw parentError;
        }
    }
}

export async function validateWorkspacePath(requestedPath) {
    try {
        const absolutePath = path.resolve(requestedPath);
        const normalizedPath = path.normalize(absolutePath);
        const resolvedWorkspaceRoot = await resolveWorkspaceRoot();

        if (FORBIDDEN_PATHS.includes(normalizedPath) || normalizedPath === '/') {
            return {
                valid: false,
                error: 'Cannot use system-critical directories as workspace locations'
            };
        }

        for (const forbidden of FORBIDDEN_PATHS) {
            if (normalizedPath === forbidden || normalizedPath.startsWith(forbidden + path.sep)) {
                if (forbidden === resolvedWorkspaceRoot && normalizedPath !== forbidden) {
                    continue;
                }

                if (forbidden === '/var' &&
                    (normalizedPath.startsWith('/var/tmp') || normalizedPath.startsWith('/var/folders'))) {
                    continue;
                }

                return {
                    valid: false,
                    error: `Cannot create workspace in system directory: ${forbidden}`
                };
            }
        }

        const realPath = await resolveCandidatePath(absolutePath);

        if (!realPath.startsWith(resolvedWorkspaceRoot + path.sep) && realPath !== resolvedWorkspaceRoot) {
            return {
                valid: false,
                error: `Workspace path must be within the allowed workspace root: ${WORKSPACES_ROOT}`
            };
        }

        try {
            await fs.access(absolutePath);
            const stats = await fs.lstat(absolutePath);

            if (stats.isSymbolicLink()) {
                const linkTarget = await fs.readlink(absolutePath);
                const resolvedTarget = path.resolve(path.dirname(absolutePath), linkTarget);
                const realTarget = await fs.realpath(resolvedTarget);

                if (!realTarget.startsWith(resolvedWorkspaceRoot + path.sep) &&
                    realTarget !== resolvedWorkspaceRoot) {
                    return {
                        valid: false,
                        error: 'Symlink target is outside the allowed workspace root'
                    };
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        return {
            valid: true,
            resolvedPath: realPath
        };
    } catch (error) {
        return {
            valid: false,
            error: `Path validation failed: ${error.message}`
        };
    }
}

export {
    FORBIDDEN_PATHS,
    WORKSPACES_ROOT
};
