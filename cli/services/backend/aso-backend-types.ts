export type AsoBackendFeature = "difficulty" | "top_apps";

export type AsoBackendErrorCode = "PLAN_REQUIRED" | "ENTITLEMENT_UNAVAILABLE";

export type AsoBackendEntitlements = {
  difficultyView: boolean;
  topApps: boolean;
};

export type AsoBackendContext = {
  upgradeUrl: string | null;
  entitlements: AsoBackendEntitlements;
  fetchedAt: string;
};

export type DifficultyScorePayload = {
  keyword: string;
  country: string;
  popularity: number;
  appCount: number;
  orderedAppIds: string[];
  appDocs: Array<{
    appId: string;
    name: string;
    subtitle?: string;
    averageUserRating: number;
    userRatingCount: number;
    releaseDate?: string | null;
    currentVersionReleaseDate?: string | null;
    additionalLocalizations?: Record<string, { name: string; subtitle?: string }>;
  }>;
};

export type DifficultyScoreResult = {
  difficultyScore: number | null;
  difficultyState: "ready" | "paywalled";
  code?: AsoBackendErrorCode;
  message?: string;
  feature?: AsoBackendFeature;
  upgradeUrl?: string | null;
};
