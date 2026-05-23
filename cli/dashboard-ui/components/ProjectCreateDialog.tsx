import { useEffect, useRef, useState } from "react";
import { Button, Input } from "../ui-react";
import { cx } from "../ui-react/primitives";
import {
  PROJECT_COLORS,
  PROJECT_NAME_MAX_LENGTH,
  type ProjectColor,
} from "../../shared/project-types";

type ProjectCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; color: ProjectColor }) => Promise<void>;
};

export function ProjectCreateDialog({
  open,
  onClose,
  onSubmit,
}: ProjectCreateDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<ProjectColor>("slate");
  const [isBusy, setIsBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setColor("slate");
      setErrorText("");
      setIsBusy(false);
      const handle = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(handle);
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !isBusy;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsBusy(true);
    setErrorText("");
    try {
      await onSubmit({ name: trimmed, color });
      onClose();
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Failed to create project."
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="dialog-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="dialog-card ui-card project-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-label="Create project"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <h2>Create project</h2>
          <button
            type="button"
            className="dialog-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <form className="project-dialog-form" onSubmit={handleSubmit}>
          <label className="project-dialog-label" htmlFor="project-name">
            Name
          </label>
          <Input
            id="project-name"
            ref={inputRef}
            type="text"
            placeholder="e.g. Halal Food Scanner"
            value={name}
            maxLength={PROJECT_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="project-dialog-color-label">Color</div>
          <div className="project-dialog-colors" role="radiogroup">
            {PROJECT_COLORS.map((presetColor) => (
              <button
                key={presetColor}
                type="button"
                role="radio"
                aria-checked={presetColor === color}
                className={cx(
                  "project-color-swatch",
                  `project-color-${presetColor}`,
                  presetColor === color && "is-selected"
                )}
                onClick={() => setColor(presetColor)}
                title={presetColor}
              />
            ))}
          </div>
          {errorText ? (
            <p className="project-dialog-error">{errorText}</p>
          ) : null}
          <div className="project-dialog-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!canSubmit}
            >
              {isBusy ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
