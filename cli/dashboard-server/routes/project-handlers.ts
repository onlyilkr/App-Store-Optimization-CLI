import * as http from "http";
import {
  ProjectError,
  createProject,
  deleteProject,
  getProjectById,
  listProjectSummaries,
  updateProject,
} from "../../db/projects";
import { getMetadataValue, setMetadataValue } from "../../db/metadata";
import {
  DEFAULT_PROJECT_ID,
  isValidProjectColor,
  type ProjectColor,
} from "../../shared/project-types";

type ProjectHandlersDeps = {
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
};

function handleProjectError(
  res: http.ServerResponse,
  deps: ProjectHandlersDeps,
  error: unknown
): void {
  if (error instanceof ProjectError) {
    const status =
      error.code === "LAST_PROJECT"
        ? 409
        : error.code === "DUPLICATE_NAME"
          ? 409
          : 400;
    deps.sendApiError(res, status, error.code, error.message);
    return;
  }
  deps.reportDashboardError(error, {
    source: "project-handlers",
  });
  deps.sendApiError(
    res,
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred while processing projects."
  );
}

export function createProjectHandlers(deps: ProjectHandlersDeps) {
  function handleProjectsGet(res: http.ServerResponse): void {
    try {
      const summaries = listProjectSummaries();
      deps.sendJson(res, 200, {
        success: true,
        data: summaries,
      });
    } catch (error) {
      handleProjectError(res, deps, error);
    }
  }

  async function handleProjectsPost(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const body = await deps.parseJsonBody<{
      name?: string;
      color?: string;
    }>(req, res);
    if (!body) return;
    if (typeof body.name !== "string") {
      deps.sendApiError(
        res,
        400,
        "INVALID_REQUEST",
        "Project name is required."
      );
      return;
    }
    const color: ProjectColor | undefined = isValidProjectColor(body.color)
      ? body.color
      : undefined;
    try {
      const project = createProject({ name: body.name, color });
      deps.sendJson(res, 201, { success: true, data: project });
    } catch (error) {
      handleProjectError(res, deps, error);
    }
  }

  async function handleProjectPatch(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    id: string
  ): Promise<void> {
    const body = await deps.parseJsonBody<{
      name?: string;
      color?: string;
    }>(req, res);
    if (!body) return;
    const color: ProjectColor | undefined = isValidProjectColor(body.color)
      ? body.color
      : undefined;
    try {
      const updated = updateProject(id, {
        name: typeof body.name === "string" ? body.name : undefined,
        color,
      });
      if (!updated) {
        deps.sendApiError(res, 404, "PROJECT_NOT_FOUND", "Project not found.");
        return;
      }
      deps.sendJson(res, 200, { success: true, data: updated });
    } catch (error) {
      handleProjectError(res, deps, error);
    }
  }

  function handleProjectDelete(res: http.ServerResponse, id: string): void {
    try {
      const result = deleteProject(id);
      if (!result) {
        deps.sendApiError(res, 404, "PROJECT_NOT_FOUND", "Project not found.");
        return;
      }
      const current = getMetadataValue("current_project_id");
      if (current === id) {
        setMetadataValue("current_project_id", DEFAULT_PROJECT_ID);
      }
      deps.sendJson(res, 200, { success: true, data: result });
    } catch (error) {
      handleProjectError(res, deps, error);
    }
  }

  function handleCurrentProjectGet(res: http.ServerResponse): void {
    const stored = getMetadataValue("current_project_id");
    const project =
      (stored ? getProjectById(stored) : null) ??
      getProjectById(DEFAULT_PROJECT_ID);
    if (!project) {
      deps.sendApiError(
        res,
        404,
        "PROJECT_NOT_FOUND",
        "No project is available."
      );
      return;
    }
    deps.sendJson(res, 200, {
      success: true,
      data: { projectId: project.id },
    });
  }

  async function handleCurrentProjectPut(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const body = await deps.parseJsonBody<{ projectId?: string }>(req, res);
    if (!body) return;
    const projectId =
      typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!projectId) {
      deps.sendApiError(
        res,
        400,
        "INVALID_REQUEST",
        "projectId is required."
      );
      return;
    }
    const project = getProjectById(projectId);
    if (!project) {
      deps.sendApiError(res, 404, "PROJECT_NOT_FOUND", "Project not found.");
      return;
    }
    setMetadataValue("current_project_id", project.id);
    deps.sendJson(res, 200, {
      success: true,
      data: { projectId: project.id },
    });
  }

  return {
    handleProjectsGet,
    handleProjectsPost,
    handleProjectPatch,
    handleProjectDelete,
    handleCurrentProjectGet,
    handleCurrentProjectPut,
  };
}
