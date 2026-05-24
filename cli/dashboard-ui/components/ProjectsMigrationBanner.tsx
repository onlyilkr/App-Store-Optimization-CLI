import { useEffect, useState } from "react";

const FIRST_SEEN_KEY = "aso-projects-banner-firstSeenAt";
const DISMISSED_KEY = "aso-projects-banner-dismissed";
const AUTO_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

export function ProjectsMigrationBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readStorage(DISMISSED_KEY) === "1") {
      setVisible(false);
      return;
    }
    let firstSeen = readStorage(FIRST_SEEN_KEY);
    if (!firstSeen) {
      firstSeen = new Date().toISOString();
      writeStorage(FIRST_SEEN_KEY, firstSeen);
    }
    const firstSeenMs = Date.parse(firstSeen);
    if (Number.isFinite(firstSeenMs) && Date.now() - firstSeenMs >= AUTO_DISMISS_MS) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="projects-migration-banner"
      role="status"
      aria-live="polite"
    >
      <span className="projects-migration-banner-body">
        Your apps are now grouped under a "Default" project. Create more from
        the sidebar header to keep unrelated apps separate.
      </span>
      <button
        type="button"
        className="projects-migration-banner-close"
        aria-label="Dismiss"
        onClick={() => {
          writeStorage(DISMISSED_KEY, "1");
          setVisible(false);
        }}
      >
        ×
      </button>
    </div>
  );
}
