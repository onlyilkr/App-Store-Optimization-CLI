import {
  isSupportedCountry,
  SUPPORTED_COUNTRIES,
} from "../../shared/aso-storefronts";

export const DEFAULT_ASO_COUNTRY = "US" as const;

export function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}

export function sanitizeKeywords(input: string[]): string[] {
  const unique = new Set<string>();
  for (const keyword of input) {
    const normalized = normalizeKeyword(keyword);
    if (normalized) {
      unique.add(normalized);
    }
  }
  return Array.from(unique);
}

export function normalizeCountry(input: string | undefined | null): string {
  return (input ?? DEFAULT_ASO_COUNTRY).toUpperCase();
}

export function assertSupportedCountry(country: string): void {
  const normalized = normalizeCountry(country);
  if (!isSupportedCountry(normalized)) {
    throw new Error(
      `Unsupported country "${country}". Supported: ${[...SUPPORTED_COUNTRIES].join(", ")}`
    );
  }
}
