import { useEffect, useState } from "react";
import { Button, Input } from "../ui-react";
import { cx } from "../ui-react/primitives";
import {
  PROJECT_COLORS,
  type ProjectColor,
  type ProjectSummary,
} from "../../shared/project-types";

type ProjectManageDialogProps = {
  open: boolean;
  projects: ProjectSummary[];
  currentProjectId: string | null;
  onClose: () => void;
  onUpdate: (
    projectId: string,
    patch: { name?: string; color?: ProjectColor }
  ) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
};

type PendingDelete = {
  projectId: string;
  name: string;
  appCount: number;
  keywordCount: number;
};

export function ProjectManageDialog({
  open,
  projects,
  currentProjectId,
  onClose,
  onUpdate,
  onDelete,
}: ProjectManageDialogProps) {
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null
  );
  const [errorText, setErrorText] = useState("");
  const [isBusy, setIsBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditing({});
      setPendingDelete(null);
      setErrorText("");
      setIsBusy(null);
    }
  }, [open]);

  if (!open) return null;

  const applyRename = async (project: ProjectSummary) => {
    const nextName = (editing[project.id] ?? project.name).trim();
    if (!nextName || nextName === project.name) return;
    setIsBusy(project.id);
    setErrorText("");
    try {
      await onUpdate(project.id, { name: nextName });
      setEditing((current) => ({ ...current, [project.id]: nextName }));
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Failed to rename project."
      );
    } finally {
      setIsBusy(null);
    }
  };

  const applyColor = async (project: ProjectSummary, color: ProjectColor) => {
    setIsBusy(project.id);
    setErrorText("");
    try {
      await onUpdate(project.id, { color });
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Failed to update color."
      );
    } finally {
      setIsBusy(null);
    }
  };

  const requestDelete = (project: ProjectSummary) => {
    setPendingDelete({
      projectId: project.id,
      name: project.name,
      appCount: project.appCount,
      keywordCount: project.keywordCount,
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsBusy(pendingDelete.projectId);
    setErrorText("");
    try {
      await onDelete(pendingDelete.projectId);
      setPendingDelete(null);
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Failed to delete project."
      );
    } finally {
      setIsBusy(null);
    }
  };

  const canDelete = projects.length > 1;

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <section
        className="dialog-card ui-card project-dialog-card project-manage-card"
        role="dialog"
        aria-modal="true"
        aria-label="Manage projects"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <h2>Manage projects</h2>
          <button
            type="button"
            className="dialog-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {errorText ? (
          <p className="project-dialog-error">{errorText}</p>
        ) : null}
        <div className="project-manage-list">
          {projects.map((project) => (
            <div key={project.id} className="project-manage-row">
              <div className="project-manage-row-main">
                <span
                  className={cx(
                    "project-color-dot",
                    `project-color-${project.color}`
                  )}
                  aria-hidden="true"
                />
                <Input
                  type="text"
                  aria-label={`Rename ${project.name}`}
                  value={editing[project.id] ?? project.name}
                  onChange={(event) =>
                    setEditing((current) => ({
                      ...current,
                      [project.id]: event.target.value,
                    }))
                  }
                  onBlur={() => void applyRename(project)}
                />
                <span className="project-manage-row-meta">
                  {project.appCount} apps · {project.keywordCount} keywords
                  {project.id === currentProjectId ? " · active" : ""}
                </span>
              </div>
              <div className="project-manage-row-colors">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Set color ${color}`}
                    disabled={isBusy === project.id}
                    className={cx(
                      "project-color-swatch",
                      `project-color-${color}`,
                      project.color === color && "is-selected"
                    )}
                    onClick={() => void applyColor(project, color)}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canDelete || isBusy === project.id}
                onClick={() => requestDelete(project)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
        <div className="project-dialog-actions">
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
        {pendingDelete ? (
          <div
            className="dialog-backdrop project-manage-confirm-backdrop"
            onClick={() => setPendingDelete(null)}
            role="presentation"
          >
            <section
              className="dialog-card ui-card project-dialog-card"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm delete"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="dialog-header">
                <h2>Delete "{pendingDelete.name}"?</h2>
              </header>
              <p className="project-manage-confirm-body">
                This removes {pendingDelete.appCount} apps and{" "}
                {pendingDelete.keywordCount} keywords. This cannot be undone.
              </p>
              <div className="project-dialog-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isBusy === pendingDelete.projectId}
                  onClick={() => void confirmDelete()}
                >
                  {isBusy === pendingDelete.projectId
                    ? "Deleting…"
                    : "Delete project"}
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
