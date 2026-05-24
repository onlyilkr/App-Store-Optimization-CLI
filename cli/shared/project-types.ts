import {
  isSupportedCountry,
  type SupportedCountry,
} from "./aso-storefronts";

export const DEFAULT_PROJECT_ID = "default";
export const DEFAULT_PROJECT_NAME = "Default";

export const PROJECT_COLORS = [
  "slate",
  "blue",
  "green",
  "amber",
  "red",
  "purple",
  "pink",
  "teal",
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number];

export const DEFAULT_PROJECT_COLOR: ProjectColor = "slate";

export type ProjectCountry = SupportedCountry;

export const DEFAULT_PROJECT_COUNTRY: ProjectCountry = "US";

export type Project = {
  id: string;
  name: string;
  color: ProjectColor;
  country: ProjectCountry;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSummary = Project & {
  appCount: number;
  keywordCount: number;
};

export type ProjectCreateRequest = {
  name: string;
  color?: ProjectColor;
  country?: ProjectCountry;
};

export type ProjectUpdateRequest = {
  name?: string;
  color?: ProjectColor;
  country?: ProjectCountry;
};

export const PROJECT_NAME_MIN_LENGTH = 1;
export const PROJECT_NAME_MAX_LENGTH = 60;
export const PROJECT_SLUG_MAX_LENGTH = 48;

export function isValidProjectColor(value: unknown): value is ProjectColor {
  return (
    typeof value === "string" &&
    (PROJECT_COLORS as readonly string[]).includes(value)
  );
}

export function isValidProjectCountry(value: unknown): value is ProjectCountry {
  return typeof value === "string" && isSupportedCountry(value);
}

export type ProjectNameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: "empty" | "too_long" };

export function validateProjectName(name: unknown): ProjectNameValidation {
  if (typeof name !== "string") return { ok: false, reason: "empty" };
  const trimmed = name.trim();
  if (trimmed.length < PROJECT_NAME_MIN_LENGTH) {
    return { ok: false, reason: "empty" };
  }
  if (trimmed.length > PROJECT_NAME_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, value: trimmed };
}

const TURKISH_DIACRITIC_MAP: Record<string, string> = {
  ı: "i",
  İ: "i",
  ş: "s",
  Ş: "s",
  ğ: "g",
  Ğ: "g",
  ü: "u",
  Ü: "u",
  ö: "o",
  Ö: "o",
  ç: "c",
  Ç: "c",
};

function normalizeDiacritics(input: string): string {
  let out = "";
  for (const ch of input) {
    out += TURKISH_DIACRITIC_MAP[ch] ?? ch;
  }
  return out.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function slugifyProjectName(name: string): string {
  const lowered = normalizeDiacritics(name).toLowerCase();
  const replaced = lowered.replace(/[^a-z0-9]+/g, "-");
  const trimmed = replaced.replace(/^-+|-+$/g, "");
  const truncated = trimmed.slice(0, PROJECT_SLUG_MAX_LENGTH).replace(/-+$/g, "");
  if (truncated.length === 0) return "project";
  return truncated;
}

export function ensureUniqueSlug(
  slug: string,
  existingIds: Iterable<string>
): string {
  const existing = new Set<string>();
  for (const id of existingIds) existing.add(id);
  if (!existing.has(slug)) return slug;
  let counter = 2;
  while (existing.has(`${slug}-${counter}`)) {
    counter += 1;
  }
  return `${slug}-${counter}`;
}
