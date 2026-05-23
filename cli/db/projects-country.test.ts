import path from "path";
import fs from "fs";
import os from "os";
import { getDb, resetDbForTests } from "./store";
import {
  createProject,
  getProjectById,
  listProjectSummaries,
  updateProject,
} from "./projects";

function withTempDb<T>(fn: () => T): T {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aso-db-test-"));
  process.env.ASO_DB_PATH = path.join(tmp, "test.sqlite");
  resetDbForTests();
  try {
    return fn();
  } finally {
    resetDbForTests();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ASO_DB_PATH;
  }
}

describe("projects.country migration", () => {
  it("creates the country column with US default on fresh DB", () => {
    withTempDb(() => {
      const db = getDb();
      const cols = db.prepare(`PRAGMA table_info(projects)`).all() as Array<{
        name: string;
        dflt_value: string | null;
        notnull: number;
      }>;
      const countryCol = cols.find((c) => c.name === "country");
      expect(countryCol).toBeDefined();
      expect(countryCol?.notnull).toBe(1);
      expect(countryCol?.dflt_value).toMatch(/'?US'?/);
    });
  });

  it("backfills US for any legacy projects row", () => {
    withTempDb(() => {
      const db = getDb();
      const row = db.prepare(`SELECT country FROM projects WHERE id = 'default'`).get() as { country: string };
      expect(row.country).toBe("US");
    });
  });
});

describe("projects CRUD with country", () => {
  it("createProject persists explicit country", () => {
    withTempDb(() => {
      const project = createProject({ name: "Altın TR", country: "TR" });
      expect(project.country).toBe("TR");
      const reloaded = getProjectById(project.id);
      expect(reloaded?.country).toBe("TR");
    });
  });

  it("createProject defaults to US when country omitted", () => {
    withTempDb(() => {
      const project = createProject({ name: "Default-ish" });
      expect(project.country).toBe("US");
    });
  });

  it("updateProject changes country", () => {
    withTempDb(() => {
      const project = createProject({ name: "Switch", country: "US" });
      const updated = updateProject(project.id, { country: "DE" });
      expect(updated?.country).toBe("DE");
    });
  });

  it("listProjectSummaries includes country", () => {
    withTempDb(() => {
      createProject({ name: "X-FR", country: "FR" });
      const summaries = listProjectSummaries();
      const fr = summaries.find((s) => s.name === "X-FR");
      expect(fr?.country).toBe("FR");
    });
  });
});
