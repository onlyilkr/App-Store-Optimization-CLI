import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiGet,
  apiWrite,
  setCurrentProjectIdForRequests,
  toActionableErrorMessage,
} from "../app-helpers";
import {
  DEFAULT_PROJECT_ID,
  type Project,
  type ProjectColor,
  type ProjectSummary,
} from "../../shared/project-types";
import type { SupportedCountry } from "../../shared/aso-storefronts";

const CURRENT_PROJECT_STORAGE_KEY = "aso-current-project-id";

type CurrentProjectResponse = { projectId: string };

export type UseCurrentProjectResult = {
  projects: ProjectSummary[];
  currentProject: ProjectSummary | null;
  isLoading: boolean;
  errorText: string;
  setCurrentProjectId: (projectId: string) => Promise<void>;
  createProject: (input: {
    name: string;
    color?: ProjectColor;
    country?: SupportedCountry;
  }) => Promise<Project>;
  updateProject: (
    projectId: string,
    patch: { name?: string; color?: ProjectColor; country?: SupportedCountry }
  ) => Promise<Project>;
  deleteProject: (
    projectId: string
  ) => Promise<{
    deletedProjectId: string;
    deletedAppCount: number;
    deletedKeywordCount: number;
  }>;
  refresh: () => Promise<void>;
};

function readStoredProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY);
    return value ? value.trim() || null : null;
  } catch {
    return null;
  }
}

function writeStoredProjectId(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, projectId);
  } catch {}
}

export function useCurrentProject(): UseCurrentProjectResult {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(
    () => readStoredProjectId() ?? DEFAULT_PROJECT_ID
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    setCurrentProjectIdForRequests(currentProjectId);
  }, [currentProjectId]);

  const loadProjects = useCallback(async () => {
    try {
      const [list, current] = await Promise.all([
        apiGet<ProjectSummary[]>("/api/projects"),
        apiGet<CurrentProjectResponse>("/api/projects/current").catch(
          () => null
        ),
      ]);
      setProjects(list);
      const stored = readStoredProjectId();
      const serverCurrent = current?.projectId ?? null;
      const existsLocally = (id: string | null) =>
        id ? list.some((project) => project.id === id) : false;
      const preferred =
        (existsLocally(stored) && stored) ||
        (existsLocally(serverCurrent) && serverCurrent) ||
        list[0]?.id ||
        DEFAULT_PROJECT_ID;
      setCurrentProjectIdState(preferred);
      writeStoredProjectId(preferred);
      setCurrentProjectIdForRequests(preferred);
      setErrorText("");
    } catch (error) {
      setErrorText(toActionableErrorMessage(error, "Failed to load projects."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const setCurrentProjectId = useCallback(
    async (projectId: string) => {
      setCurrentProjectIdState(projectId);
      writeStoredProjectId(projectId);
      setCurrentProjectIdForRequests(projectId);
      try {
        await apiWrite<CurrentProjectResponse>(
          "PUT",
          "/api/projects/current",
          { projectId }
        );
      } catch {
        // best-effort server sync; localStorage is the source of truth
      }
    },
    []
  );

  const createProject = useCallback(
    async (input: {
      name: string;
      color?: ProjectColor;
      country?: SupportedCountry;
    }) => {
      const created = await apiWrite<Project>(
        "POST",
        "/api/projects",
        input
      );
      await loadProjects();
      await setCurrentProjectId(created.id);
      return created;
    },
    [loadProjects, setCurrentProjectId]
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      patch: { name?: string; color?: ProjectColor; country?: SupportedCountry }
    ) => {
      const updated = await apiWrite<Project>(
        "PATCH",
        `/api/projects/${encodeURIComponent(projectId)}`,
        patch
      );
      await loadProjects();
      return updated;
    },
    [loadProjects]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      const result = await apiWrite<{
        deletedProjectId: string;
        deletedAppCount: number;
        deletedKeywordCount: number;
      }>("DELETE", `/api/projects/${encodeURIComponent(projectId)}`, null);
      await loadProjects();
      if (currentProjectId === projectId) {
        const next = projects.find((p) => p.id !== projectId);
        if (next) {
          await setCurrentProjectId(next.id);
        }
      }
      return result;
    },
    [currentProjectId, loadProjects, projects, setCurrentProjectId]
  );

  const currentProject = useMemo<ProjectSummary | null>(() => {
    if (!currentProjectId) return null;
    return projects.find((project) => project.id === currentProjectId) ?? null;
  }, [currentProjectId, projects]);

  return {
    projects,
    currentProject,
    isLoading,
    errorText,
    setCurrentProjectId,
    createProject,
    updateProject,
    deleteProject,
    refresh: loadProjects,
  };
}
