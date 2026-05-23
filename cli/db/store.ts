import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import { ASO_ENV } from "../shared/aso-env";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
} from "../shared/project-types";
import {
  RESEARCH_APP_ID,
  researchAppIdForProject,
} from "../shared/aso-research";

let db: Database.Database | null = null;

const SKIP_RESEARCH_RENAME_ENV = "ASO_PROJECTS_SKIP_RESEARCH_RENAME";

function ensureAppKeywordFavoriteColumn(database: Database.Database): void {
  const columns = database
    .prepare(`PRAGMA table_info(app_keywords)`)
    .all() as Array<{ name?: string }>;
  const hasFavoriteColumn = columns.some((column) => column.name === "is_favorite");
  if (!hasFavoriteColumn) {
    database.exec(
      `ALTER TABLE app_keywords
       ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`
    );
  }
}

function ensureProjectsTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      color TEXT NOT NULL DEFAULT '${DEFAULT_PROJECT_COLOR}',
      country TEXT NOT NULL DEFAULT 'US',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function ensureProjectsCountryColumn(database: Database.Database): void {
  const columns = database
    .prepare(`PRAGMA table_info(projects)`)
    .all() as Array<{ name?: string }>;
  const hasCountry = columns.some((c) => c.name === "country");
  if (!hasCountry) {
    database.exec(
      `ALTER TABLE projects ADD COLUMN country TEXT NOT NULL DEFAULT 'US'`
    );
  }
}

function ensureDefaultProjectRow(database: Database.Database): void {
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT OR IGNORE INTO projects (id, name, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      DEFAULT_PROJECT_ID,
      DEFAULT_PROJECT_NAME,
      DEFAULT_PROJECT_COLOR,
      now,
      now
    );
}

function ensureProjectIdColumnOnOwnedApps(database: Database.Database): void {
  const columns = database
    .prepare(`PRAGMA table_info(owned_apps)`)
    .all() as Array<{ name?: string }>;
  const hasProjectIdColumn = columns.some(
    (column) => column.name === "project_id"
  );
  if (!hasProjectIdColumn) {
    // SQLite does not allow ADD COLUMN with REFERENCES+NOT NULL default.
    // Referential integrity is enforced at the application layer in projects.ts
    // (deleteProject cascades owned_apps rows manually).
    database.exec(
      `ALTER TABLE owned_apps
         ADD COLUMN project_id TEXT NOT NULL DEFAULT '${DEFAULT_PROJECT_ID}'`
    );
  }
}

function ensureOwnedAppsProjectIndexes(database: Database.Database): void {
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_owned_apps_project
      ON owned_apps(project_id, kind);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_owned_apps_research_per_project
      ON owned_apps(project_id) WHERE kind = 'research';
  `);
}

function migrateLegacyResearchAppId(database: Database.Database): void {
  if (process.env[SKIP_RESEARCH_RENAME_ENV] === "1") return;
  const legacy = database
    .prepare(`SELECT id FROM owned_apps WHERE id = ?`)
    .get(RESEARCH_APP_ID) as { id: string } | undefined;
  if (!legacy) return;

  const targetId = researchAppIdForProject(DEFAULT_PROJECT_ID);
  const conflict = database
    .prepare(`SELECT id FROM owned_apps WHERE id = ?`)
    .get(targetId) as { id: string } | undefined;
  if (conflict) return;

  const fkPragma = database.pragma("foreign_keys", { simple: true });
  const wasFkOn =
    fkPragma === 1 || fkPragma === "1" || fkPragma === true;
  if (wasFkOn) {
    database.pragma("foreign_keys = OFF");
  }
  try {
    const tx = database.transaction(() => {
      database
        .prepare(`UPDATE app_keywords SET app_id = ? WHERE app_id = ?`)
        .run(targetId, RESEARCH_APP_ID);
      database
        .prepare(
          `UPDATE owned_app_country_ratings SET app_id = ? WHERE app_id = ?`
        )
        .run(targetId, RESEARCH_APP_ID);
      database
        .prepare(
          `UPDATE app_keyword_position_history SET app_id = ? WHERE app_id = ?`
        )
        .run(targetId, RESEARCH_APP_ID);
      database
        .prepare(
          `UPDATE owned_apps
             SET id = ?, project_id = ?
           WHERE id = ?`
        )
        .run(targetId, DEFAULT_PROJECT_ID, RESEARCH_APP_ID);
    });
    tx();
  } finally {
    if (wasFkOn) {
      database.pragma("foreign_keys = ON");
    }
  }
}

function initializeDatabase(database: Database.Database): void {
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS owned_apps (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('owned', 'research')),
      name TEXT NOT NULL,
      icon_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_owned_apps_kind
      ON owned_apps(kind);

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
    CREATE INDEX IF NOT EXISTS idx_owned_app_country_ratings_country
      ON owned_app_country_ratings(country);
    CREATE INDEX IF NOT EXISTS idx_owned_app_country_ratings_app
      ON owned_app_country_ratings(app_id);

    CREATE TABLE IF NOT EXISTS aso_keywords (
      country TEXT NOT NULL,
      normalized_keyword TEXT NOT NULL,
      keyword TEXT NOT NULL,
      popularity REAL NOT NULL,
      difficulty_score REAL,
      min_difficulty_score REAL,
      is_brand_keyword INTEGER,
      app_count INTEGER,
      keyword_match TEXT CHECK (keyword_match IN (
        'none',
        'titleExactPhrase',
        'titleAllWords',
        'subtitleExactPhrase',
        'combinedPhrase',
        'subtitleAllWords'
      )),
      ordered_app_ids TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      order_expires_at TEXT NOT NULL,
      popularity_expires_at TEXT NOT NULL,
      PRIMARY KEY (country, normalized_keyword)
    );
    CREATE INDEX IF NOT EXISTS idx_aso_keywords_country_order_expires
      ON aso_keywords(country, order_expires_at);

    CREATE TABLE IF NOT EXISTS aso_apps (
      country TEXT NOT NULL,
      app_id TEXT NOT NULL,
      name TEXT NOT NULL,
      subtitle TEXT,
      average_user_rating REAL NOT NULL,
      user_rating_count INTEGER NOT NULL,
      release_date TEXT,
      current_version_release_date TEXT,
      publisher_name TEXT,
      icon_json TEXT,
      icon_artwork_json TEXT,
      additional_localizations_json TEXT,
      expires_at TEXT,
      PRIMARY KEY (country, app_id)
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
    CREATE INDEX IF NOT EXISTS idx_app_keywords_country_app
      ON app_keywords(country, app_id);
    CREATE INDEX IF NOT EXISTS idx_app_keywords_country_keyword
      ON app_keywords(country, keyword);
    CREATE TABLE IF NOT EXISTS app_keyword_position_history (
      app_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      country TEXT NOT NULL,
      position INTEGER,
      captured_at TEXT NOT NULL,
      PRIMARY KEY (app_id, keyword, country, captured_at)
    );
    CREATE INDEX IF NOT EXISTS idx_app_keyword_position_history_lookup
      ON app_keyword_position_history(country, app_id, keyword, captured_at);

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS aso_keyword_failures (
      country TEXT NOT NULL,
      normalized_keyword TEXT NOT NULL,
      keyword TEXT NOT NULL,
      status TEXT NOT NULL,
      stage TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      message TEXT NOT NULL,
      status_code INTEGER,
      retryable INTEGER NOT NULL,
      attempts INTEGER NOT NULL,
      request_id TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (country, normalized_keyword)
    );
    CREATE INDEX IF NOT EXISTS idx_aso_keyword_failures_country_stage
      ON aso_keyword_failures(country, stage);
  `);
  ensureProjectsTable(database);
  ensureProjectsCountryColumn(database);
  ensureDefaultProjectRow(database);
  ensureProjectIdColumnOnOwnedApps(database);
  ensureOwnedAppsProjectIndexes(database);
  migrateLegacyResearchAppId(database);
  ensureAppKeywordFavoriteColumn(database);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_app_keywords_country_app_favorite
      ON app_keywords(country, app_id, is_favorite);
  `);
}

export function getDbPath(): string {
  return ASO_ENV.dbPath;
}

export function getDb(): Database.Database {
  if (db) {
    return db;
  }
  const dbPath = ASO_ENV.dbPath;
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = new Database(dbPath);
  initializeDatabase(db);
  return db;
}

export function closeDbForTests(): void {
  if (!db) return;
  db.close();
  db = null;
}

export function resetDbForTests(): void {
  if (db) {
    try {
      db.close();
    } catch {
      // already closed
    }
    db = null;
  }
}
