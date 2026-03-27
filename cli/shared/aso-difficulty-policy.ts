export const TOP_DIFFICULTY_DOC_LIMIT = 5;

export function requiresTopDifficultyDocs(appCount: number): boolean {
  return Number.isFinite(appCount) && appCount >= TOP_DIFFICULTY_DOC_LIMIT;
}

export function hasRequiredTopDifficultyDocs(params: {
  appCount: number;
  docsForDifficultyCount: number;
}): boolean {
  if (!requiresTopDifficultyDocs(params.appCount)) {
    return true;
  }
  return params.docsForDifficultyCount >= TOP_DIFFICULTY_DOC_LIMIT;
}

export function listMissingTopDifficultyDocIds(params: {
  orderedAppIds: string[];
  appDocs: Array<{ appId: string }>;
}): string[] {
  const topIds = params.orderedAppIds.slice(0, TOP_DIFFICULTY_DOC_LIMIT);
  if (topIds.length === 0) return [];
  const appDocIds = new Set(
    params.appDocs.map((doc) => doc.appId).filter(Boolean)
  );
  return topIds.filter((appId) => !appDocIds.has(appId));
}
