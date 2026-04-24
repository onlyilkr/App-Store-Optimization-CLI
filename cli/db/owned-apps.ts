import { DEFAULT_ASO_COUNTRY, normalizeCountry } from "../domain/keywords/policy";
import type { OwnedAppKind, StoredOwnedApp } from "./types";
import { getDb } from "./store";
import { DEFAULT_PROJECT_ID } from "../shared/project-types";

type OwnedAppRow = {
  id: string;
  kind: string;
  name: string;
  icon_json: string | null;
  project_id: string;
  average_user_rating: number | null;
  user_rating_count: number | null;
  previous_average_user_rating: number | null;
  previous_user_rating_count: number | null;
  expires_at: string | null;
  last_fetched_at: string | null;
};

type OwnedAppCountryRatingRow = {
  average_user_rating: number | null;
  user_rating_count: number | null;
  previous_average_user_rating: number | null;
  previous_user_rating_count: number | null;
  expires_at: string | null;
  last_fetched_at: string | null;
};

function parseJsonObject(
  value: string | null
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}
  return undefined;
}

function toOwnedAppKind(value: string): OwnedAppKind {
  return value === "research" ? "research" : "owned";
}

function toStoredOwnedApp(row: OwnedAppRow): StoredOwnedApp {
  return {
    id: row.id,
    kind: toOwnedAppKind(row.kind),
    name: row.name,
    projectId: row.project_id ?? DEFAULT_PROJECT_ID,
    averageUserRating: row.average_user_rating,
    userRatingCount: row.user_rating_count,
    previousAverageUserRating: row.previous_average_user_rating,
    previousUserRatingCount: row.previous_user_rating_count,
    icon: parseJsonObject(row.icon_json),
    expiresAt: row.expires_at,
    lastFetchedAt: row.last_fetched_at,
  };
}

export function listOwnedApps(
  country: string = DEFAULT_ASO_COUNTRY,
  projectId?: string
): StoredOwnedApp[] {
  const db = getDb();
  const normalizedCountry = normalizeCountry(country);
  const params: unknown[] = [normalizedCountry];
  let whereClause = "";
  if (projectId) {
    whereClause = " WHERE app.project_id = ?";
    params.push(projectId);
  }
  const rows = db
    .prepare(
      `SELECT app.id, app.kind, app.name, app.icon_json, app.project_id,
              ratings.average_user_rating, ratings.user_rating_count,
              ratings.previous_average_user_rating, ratings.previous_user_rating_count,
              ratings.expires_at, ratings.last_fetched_at
       FROM owned_apps app
       LEFT JOIN owned_app_country_ratings ratings
         ON ratings.app_id = app.id
        AND ratings.country = ?${whereClause}
       ORDER BY app.name COLLATE NOCASE ASC`
    )
    .all(...params) as OwnedAppRow[];
  return rows.map(toStoredOwnedApp);
}

export function listOwnedAppIdsByKind(
  kind: OwnedAppKind,
  projectId?: string
): string[] {
  const db = getDb();
  const params: unknown[] = [kind];
  let whereClause = "";
  if (projectId) {
    whereClause = " AND project_id = ?";
    params.push(projectId);
  }
  const rows = db
    .prepare(
      `SELECT id
       FROM owned_apps
       WHERE kind = ?${whereClause}`
    )
    .all(...params) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

export function getOwnedAppById(
  id: string,
  country: string = DEFAULT_ASO_COUNTRY,
  projectId?: string
): StoredOwnedApp | null {
  const db = getDb();
  const normalizedCountry = normalizeCountry(country);
  const params: unknown[] = [normalizedCountry, id];
  let whereClause = "WHERE app.id = ?";
  if (projectId) {
    whereClause += " AND app.project_id = ?";
    params.push(projectId);
  }
  const row = db
    .prepare(
      `SELECT app.id, app.kind, app.name, app.icon_json, app.project_id,
              ratings.average_user_rating, ratings.user_rating_count,
              ratings.previous_average_user_rating, ratings.previous_user_rating_count,
              ratings.expires_at, ratings.last_fetched_at
       FROM owned_apps app
       LEFT JOIN owned_app_country_ratings ratings
         ON ratings.app_id = app.id
        AND ratings.country = ?
       ${whereClause}`
    )
    .get(...params) as OwnedAppRow | undefined;
  return row ? toStoredOwnedApp(row) : null;
}

export function getAppProjectId(id: string): string | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT project_id FROM owned_apps WHERE id = ?`)
    .get(id) as { project_id: string } | undefined;
  return row?.project_id ?? null;
}

export function moveAppToProject(
  id: string,
  projectId: string
): boolean {
  const db = getDb();
  const result = db
    .prepare(`UPDATE owned_apps SET project_id = ? WHERE id = ?`)
    .run(projectId, id);
  return result.changes > 0;
}

export function upsertOwnedApps(
  apps: Array<{
    id: string;
    kind: OwnedAppKind;
    name: string;
    projectId?: string;
  }>
): void {
  if (apps.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO owned_apps (id, kind, name, project_id)
     VALUES (@id, @kind, @name, @projectId)
     ON CONFLICT(id) DO UPDATE SET
       kind = excluded.kind,
       name = excluded.name`
  );

  const tx = db.transaction(() => {
    for (const app of apps) {
      stmt.run({
        id: app.id,
        kind: app.kind,
        name: app.name,
        projectId: app.projectId ?? DEFAULT_PROJECT_ID,
      });
    }
  });
  tx();
}

export function upsertOwnedAppSnapshots(
  country: string,
  apps: Array<{
    id: string;
    name?: string;
    projectId?: string;
    averageUserRating?: number | null;
    userRatingCount?: number | null;
    icon?: Record<string, unknown>;
    expiresAt?: string | null;
    fetchedAt?: string;
  }>
): void {
  if (apps.length === 0) return;
  const db = getDb();
  const normalizedCountry = normalizeCountry(country);
  const selectOwnedStmt = db.prepare(
    `SELECT id, kind, name, icon_json, project_id
     FROM owned_apps
     WHERE id = ?`
  );
  const selectRatingStmt = db.prepare(
    `SELECT average_user_rating, user_rating_count,
            previous_average_user_rating, previous_user_rating_count,
            expires_at, last_fetched_at
     FROM owned_app_country_ratings
     WHERE app_id = ? AND country = ?`
  );
  const upsertOwnedStmt = db.prepare(
    `INSERT INTO owned_apps (id, kind, name, icon_json, project_id)
     VALUES (@id, @kind, @name, @iconJson, @projectId)
     ON CONFLICT(id) DO UPDATE SET
       kind = excluded.kind,
       name = excluded.name,
       icon_json = excluded.icon_json`
  );
  const upsertRatingsStmt = db.prepare(
    `INSERT INTO owned_app_country_ratings (
      app_id, country,
      average_user_rating, user_rating_count,
      previous_average_user_rating, previous_user_rating_count,
      expires_at, last_fetched_at
    )
    VALUES (
      @appId, @country,
      @averageUserRating, @userRatingCount,
      @previousAverageUserRating, @previousUserRatingCount,
      @expiresAt, @lastFetchedAt
    )
    ON CONFLICT(app_id, country) DO UPDATE SET
      average_user_rating = excluded.average_user_rating,
      user_rating_count = excluded.user_rating_count,
      previous_average_user_rating = excluded.previous_average_user_rating,
      previous_user_rating_count = excluded.previous_user_rating_count,
      expires_at = excluded.expires_at,
      last_fetched_at = excluded.last_fetched_at`
  );

  const tx = db.transaction(() => {
    for (const app of apps) {
      const existingOwned = selectOwnedStmt.get(app.id) as
        | {
            id: string;
            kind: string;
            name: string;
            icon_json: string | null;
            project_id: string | null;
          }
        | undefined;
      const existingRating = selectRatingStmt.get(
        app.id,
        normalizedCountry
      ) as OwnedAppCountryRatingRow | undefined;
      const now = app.fetchedAt ?? new Date().toISOString();

      const nextAverage =
        app.averageUserRating != null
          ? app.averageUserRating
          : existingRating?.average_user_rating ?? null;
      const nextCount =
        app.userRatingCount != null
          ? app.userRatingCount
          : existingRating?.user_rating_count ?? null;

      const previousAverage =
        app.averageUserRating != null && existingRating?.average_user_rating != null
          ? existingRating.average_user_rating
          : existingRating?.previous_average_user_rating ?? null;
      const previousCount =
        app.userRatingCount != null && existingRating?.user_rating_count != null
          ? existingRating.user_rating_count
          : existingRating?.previous_user_rating_count ?? null;

      const kind = toOwnedAppKind(existingOwned?.kind ?? "owned");
      const nextName =
        app.name?.trim() || existingOwned?.name?.trim() || app.id;

      const icon =
        app.icon ?? parseJsonObject(existingOwned?.icon_json ?? null) ?? undefined;

      const projectId =
        app.projectId ??
        existingOwned?.project_id ??
        DEFAULT_PROJECT_ID;

      upsertOwnedStmt.run({
        id: app.id,
        kind,
        name: nextName,
        iconJson: icon ? JSON.stringify(icon) : null,
        projectId,
      });

      upsertRatingsStmt.run({
        appId: app.id,
        country: normalizedCountry,
        averageUserRating: nextAverage,
        userRatingCount: nextCount,
        previousAverageUserRating: previousAverage,
        previousUserRatingCount: previousCount,
        expiresAt: app.expiresAt ?? existingRating?.expires_at ?? null,
        lastFetchedAt: now,
      });
    }
  });

  tx();
}

export function deleteOwnedAppById(id: string): number {
  const db = getDb();
  const result = db
    .prepare(
      `DELETE FROM owned_apps
       WHERE id = ?`
    )
    .run(id);
  return result.changes;
}
