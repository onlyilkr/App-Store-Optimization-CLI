export const RESEARCH_APP_ID = "research";
export const RESEARCH_APP_ID_PREFIX = "research:";
export const DEFAULT_RESEARCH_APP_ID = RESEARCH_APP_ID;
export const DEFAULT_RESEARCH_APP_NAME = "Research";

export function isResearchAppId(appId: string): boolean {
  const normalized = appId.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized === RESEARCH_APP_ID ||
    normalized.startsWith(RESEARCH_APP_ID_PREFIX)
  );
}

export function researchAppIdForProject(projectId: string): string {
  const trimmed = projectId.trim();
  if (!trimmed) {
    throw new Error("projectId is required to build a research app id");
  }
  return `${RESEARCH_APP_ID_PREFIX}${trimmed}`;
}

export function projectIdFromResearchAppId(appId: string): string | null {
  const trimmed = appId.trim();
  if (!trimmed) return null;
  if (trimmed === RESEARCH_APP_ID) return null;
  if (!trimmed.startsWith(RESEARCH_APP_ID_PREFIX)) return null;
  const projectId = trimmed.slice(RESEARCH_APP_ID_PREFIX.length);
  return projectId.length > 0 ? projectId : null;
}
