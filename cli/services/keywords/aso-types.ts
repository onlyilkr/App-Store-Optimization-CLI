import type {
  FailedKeyword,
  FailedKeywordStage,
} from "../../shared/aso-keyword-types";
import type { AsoDifficultyState } from "../../shared/aso-difficulty-state";

export interface AsoAppDocItem {
  appId: string;
  country: string;
  name: string;
  subtitle?: string;
  averageUserRating: number;
  userRatingCount: number;
  releaseDate?: string | null;
  currentVersionReleaseDate?: string | null;
  icon?: Record<string, unknown>;
  iconArtwork?: { url?: string; [key: string]: unknown };
  additionalLocalizations?: Record<string, { name: string; subtitle?: string }>;
  expiresAt?: string;
}

export interface AsoKeywordItem {
  keyword: string;
  popularity: number;
  difficultyScore: number | null;
  difficultyState: AsoDifficultyState;
  appCount: number | null;
  orderedAppIds: string[];
  createdAt?: string;
  updatedAt?: string;
  orderExpiresAt: string;
  popularityExpiresAt: string;
  normalizedKeyword?: string;
  country?: string;
  appDocs?: AsoAppDocItem[];
}

export type { FailedKeyword, FailedKeywordStage };

export type FilteredKeywordReason = "low_popularity" | "high_difficulty";

export interface FilteredKeyword {
  keyword: string;
  reason: FilteredKeywordReason;
  popularity?: number;
  difficulty?: number;
}

export interface KeywordFetchResult {
  items: AsoKeywordItem[];
  failedKeywords: FailedKeyword[];
  filteredOut: FilteredKeyword[];
}

export interface AsoCacheLookupResponse {
  hits: AsoKeywordItem[];
  misses: string[];
}
