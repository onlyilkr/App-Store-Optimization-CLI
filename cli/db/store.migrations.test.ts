import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import Database from "better-sqlite3";
import { closeDbForTests, getDb } from "./store";
import { DEFAULT_PROJECT_ID } from "../shared/project-types";
import { researchAppIdForProject } from "../shared/aso-research";

function tempDbPath(suffix: string): string {
  return path.join(
    os.tmpdir(),
    `aso-store-migrations-${suffix}-${process.pid}-${Date.now()}.sqlite`
  );
}

function cleanDbFiles(dbPath: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {}
  }
}

function runDdl(raw: Database.Database, sql: string): void {
  raw.exec(sql);
}

function seedLegacySchema(dbPath: string): void {
  const raw = new Database(dbPath);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  runDdl(
    raw,
    `CREATE TABLE IF NOT EXISTS owned_apps (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('owned', 'research')),
      name TEXT NOT NULL,
      icon_json TEXT
    );
    CREATE TABLE IF NOT EXISTS owned_app_country_ratings (
      app_id TEXT NOT NULL,
      country TEXT NOT NULL,
      average_user_rating REAL,
      user_rating_count INTEGER,
      previous_average_user_rating REAL,
      previous_user_rating_count INTEGER,
      expires_at TEXT,
      last_fetched_at TEXT,
      PRIMARY KEY (app_id, country),
      FOREIGN KEY (app_id) REFERENCES owned_apps(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS app_keywords (
      app_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      country TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      previous_position INTEGER,
      added_at TEXT,
      PRIMARY KEY (app_id, keyword, country)
    );
    CREATE TABLE IF NOT EXISTS app_keyword_position_history (
      app_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      country TEXT NOT NULL,
      position INTEGER,
      captured_at TEXT NOT NULL,
      PRIMARY KEY (app_id, keyword, country, captured_at)
    );
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`
  );
  raw.prepare(
    `INSERT INTO owned_apps (id, kind, name) VALUES (?, 'research', 'Research')`
  ).run("research");
  raw.prepare(
    `INSERT INTO owned_apps (id, kind, name) VALUES (?, 'owned', 'App One')`
  ).run("111");
  raw.prepare(
    `INSERT INTO app_keywords (app_id, keyword, country, is_favorite, previous_position, added_at)
     VALUES (?, ?, ?, 0, NULL, ?)`
  ).run("research", "halal", "US", new Date().toISOString());
  raw.prepare(
    `INSERT INTO app_keywords (app_id, keyword, country, is_favorite, previous_position, added_at)
     VALUES (?, ?, ?, 0, NULL, ?)`
  ).run("111", "scanner", "US", new Date().toISOString());
  raw.prepare(
    `INSERT INTO app_keyword_position_history (app_id, keyword, country, position, captured_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run("research", "halal", "US", 7, new Date().toISOString());
  raw.close();
}

describe("store migration", () => {
  const dbPath = tempDbPath("legacy");

  afterEach(() => {
    closeDbForTests();
    cleanDbFiles(dbPath);
    delete process.env.ASO_DB_PATH;
  });

  it("creates projects table + default project and renames legacy research app", () => {
    seedLegacySchema(dbPath);
    process.env.ASO_DB_PATH = dbPath;

    const db = getDb();
    const projects = db.prepare(`SELECT id, name FROM projects`).all() as Array<{
      id: string;
      name: string;
    }>;
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(DEFAULT_PROJECT_ID);

    const legacyRow = db
      .prepare(`SELECT id FROM owned_apps WHERE id = 'research'`)
      .get();
    expect(legacyRow).toBeUndefined();

    const targetResearchId = researchAppIdForProject(DEFAULT_PROJECT_ID);
    const renamed = db
      .prepare(`SELECT id, project_id, kind FROM owned_apps WHERE id = ?`)
      .get(targetResearchId) as
      | { id: string; project_id: string; kind: string }
      | undefined;
    expect(renamed).toBeDefined();
    expect(renamed?.project_id).toBe(DEFAULT_PROJECT_ID);
    expect(renamed?.kind).toBe("research");

    const ownedAppRow = db
      .prepare(`SELECT project_id FROM owned_apps WHERE id = '111'`)
      .get() as { project_id: string } | undefined;
    expect(ownedAppRow?.project_id).toBe(DEFAULT_PROJECT_ID);

    const keywordRow = db
      .prepare(
        `SELECT app_id FROM app_keywords WHERE keyword = 'halal' AND country = 'US'`
      )
      .get() as { app_id: string } | undefined;
    expect(keywordRow?.app_id).toBe(targetResearchId);

    const historyRow = db
      .prepare(
        `SELECT app_id FROM app_keyword_position_history WHERE keyword = 'halal'`
      )
      .get() as { app_id: string } | undefined;
    expect(historyRow?.app_id).toBe(targetResearchId);
  });

  it("is idempotent when run twice", () => {
    seedLegacySchema(dbPath);
    process.env.ASO_DB_PATH = dbPath;

    getDb();
    closeDbForTests();
    expect(() => getDb()).not.toThrow();

    const db = getDb();
    const projectCount = db
      .prepare(`SELECT COUNT(*) as n FROM projects`)
      .get() as { n: number };
    expect(projectCount.n).toBe(1);

    const ownedCount = db
      .prepare(`SELECT COUNT(*) as n FROM owned_apps`)
      .get() as { n: number };
    expect(ownedCount.n).toBe(2);
  });

  it("skips rename when ASO_PROJECTS_SKIP_RESEARCH_RENAME=1", () => {
    seedLegacySchema(dbPath);
    process.env.ASO_DB_PATH = dbPath;
    process.env.ASO_PROJECTS_SKIP_RESEARCH_RENAME = "1";

    const db = getDb();
    const legacyRow = db
      .prepare(`SELECT id FROM owned_apps WHERE id = 'research'`)
      .get();
    expect(legacyRow).toBeDefined();

    delete process.env.ASO_PROJECTS_SKIP_RESEARCH_RENAME;
  });

  it("initializes a fresh database cleanly", () => {
    process.env.ASO_DB_PATH = dbPath;
    cleanDbFiles(dbPath);

    const db = getDb();
    const projectRow = db
      .prepare(`SELECT id, name, color FROM projects WHERE id = ?`)
      .get(DEFAULT_PROJECT_ID) as
      | { id: string; name: string; color: string }
      | undefined;
    expect(projectRow?.id).toBe(DEFAULT_PROJECT_ID);
    expect(projectRow?.name).toBe("Default");
    expect(projectRow?.color).toBe("slate");

    const columns = db
      .prepare(`PRAGMA table_info(owned_apps)`)
      .all() as Array<{ name: string }>;
    const projectIdColumn = columns.find(
      (column) => column.name === "project_id"
    );
    expect(projectIdColumn).toBeDefined();
  });
});
