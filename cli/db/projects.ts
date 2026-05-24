import { getDb } from "./store";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_COUNTRY,
  DEFAULT_PROJECT_ID,
  PROJECT_COLORS,
  ensureUniqueSlug,
  isValidProjectCountry,
  slugifyProjectName,
  validateProjectName,
  type Project,
  type ProjectColor,
  type ProjectCountry,
  type ProjectSummary,
} from "../shared/project-types";
import {
  DEFAULT_RESEARCH_APP_NAME,
  researchAppIdForProject,
} from "../shared/aso-research";

type ProjectRow = {
  id: string;
  name: string;
  color: string;
  country: string;
  created_at: string;
  updated_at: string;
};

function normalizeCountryForStorage(value: unknown): ProjectCountry {
  return isValidProjectCountry(value)
    ? (value.toUpperCase() as ProjectCountry)
    : DEFAULT_PROJECT_COUNTRY;
}

function toProject(row: ProjectRow): Project {
  const color = (PROJECT_COLORS as readonly string[]).includes(row.color)
    ? (row.color as ProjectColor)
    : DEFAULT_PROJECT_COLOR;
  return {
    id: row.id,
    name: row.name,
    color,
    country: normalizeCountryForStorage(row.country),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProjectError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ProjectError";
    this.code = code;
  }
}

export function listProjects(): Project[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, color, country, created_at, updated_at
       FROM projects
       ORDER BY created_at ASC, id ASC`
    )
    .all() as ProjectRow[];
  return rows.map(toProject);
}

export function listProjectSummaries(): ProjectSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         p.id,
         p.name,
         p.color,
         p.country,
         p.created_at,
         p.updated_at,
         (SELECT COUNT(*) FROM owned_app_project_memberships m
          INNER JOIN owned_apps oa ON oa.id = m.app_id
          WHERE m.project_id = p.id AND oa.kind = 'owned') AS app_count,
         (SELECT COUNT(*) FROM app_keywords ak
          INNER JOIN owned_app_project_memberships m2 ON m2.app_id = ak.app_id
          WHERE m2.project_id = p.id) AS keyword_count
       FROM projects p
       ORDER BY p.created_at ASC, p.id ASC`
    )
    .all() as Array<ProjectRow & { app_count: number; keyword_count: number }>;
  return rows.map((row) => ({
    ...toProject(row),
    appCount: Number(row.app_count ?? 0),
    keywordCount: Number(row.keyword_count ?? 0),
  }));
}

export function getProjectById(id: string): Project | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, color, country, created_at, updated_at
       FROM projects WHERE id = ?`
    )
    .get(id) as ProjectRow | undefined;
  return row ? toProject(row) : null;
}

export function getProjectByName(name: string): Project | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, color, country, created_at, updated_at
       FROM projects WHERE LOWER(name) = LOWER(?)`
    )
    .get(name.trim()) as ProjectRow | undefined;
  return row ? toProject(row) : null;
}

export function getProjectCounts(id: string): {
  appCount: number;
  keywordCount: number;
} {
  const db = getDb();
  const appRow = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM owned_app_project_memberships m
       INNER JOIN owned_apps oa ON oa.id = m.app_id
       WHERE m.project_id = ? AND oa.kind = 'owned'`
    )
    .get(id) as { n: number };
  const keywordRow = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM app_keywords ak
       INNER JOIN owned_app_project_memberships m ON m.app_id = ak.app_id
       WHERE m.project_id = ?`
    )
    .get(id) as { n: number };
  return {
    appCount: Number(appRow?.n ?? 0),
    keywordCount: Number(keywordRow?.n ?? 0),
  };
}

export function createProject(input: {
  name: string;
  color?: ProjectColor;
  country?: ProjectCountry;
}): Project {
  const validation = validateProjectName(input.name);
  if (!validation.ok) {
    throw new ProjectError(
      validation.reason === "empty" ? "INVALID_NAME" : "NAME_TOO_LONG",
      validation.reason === "empty"
        ? "Project name cannot be empty."
        : "Project name is too long."
    );
  }
  const name = validation.value;
  const existingByName = getProjectByName(name);
  if (existingByName) {
    throw new ProjectError(
      "DUPLICATE_NAME",
      `A project named "${name}" already exists.`
    );
  }
  const color: ProjectColor = input.color ?? DEFAULT_PROJECT_COLOR;
  const country = normalizeCountryForStorage(input.country);
  const desiredSlug = slugifyProjectName(name);
  const existing = listProjects().map((project) => project.id);
  const id = ensureUniqueSlug(desiredSlug, existing);
  const now = new Date().toISOString();
  const db = getDb();
  const researchAppId = researchAppIdForProject(id);
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO projects (id, name, color, country, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, color, country, now, now);
    db.prepare(
      `INSERT OR IGNORE INTO owned_apps (id, kind, name, icon_json, project_id)
       VALUES (?, 'research', ?, NULL, ?)`
    ).run(researchAppId, DEFAULT_RESEARCH_APP_NAME, id);
    db.prepare(
      `INSERT OR IGNORE INTO owned_app_project_memberships (app_id, project_id, added_at)
       VALUES (?, ?, ?)`
    ).run(researchAppId, id, now);
  });
  tx();
  const created = getProjectById(id);
  if (!created) {
    throw new ProjectError(
      "UNEXPECTED_ERROR",
      "Project was not created successfully."
    );
  }
  return created;
}

export function updateProject(
  id: string,
  patch: { name?: string; color?: ProjectColor; country?: ProjectCountry }
): Project | null {
  const existing = getProjectById(id);
  if (!existing) return null;
  const nextName = patch.name !== undefined ? patch.name : existing.name;
  const validation = validateProjectName(nextName);
  if (!validation.ok) {
    throw new ProjectError(
      validation.reason === "empty" ? "INVALID_NAME" : "NAME_TOO_LONG",
      validation.reason === "empty"
        ? "Project name cannot be empty."
        : "Project name is too long."
    );
  }
  const resolvedName = validation.value;
  if (resolvedName.toLowerCase() !== existing.name.toLowerCase()) {
    const conflict = getProjectByName(resolvedName);
    if (conflict && conflict.id !== id) {
      throw new ProjectError(
        "DUPLICATE_NAME",
        `A project named "${resolvedName}" already exists.`
      );
    }
  }
  const color = patch.color ?? existing.color;
  const country =
    patch.country !== undefined
      ? normalizeCountryForStorage(patch.country)
      : existing.country;
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `UPDATE projects
     SET name = ?, color = ?, country = ?, updated_at = ?
     WHERE id = ?`
  ).run(resolvedName, color, country, now, id);
  return getProjectById(id);
}

export function deleteProject(id: string): {
  deletedProjectId: string;
  deletedAppCount: number;
  deletedKeywordCount: number;
} | null {
  const existing = getProjectById(id);
  if (!existing) return null;
  const projects = listProjects();
  if (projects.length <= 1) {
    throw new ProjectError(
      "LAST_PROJECT",
      "Cannot delete the only remaining project."
    );
  }
  const counts = getProjectCounts(id);
  const db = getDb();
  const tx = db.transaction(() => {
    // Remove all memberships for this project
    const memberAppRows = db
      .prepare(
        `SELECT app_id FROM owned_app_project_memberships WHERE project_id = ?`
      )
      .all(id) as Array<{ app_id: string }>;
    db.prepare(
      `DELETE FROM owned_app_project_memberships WHERE project_id = ?`
    ).run(id);
    // For any app that is now orphaned (no remaining memberships), delete the
    // app and its keyword-related rows. Research apps are always orphaned on
    // project delete because they are pinned 1:1 to the project.
    for (const row of memberAppRows) {
      const remaining = db
        .prepare(
          `SELECT COUNT(*) AS n FROM owned_app_project_memberships WHERE app_id = ?`
        )
        .get(row.app_id) as { n: number };
      if ((remaining?.n ?? 0) === 0) {
        db.prepare(`DELETE FROM app_keywords WHERE app_id = ?`).run(row.app_id);
        db.prepare(
          `DELETE FROM app_keyword_position_history WHERE app_id = ?`
        ).run(row.app_id);
        db.prepare(`DELETE FROM owned_apps WHERE id = ?`).run(row.app_id);
      }
    }
    db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
  });
  tx();
  return {
    deletedProjectId: id,
    deletedAppCount: counts.appCount,
    deletedKeywordCount: counts.keywordCount,
  };
}

export function isDefaultProject(id: string): boolean {
  return id === DEFAULT_PROJECT_ID;
}

export function getProjectCountry(id: string): ProjectCountry {
  const project = getProjectById(id);
  return project?.country ?? DEFAULT_PROJECT_COUNTRY;
}

export function listDistinctProjectCountries(): ProjectCountry[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT DISTINCT country FROM projects`)
    .all() as Array<{ country: string }>;
  const seen = new Set<ProjectCountry>();
  for (const row of rows) {
    seen.add(normalizeCountryForStorage(row.country));
  }
  return Array.from(seen);
}
