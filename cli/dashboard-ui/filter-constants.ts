export type DashboardBrandFilter = "all" | "brand" | "non_brand";
export type DashboardFavoriteFilter = "all" | "favorite" | "non_favorite";

export type DashboardFilterState = {
  minPopularity: number;
  maxDifficulty: number;
  brand: DashboardBrandFilter;
  favorite: DashboardFavoriteFilter;
  minRank: number;
  maxRank: number;
};

const POPULARITY_MIN = 0;
const POPULARITY_MAX = 100;
const DIFFICULTY_MIN = 0;
const DIFFICULTY_MAX = 100;
const RANK_MIN = 0;
const RANK_MAX = 201;

export const DASHBOARD_FILTER_DEFAULTS: DashboardFilterState = {
  minPopularity: POPULARITY_MIN,
  maxDifficulty: DIFFICULTY_MAX,
  brand: "all",
  favorite: "all",
  minRank: RANK_MIN,
  maxRank: RANK_MAX,
};

export const DASHBOARD_FILTER_BOUNDS: Record<
  "minPopularity" | "maxDifficulty" | "minRank" | "maxRank",
  { min: number; max: number }
> = {
  minPopularity: { min: POPULARITY_MIN, max: POPULARITY_MAX },
  maxDifficulty: { min: DIFFICULTY_MIN, max: DIFFICULTY_MAX },
  minRank: { min: RANK_MIN, max: RANK_MAX },
  maxRank: { min: RANK_MIN, max: RANK_MAX },
};

export const DASHBOARD_FILTER_OPTIONS = {
  popularity: [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, POPULARITY_MAX],
  difficulty: [0, 5, 10, 20, 30, 40, 50, 70, DIFFICULTY_MAX],
  brand: ["all", "brand", "non_brand"] as const,
  favorite: ["all", "favorite", "non_favorite"] as const,
  rank: [0, 5, 10, 20, 30, 40, 50, 75, 100, 150, RANK_MAX - 1, RANK_MAX],
};

export const DASHBOARD_RANK_OPEN_ENDED_LABEL = `${RANK_MAX - 1}+`;
