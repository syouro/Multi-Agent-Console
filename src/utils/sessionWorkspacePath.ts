import type { Project, ProjectSession } from '../types/app';

type SessionWithWorkspace = ProjectSession & {
  cwd?: string | null;
  projectPath?: string | null;
};

export function getProjectWorkspacePath(project: Project | null | undefined): string {
  if (!project) {
    return '';
  }

  return project.fullPath || project.path || '';
}

export function getSessionWorkspacePath(
  project: Project | null | undefined,
  session: ProjectSession | null | undefined,
): string {
  if (!session) {
    return getProjectWorkspacePath(project);
  }

  const sessionWithWorkspace = session as SessionWithWorkspace;
  return sessionWithWorkspace.cwd || sessionWithWorkspace.projectPath || getProjectWorkspacePath(project);
}
