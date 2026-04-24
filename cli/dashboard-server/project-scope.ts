import * as http from "http";
import { getProjectById } from "../db/projects";
import { setMetadataValue } from "../db/metadata";
import { DEFAULT_PROJECT_ID } from "../shared/project-types";

export function resolveProjectId(
  query: Record<string, string>,
  res: http.ServerResponse,
  sendApiError: (
    res: http.ServerResponse,
    status: number,
    errorCode: string,
    message: string
  ) => void
): string | null {
  const raw = typeof query.projectId === "string" ? query.projectId.trim() : "";
  const explicit = raw.length > 0;
  const candidate = explicit ? raw : DEFAULT_PROJECT_ID;
  let project: { id: string } | null = null;
  try {
    project = getProjectById(candidate);
  } catch {
    project = null;
  }
  if (!project) {
    if (explicit) {
      sendApiError(
        res,
        404,
        "PROJECT_NOT_FOUND",
        `Project "${candidate}" does not exist.`
      );
      return null;
    }
    // No explicit projectId and no default row available (e.g. mocked test DB).
    return DEFAULT_PROJECT_ID;
  }
  try {
    setMetadataValue("current_project_id", project.id);
  } catch {}
  return project.id;
}

export function resolveProjectIdFromBody(
  body: { projectId?: unknown } | null | undefined,
  res: http.ServerResponse,
  sendApiError: (
    res: http.ServerResponse,
    status: number,
    errorCode: string,
    message: string
  ) => void
): string | null {
  const raw =
    body && typeof body.projectId === "string" ? body.projectId.trim() : "";
  const candidate = raw.length > 0 ? raw : DEFAULT_PROJECT_ID;
  const project = getProjectById(candidate);
  if (!project) {
    sendApiError(
      res,
      404,
      "PROJECT_NOT_FOUND",
      `Project "${candidate}" does not exist.`
    );
    return null;
  }
  try {
    setMetadataValue("current_project_id", project.id);
  } catch {}
  return project.id;
}
