import { useEffect, useRef, useState } from "react";
import type { ProjectColor, ProjectSummary } from "../../shared/project-types";
import { cx } from "../ui-react/primitives";

type ProjectSelectorProps = {
  projects: ProjectSummary[];
  currentProject: ProjectSummary | null;
  onSelect: (projectId: string) => void;
  onCreate: () => void;
  onManage: () => void;
};

export function ProjectSelector({
  projects,
  currentProject,
  onSelect,
  onCreate,
  onManage,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!(event.target instanceof Node)) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = currentProject?.name ?? "Select project";
  const color: ProjectColor = currentProject?.color ?? "slate";

  return (
    <div className="project-selector" ref={rootRef}>
      <button
        type="button"
        className={cx("project-selector-trigger", open && "is-open")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className={cx("project-color-dot", `project-color-${color}`)}
          aria-hidden="true"
        />
        <span className="project-selector-name">{label}</span>
        <span className="project-selector-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="project-selector-dropdown" role="listbox">
          <div className="project-selector-list">
            {projects.map((project) => {
              const isActive = project.id === currentProject?.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={cx(
                    "project-selector-option",
                    isActive && "is-active"
                  )}
                  onClick={() => {
                    onSelect(project.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className={cx(
                      "project-color-dot",
                      `project-color-${project.color}`
                    )}
                    aria-hidden="true"
                  />
                  <span className="project-selector-option-name">
                    {project.name}
                  </span>
                  <span className="project-selector-option-meta">
                    {project.appCount} apps
                  </span>
                </button>
              );
            })}
          </div>
          <div className="project-selector-footer">
            <button
              type="button"
              className="project-selector-footer-action"
              onClick={() => {
                setOpen(false);
                onCreate();
              }}
            >
              + New project
            </button>
            <button
              type="button"
              className="project-selector-footer-action"
              onClick={() => {
                setOpen(false);
                onManage();
              }}
            >
              Manage projects…
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
