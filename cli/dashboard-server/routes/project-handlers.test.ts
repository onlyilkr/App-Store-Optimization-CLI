import * as http from "http";
import { jest } from "@jest/globals";
import { createProjectHandlers } from "./project-handlers";
import type { Project } from "../../shared/project-types";


jest.mock("../../db/projects", () => ({
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  getProjectById: jest.fn(),
  listProjectSummaries: jest.fn(() => []),
  ProjectError: class ProjectError extends Error {
    constructor(
      public code: string,
      message: string
    ) {
      super(message);
      this.name = "ProjectError";
    }
  },
}));

jest.mock("../../db/metadata", () => ({
  getMetadataValue: jest.fn(() => null),
  setMetadataValue: jest.fn(),
}));

import {
  createProject,
  updateProject,
} from "../../db/projects";

const mockCreateProject = jest.mocked(createProject);
const mockUpdateProject = jest.mocked(updateProject);

function makeDeps() {
  const parseJsonBody = jest.fn() as jest.MockedFunction<
    <T>(req: http.IncomingMessage, res: http.ServerResponse) => Promise<T | null>
  >;
  const sendJson = jest.fn() as jest.MockedFunction<
    (res: http.ServerResponse, status: number, data: unknown) => void
  >;
  const sendApiError = jest.fn() as jest.MockedFunction<
    (res: http.ServerResponse, status: number, errorCode: string, message: string) => void
  >;
  const reportDashboardError = jest.fn() as jest.MockedFunction<
    (error: unknown, metadata: Record<string, unknown>) => void
  >;
  return { parseJsonBody, sendJson, sendApiError, reportDashboardError };
}

function makeFakeReqRes() {
  const req = {} as http.IncomingMessage;
  const res = {} as http.ServerResponse;
  return { req, res };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "test-project",
    name: "Test Project",
    color: "blue",
    country: "US",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("project-handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleProjectsPost", () => {
    it("accepts country and persists it", async () => {
      const deps = makeDeps();
      const { req, res } = makeFakeReqRes();

      (deps.parseJsonBody as any).mockResolvedValue({ name: "X-TR", country: "TR" });
      const fakeProject = makeProject({ name: "X-TR", country: "TR" });
      mockCreateProject.mockReturnValue(fakeProject);

      const { handleProjectsPost } = createProjectHandlers(deps);
      await handleProjectsPost(req, res);

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: "X-TR", country: "TR" })
      );
      expect(deps.sendJson).toHaveBeenCalledWith(
        res,
        201,
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ country: "TR" }),
        })
      );
    });

    it("rejects invalid country with 400", async () => {
      const deps = makeDeps();
      const { req, res } = makeFakeReqRes();

      (deps.parseJsonBody as any).mockResolvedValue({ name: "X", country: "ZZ" });

      const { handleProjectsPost } = createProjectHandlers(deps);
      await handleProjectsPost(req, res);

      expect(deps.sendApiError).toHaveBeenCalledWith(
        res,
        400,
        "INVALID_REQUEST",
        expect.stringMatching(/Unsupported country/)
      );
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    it("accepts a valid project without country", async () => {
      const deps = makeDeps();
      const { req, res } = makeFakeReqRes();

      (deps.parseJsonBody as any).mockResolvedValue({ name: "No Country" });
      const fakeProject = makeProject({ name: "No Country" });
      mockCreateProject.mockReturnValue(fakeProject);

      const { handleProjectsPost } = createProjectHandlers(deps);
      await handleProjectsPost(req, res);

      expect(deps.sendJson).toHaveBeenCalledWith(
        res,
        201,
        expect.objectContaining({ success: true })
      );
    });
  });

  describe("handleProjectPatch", () => {
    it("can change country", async () => {
      const deps = makeDeps();
      const { req, res } = makeFakeReqRes();

      (deps.parseJsonBody as any).mockResolvedValue({ country: "DE" });
      const updatedProject = makeProject({ country: "DE" });
      mockUpdateProject.mockReturnValue(updatedProject);

      const { handleProjectPatch } = createProjectHandlers(deps);
      await handleProjectPatch(req, res, "test-project");

      expect(mockUpdateProject).toHaveBeenCalledWith(
        "test-project",
        expect.objectContaining({ country: "DE" })
      );
      expect(deps.sendJson).toHaveBeenCalledWith(
        res,
        200,
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ country: "DE" }),
        })
      );
    });

    it("rejects invalid country with 400 on PATCH", async () => {
      const deps = makeDeps();
      const { req, res } = makeFakeReqRes();

      (deps.parseJsonBody as any).mockResolvedValue({ country: "ZZ" });

      const { handleProjectPatch } = createProjectHandlers(deps);
      await handleProjectPatch(req, res, "test-project");

      expect(deps.sendApiError).toHaveBeenCalledWith(
        res,
        400,
        "INVALID_REQUEST",
        expect.stringMatching(/Unsupported country/)
      );
      expect(mockUpdateProject).not.toHaveBeenCalled();
    });
  });
});
