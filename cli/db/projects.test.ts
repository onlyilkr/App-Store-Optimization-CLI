import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { closeDbForTests, getDb } from "./store";
import {
  ProjectError,
  createProject,
  deleteProject,
  getProjectById,
  getProjectByName,
  getProjectCounts,
  listProjects,
  listProjectSummaries,
  updateProject,
} from "./projects";
import { DEFAULT_PROJECT_ID } from "../shared/project-types";
import { researchAppIdForProject } from "../shared/aso-research";

const TEST_DB_PATH = path.join(
  os.tmpdir(),
  `aso-projects-${process.pid}-${Date.now()}.sqlite`
);

function cleanDbFiles(): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${TEST_DB_PATH}${suffix}`);
    } catch {}
  }
}

describe("projects", () => {
  beforeAll(() => {
    process.env.ASO_DB_PATH = TEST_DB_PATH;
  });

  beforeEach(() => {
    closeDbForTests();
    cleanDbFiles();
  });

  afterAll(() => {
    closeDbForTests();
    cleanDbFiles();
    delete process.env.ASO_DB_PATH;
  });

  it("returns the default project on fresh init", () => {
    const projects = listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(DEFAULT_PROJECT_ID);
    expect(projects[0].name).toBe("Default");
  });

  it("creates a project with slug id and seeds a research app", () => {
    const created = createProject({ name: "Halal Food", color: "green" });
    expect(created.id).toBe("halal-food");
    expect(created.name).toBe("Halal Food");
    expect(created.color).toBe("green");

    const db = getDb();
    const researchRow = db
      .prepare(
        `SELECT id, kind, project_id FROM owned_apps WHERE project_id = ? AND kind = 'research'`
      )
      .get(created.id) as
      | { id: string; kind: string; project_id: string }
      | undefined;
    expect(researchRow).toBeDefined();
    expect(researchRow?.id).toBe(researchAppIdForProject(created.id));
  });

  it("normalizes Turkish characters in slug", () => {
    const created = createProject({ name: "Altın Takibi" });
    expect(created.id).toBe("altin-takibi");
  });

  it("appends suffix when two different names slugify to the same value", () => {
    const first = createProject({ name: "Food Scanner" });
    // "food-scanner" as a display name slugifies to the same "food-scanner" id,
    // but passes the case-insensitive name uniqueness check.
    const second = createProject({ name: "food-scanner" });
    expect(first.id).toBe("food-scanner");
    expect(second.id).toBe("food-scanner-2");
  });

  it("rejects duplicate names case-insensitively", () => {
    createProject({ name: "Gold Tracker" });
    expect(() => createProject({ name: "gold tracker" })).toThrow(ProjectError);
    expect(() => createProject({ name: "GOLD TRACKER" })).toThrow(ProjectError);
  });

  it("rejects invalid or empty names", () => {
    expect(() => createProject({ name: "" })).toThrow(ProjectError);
    expect(() => createProject({ name: "   " })).toThrow(ProjectError);
    expect(() => createProject({ name: "x".repeat(61) })).toThrow(ProjectError);
  });

  it("updates project name and color but preserves id", () => {
    const created = createProject({ name: "Draft" });
    const updated = updateProject(created.id, {
      name: "Published",
      color: "blue",
    });
    expect(updated?.id).toBe(created.id);
    expect(updated?.name).toBe("Published");
    expect(updated?.color).toBe("blue");
  });

  it("rejects renaming to an existing project name", () => {
    const a = createProject({ name: "Alpha" });
    createProject({ name: "Beta" });
    expect(() => updateProject(a.id, { name: "Beta" })).toThrow(ProjectError);
  });

  it("allows renaming to the same name (case-insensitive no-op)", () => {
    const created = createProject({ name: "Alpha" });
    const updated = updateProject(created.id, { name: "ALPHA" });
    expect(updated?.name).toBe("ALPHA");
  });

  it("refuses to delete the only project", () => {
    expect(() => deleteProject(DEFAULT_PROJECT_ID)).toThrow(ProjectError);
  });

  it("deletes a project and cascades its owned apps + keywords", () => {
    const project = createProject({ name: "Temp" });
    const db = getDb();
    db.prepare(
      `INSERT INTO owned_apps (id, kind, name, icon_json, project_id)
       VALUES (?, 'owned', ?, NULL, ?)`
    ).run("11111", "Temp App", project.id);
    db.prepare(
      `INSERT INTO app_keywords (app_id, keyword, country, is_favorite, previous_position, added_at)
       VALUES (?, ?, 'US', 0, NULL, ?)`
    ).run("11111", "temp kw", new Date().toISOString());
    db.prepare(
      `INSERT INTO app_keyword_position_history (app_id, keyword, country, position, captured_at)
       VALUES (?, ?, 'US', ?, ?)`
    ).run("11111", "temp kw", 10, new Date().toISOString());

    const counts = getProjectCounts(project.id);
    expect(counts.appCount).toBe(1);
    expect(counts.keywordCount).toBe(1);

    const result = deleteProject(project.id);
    expect(result?.deletedAppCount).toBe(1);
    expect(result?.deletedKeywordCount).toBe(1);

    expect(getProjectById(project.id)).toBeNull();
    const ownedAfter = db
      .prepare(`SELECT id FROM owned_apps WHERE project_id = ?`)
      .all(project.id);
    expect(ownedAfter).toHaveLength(0);
    const keywordsAfter = db
      .prepare(`SELECT keyword FROM app_keywords WHERE app_id = ?`)
      .all("11111");
    expect(keywordsAfter).toHaveLength(0);
    const historyAfter = db
      .prepare(
        `SELECT keyword FROM app_keyword_position_history WHERE app_id = ?`
      )
      .all("11111");
    expect(historyAfter).toHaveLength(0);
  });

  it("returns null from delete for unknown project id", () => {
    expect(deleteProject("does-not-exist")).toBeNull();
  });

  it("provides summaries with counts", () => {
    const project = createProject({ name: "With Data" });
    const db = getDb();
    db.prepare(
      `INSERT INTO owned_apps (id, kind, name, icon_json, project_id)
       VALUES (?, 'owned', ?, NULL, ?)`
    ).run("22222", "Data App", project.id);
    db.prepare(
      `INSERT INTO app_keywords (app_id, keyword, country, is_favorite, previous_position, added_at)
       VALUES (?, ?, 'US', 0, NULL, ?)`
    ).run("22222", "demo", new Date().toISOString());

    const summaries = listProjectSummaries();
    const withData = summaries.find((summary) => summary.id === project.id);
    expect(withData?.appCount).toBe(1);
    expect(withData?.keywordCount).toBe(1);
  });

  it("looks up projects by name case-insensitively", () => {
    const created = createProject({ name: "Mixed" });
    expect(getProjectByName("mixed")?.id).toBe(created.id);
    expect(getProjectByName("  MIXED  ")?.id).toBe(created.id);
    expect(getProjectByName("absent")).toBeNull();
  });

  it("enforces uniqueness of research app per project via index", () => {
    const project = createProject({ name: "Unique Research" });
    const db = getDb();
    expect(() =>
      db
        .prepare(
          `INSERT INTO owned_apps (id, kind, name, icon_json, project_id)
           VALUES (?, 'research', ?, NULL, ?)`
        )
        .run(`research:${project.id}-extra`, "Extra", project.id)
    ).toThrow();
  });
});
