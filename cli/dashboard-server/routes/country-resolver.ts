import { getProjectCountry } from "../../db/projects";
import {
  assertSupportedCountry,
  normalizeCountry,
} from "../../domain/keywords/policy";

/**
 * Authoritatively resolve the country for a project request.
 *
 * Server-side resolution prevents a malicious/buggy client from sending
 * `country: "JP"` to bypass storefront restrictions — we read the project's
 * country from the DB and throw if it's not a supported storefront.
 */
export function resolveCountryForProject(projectId: string): string {
  const country = normalizeCountry(getProjectCountry(projectId));
  assertSupportedCountry(country);
  return country;
}
