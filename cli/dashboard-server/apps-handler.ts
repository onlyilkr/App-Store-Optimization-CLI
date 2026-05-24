import * as http from "http";
import {
  addAppToProject,
  deleteOwnedAppById,
  getOwnedAppById,
  removeAppFromProject,
  upsertOwnedApps,
  upsertOwnedAppSnapshots,
} from "../db/owned-apps";
import { getProjectById } from "../db/projects";
import { deleteAppKeywordsByAppId } from "../db/app-keywords";
import {
  DEFAULT_RESEARCH_APP_ID,
  DEFAULT_RESEARCH_APP_NAME,
  researchAppIdForProject,
} from "../shared/aso-research";
import { DEFAULT_PROJECT_ID } from "../shared/project-types";
import type { OwnedAppSnapshot } from "./owned-app-details";

type ManualAppAddRequest =
  | {
      type: "app";
      appId?: string;
    }
  | {
      type: "research";
      name?: string;
    };

type CreateAppsHandlersDeps = {
  parseJsonBody: <T>(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) => Promise<T | null>;
  sendJson: (res: http.ServerResponse, status: number, data: unknown) => void;
  sendApiError: (
    res: http.ServerResponse,
    status: number,
    errorCode: string,
    message: string
  ) => void;
  reportDashboardError: (
    error: unknown,
    metadata: Record<string, unknown>
  ) => void;
  fetchOwnedAppSnapshotsFromApi: (
    country: string,
    appIds: string[]
  ) => Promise<OwnedAppSnapshot[]>;
  resolveHydrationCountry: (projectId: string) => string;
};

type DeleteAppRequest = {
  appId?: string;
};

function normalizeAppId(input: string | undefined): string {
  return (input ?? "").trim();
}

function isNumericAppId(appId: string): boolean {
  return /^\d+$/.test(appId);
}

function slugifyResearchName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return base || "research";
}

function nextResearchAppId(slug: string): string {
  const baseId = `research:${slug}`;
  if (!getOwnedAppById(baseId)) {
    return baseId;
  }
  let suffix = 2;
  while (true) {
    const candidate = `${baseId}-${suffix}`;
    if (!getOwnedAppById(candidate)) {
      return candidate;
    }
    suffix += 1;
  }
}

export function ensureDefaultResearchAppExists(
  projectId: string = DEFAULT_PROJECT_ID
): void {
  const researchId =
    projectId === DEFAULT_PROJECT_ID
      ? researchAppIdForProject(DEFAULT_PROJECT_ID)
      : researchAppIdForProject(projectId);
  if (getOwnedAppById(researchId)) {
    return;
  }
  // Backfill: if legacy bare "research" row exists (pre-migration), skip seed.
  if (
    projectId === DEFAULT_PROJECT_ID &&
    getOwnedAppById(DEFAULT_RESEARCH_APP_ID)
  ) {
    return;
  }
  upsertOwnedApps([
    {
      id: researchId,
      kind: "research",
      name: DEFAULT_RESEARCH_APP_NAME,
      projectId,
    },
  ]);
}

export function createAppsHandlers(deps: CreateAppsHandlersDeps) {
  async function handleApiAppsPost(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    projectId: string = DEFAULT_PROJECT_ID
  ): Promise<void> {
    const body = await deps.parseJsonBody<ManualAppAddRequest>(req, res);
    if (!body) {
      return;
    }

    if (!body || (body.type !== "app" && body.type !== "research")) {
      deps.sendApiError(
        res,
        400,
        "INVALID_REQUEST",
        "Invalid request. type must be 'app' or 'research'."
      );
      return;
    }

    if (body.type === "app") {
      const appId = normalizeAppId(body.appId);
      if (!appId || !isNumericAppId(appId)) {
        deps.sendApiError(res, 400, "INVALID_REQUEST", "App ID must be numeric.");
        return;
      }

      const country = deps.resolveHydrationCountry(projectId);
      upsertOwnedApps([{ id: appId, kind: "owned", name: appId, projectId }]);
      addAppToProject(appId, projectId);
      let hydratedName = appId;
      try {
        const snapshots = await deps.fetchOwnedAppSnapshotsFromApi(country, [appId]);
        if (snapshots.length > 0) {
          upsertOwnedAppSnapshots(
            country,
            snapshots.map((snapshot) => ({ ...snapshot, projectId }))
          );
          const first = snapshots[0];
          if (first?.name?.trim()) {
            hydratedName = first.name.trim();
          }
        }
      } catch (error) {
        deps.reportDashboardError(error, {
          method: "POST",
          path: "/api/apps",
          phase: "manual-app-hydration",
          appId,
          country,
          projectId,
        });
      }

      deps.sendJson(res, 201, {
        success: true,
        data: {
          id: appId,
          name: hydratedName,
        },
      });
      return;
    }

    const name = (body.name ?? "").trim();
    if (!name) {
      deps.sendApiError(res, 400, "INVALID_REQUEST", "Research name is required.");
      return;
    }

    const slug = slugifyResearchName(name);
    ensureDefaultResearchAppExists(projectId);
    const id = nextResearchAppId(slug);
    upsertOwnedApps([{ id, kind: "research", name, projectId }]);
    addAppToProject(id, projectId);
    deps.sendJson(res, 201, {
      success: true,
      data: {
        id,
        name,
      },
    });
  }

  async function handleApiAppsDelete(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    projectId: string = DEFAULT_PROJECT_ID
  ): Promise<void> {
    const body = await deps.parseJsonBody<DeleteAppRequest>(req, res);
    if (!body) {
      return;
    }

    const appId = normalizeAppId(body.appId);
    if (!appId) {
      deps.sendApiError(res, 400, "INVALID_REQUEST", "App ID is required.");
      return;
    }

    if (appId === DEFAULT_RESEARCH_APP_ID) {
      deps.sendApiError(
        res,
        400,
        "INVALID_REQUEST",
        "Default Research app cannot be deleted."
      );
      return;
    }

    const country = deps.resolveHydrationCountry(projectId);
    const existing = getOwnedAppById(appId, country);
    if (!existing) {
      deps.sendApiError(res, 404, "NOT_FOUND", "App not found.");
      return;
    }

    // Remove the app from the current project. If no other project still
    // lists it, fully delete the app + keyword data. This lets an app live
    // in multiple projects at once.
    const { remainingProjects } = removeAppFromProject(appId, projectId);
    let removedKeywordCount = 0;
    let fullyDeleted = false;
    if (remainingProjects === 0) {
      removedKeywordCount = deleteAppKeywordsByAppId(appId);
      const removedAppCount = deleteOwnedAppById(appId);
      if (removedAppCount === 0) {
        deps.sendApiError(res, 404, "NOT_FOUND", "App not found.");
        return;
      }
      fullyDeleted = true;
    }

    deps.sendJson(res, 200, {
      success: true,
      data: {
        id: appId,
        removedKeywordCount,
        fullyDeleted,
        remainingProjects,
      },
    });
  }

  async function handleApiAppPatch(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    appId: string
  ): Promise<void> {
    const body = await deps.parseJsonBody<{ projectId?: string }>(req, res);
    if (!body) return;
    const normalized = normalizeAppId(appId);
    if (!normalized) {
      deps.sendApiError(res, 400, "INVALID_REQUEST", "App ID is required.");
      return;
    }
    const targetProjectId =
      typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!targetProjectId) {
      deps.sendApiError(
        res,
        400,
        "INVALID_REQUEST",
        "projectId is required in the request body."
      );
      return;
    }
    const project = getProjectById(targetProjectId);
    if (!project) {
      deps.sendApiError(res, 404, "PROJECT_NOT_FOUND", "Project not found.");
      return;
    }
    const country = deps.resolveHydrationCountry(project.id);
    const existing = getOwnedAppById(normalized, country);
    if (!existing) {
      deps.sendApiError(res, 404, "NOT_FOUND", "App not found.");
      return;
    }
    if (existing.kind === "research") {
      deps.sendApiError(
        res,
        400,
        "INVALID_REQUEST",
        "Research apps cannot be moved between projects."
      );
      return;
    }
    const added = addAppToProject(normalized, project.id);
    deps.sendJson(res, 200, {
      success: true,
      data: {
        id: normalized,
        projectId: project.id,
        addedMembership: added,
      },
    });
  }

  return {
    handleApiAppsPost,
    handleApiAppsDelete,
    handleApiAppPatch,
  };
}
