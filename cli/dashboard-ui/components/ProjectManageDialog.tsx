import { useEffect, useState } from "react";
import { Button, Input } from "../ui-react";
import { cx } from "../ui-react/primitives";
import {
  PROJECT_COLORS,
  type ProjectColor,
  type ProjectSummary,
} from "../../shared/project-types";
import type { SupportedCountry } from "../../shared/aso-storefronts";
import { CountrySelector } from "./CountrySelector";

type ProjectManageDialogProps = {
  open: boolean;
  projects: ProjectSummary[];
  currentProjectId: string | null;
  onClose: () => void;
  onUpdate: (
    projectId: string,
    patch: { name?: string; color?: ProjectColor; country?: SupportedCountry }
  ) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
};

type PendingDelete = {
  projectId: string;
  name: string;
  appCount: number;
  keywordCount: number;
};

type PendingCountryChange = {
  projectId: string;
  name: string;
  fromCountry: SupportedCountry;
  toCountry: SupportedCountry;
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
  const [pendingCountryChange, setPendingCountryChange] =
    useState<PendingCountryChange | null>(null);
  const [errorText, setErrorText] = useState("");
  const [isBusy, setIsBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditing({});
      setPendingDelete(null);
      setPendingCountryChange(null);
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

  const requestCountryChange = (
    project: ProjectSummary,
    nextCountry: SupportedCountry
  ) => {
    if (nextCountry === project.country) return;
    // Schema is partitioned by (country, app_id, keyword). Changing a
    // project's country effectively orphans the existing keyword/rating
    // data under the old country until the user adds it back manually.
    // If the project is empty, no confirmation needed — nothing to orphan.
    if (project.appCount === 0 && project.keywordCount === 0) {
      void applyCountryChange(project.id, nextCountry);
      return;
    }
    setPendingCountryChange({
      projectId: project.id,
      name: project.name,
      fromCountry: project.country,
      toCountry: nextCountry,
      appCount: project.appCount,
      keywordCount: project.keywordCount,
    });
  };

  const applyCountryChange = async (
    projectId: string,
    country: SupportedCountry
  ) => {
    setIsBusy(projectId);
    setErrorText("");
    try {
      await onUpdate(projectId, { country });
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Failed to update country."
      );
    } finally {
      setIsBusy(null);
    }
  };

  const confirmCountryChange = async () => {
    if (!pendingCountryChange) return;
    const { projectId, toCountry } = pendingCountryChange;
    setPendingCountryChange(null);
    await applyCountryChange(projectId, toCountry);
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
              <CountrySelector
                id={`project-country-${project.id}`}
                value={project.country}
                onChange={(country) => requestCountryChange(project, country)}
                disabled={isBusy === project.id}
              />
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
        {pendingCountryChange ? (
          <div
            className="dialog-backdrop project-manage-confirm-backdrop"
            onClick={() => setPendingCountryChange(null)}
            role="presentation"
          >
            <section
              className="dialog-card ui-card project-dialog-card"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm country change"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="dialog-header">
                <h2>
                  Change "{pendingCountryChange.name}" from{" "}
                  {pendingCountryChange.fromCountry} to{" "}
                  {pendingCountryChange.toCountry}?
                </h2>
              </header>
              <p className="project-manage-confirm-body">
                Keyword and ranking data is stored per storefront. Switching
                this project to {pendingCountryChange.toCountry} hides the
                existing {pendingCountryChange.appCount}{" "}
                {pendingCountryChange.appCount === 1 ? "app" : "apps"} and{" "}
                {pendingCountryChange.keywordCount}{" "}
                {pendingCountryChange.keywordCount === 1
                  ? "keyword"
                  : "keywords"}{" "}
                under {pendingCountryChange.fromCountry} (they remain in the
                database but won't appear in this project until you switch
                back).
              </p>
              <div className="project-dialog-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingCountryChange(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isBusy === pendingCountryChange.projectId}
                  onClick={() => void confirmCountryChange()}
                >
                  {isBusy === pendingCountryChange.projectId
                    ? "Switching…"
                    : `Switch to ${pendingCountryChange.toCountry}`}
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
