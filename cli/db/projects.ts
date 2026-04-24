import { getDb } from "./store";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ID,
  PROJECT_COLORS,
  ensureUniqueSlug,
  slugifyProjectName,
  validateProjectName,
  type Project,
  type ProjectColor,
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
  created_at: string;
  updated_at: string;
};

function toProject(row: ProjectRow): Project {
  const color = (PROJECT_COLORS as readonly string[]).includes(row.color)
    ? (row.color as ProjectColor)
    : DEFAULT_PROJECT_COLOR;
  return {
    id: row.id,
    name: row.name,
    color,
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
      `SELECT id, name, color, created_at, updated_at
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
         p.created_at,
         p.updated_at,
         (SELECT COUNT(*) FROM owned_apps oa
          WHERE oa.project_id = p.id AND oa.kind = 'owned') AS app_count,
         (SELECT COUNT(*) FROM app_keywords ak
          JOIN owned_apps oa2 ON oa2.id = ak.app_id
          WHERE oa2.project_id = p.id) AS keyword_count
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
      `SELECT id, name, color, created_at, updated_at
       FROM projects WHERE id = ?`
    )
    .get(id) as ProjectRow | undefined;
  return row ? toProject(row) : null;
}

export function getProjectByName(name: string): Project | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, color, created_at, updated_at
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
      `SELECT COUNT(*) AS n FROM owned_apps WHERE project_id = ? AND kind = 'owned'`
    )
    .get(id) as { n: number };
  const keywordRow = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM app_keywords ak
       JOIN owned_apps oa ON oa.id = ak.app_id
       WHERE oa.project_id = ?`
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
  const desiredSlug = slugifyProjectName(name);
  const existing = listProjects().map((project) => project.id);
  const id = ensureUniqueSlug(desiredSlug, existing);
  const now = new Date().toISOString();
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO projects (id, name, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, name, color, now, now);
    db.prepare(
      `INSERT OR IGNORE INTO owned_apps (id, kind, name, icon_json, project_id)
       VALUES (?, 'research', ?, NULL, ?)`
    ).run(researchAppIdForProject(id), DEFAULT_RESEARCH_APP_NAME, id);
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
  patch: { name?: string; color?: ProjectColor }
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
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `UPDATE projects
     SET name = ?, color = ?, updated_at = ?
     WHERE id = ?`
  ).run(resolvedName, color, now, id);
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
    const appIdRows = db
      .prepare(`SELECT id FROM owned_apps WHERE project_id = ?`)
      .all(id) as Array<{ id: string }>;
    for (const row of appIdRows) {
      db.prepare(`DELETE FROM app_keywords WHERE app_id = ?`).run(row.id);
      db.prepare(
        `DELETE FROM app_keyword_position_history WHERE app_id = ?`
      ).run(row.id);
      db.prepare(`DELETE FROM owned_apps WHERE id = ?`).run(row.id);
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
