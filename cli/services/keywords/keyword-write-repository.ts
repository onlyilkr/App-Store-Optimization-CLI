import { upsertCompetitorAppDocs } from "../../db/aso-apps";
import {
  deleteKeywordFailures,
  upsertKeywordFailures,
} from "../../db/aso-keyword-failures";
import { getKeywords, upsertKeywords } from "../../db/aso-keywords";
import {
  getAssociationsForKeyword,
  setPreviousPosition,
} from "../../db/app-keywords";
import {
  computeOrderExpiryIso,
  computePopularityExpiryIso,
  normalizeKeyword,
} from "../../shared/aso-keyword-utils";
import type { FailedKeyword } from "../../shared/aso-keyword-types";
import type { AsoDifficultyState } from "../../shared/aso-difficulty-state";

type KeywordWriteItem = {
  keyword: string;
  normalizedKeyword?: string;
  popularity: number;
  difficultyScore: number | null;
  difficultyState?: AsoDifficultyState;
  appCount: number | null;
  orderedAppIds: string[];
  createdAt?: string;
  updatedAt?: string;
  orderExpiresAt?: string;
  popularityExpiresAt?: string;
};

type CompetitorAppDoc = {
  appId: string;
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
};

export class KeywordWriteRepository {
  upsertKeywordItems(country: string, items: KeywordWriteItem[]): void {
    if (items.length === 0) return;

    const normalizedItems = items.map((item) => ({
      ...item,
      normalizedKeyword: item.normalizedKeyword ?? normalizeKeyword(item.keyword),
    }));
    const existingByNormalized = new Map(
      getKeywords(
        country,
        normalizedItems.map((item) => item.normalizedKeyword)
      ).map((keyword) => [keyword.normalizedKeyword, keyword] as const)
    );

    for (const item of normalizedItems) {
      const existing = existingByNormalized.get(item.normalizedKeyword);
      const orderedIds = existing?.orderedAppIds ?? [];
      if (orderedIds.length === 0) continue;

      const associations = getAssociationsForKeyword(item.keyword, country);
      for (const assoc of associations) {
        const idx = orderedIds.indexOf(assoc.appId);
        const position = idx >= 0 ? idx + 1 : 0;
        if (position > 0) {
          setPreviousPosition(item.keyword, country, assoc.appId, position);
        }
      }
    }

    upsertKeywords(
      country,
      normalizedItems.map((item) => ({
        keyword: item.keyword,
        normalizedKeyword: item.normalizedKeyword,
        popularity: item.popularity,
        difficultyScore: item.difficultyScore,
        difficultyState:
          item.difficultyState ??
          (item.difficultyScore == null ? "pending" : "ready"),
        appCount: item.appCount,
        orderedAppIds: item.orderedAppIds,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        orderExpiresAt: item.orderExpiresAt ?? computeOrderExpiryIso(),
        popularityExpiresAt:
          item.popularityExpiresAt ??
          existingByNormalized.get(item.normalizedKeyword)?.popularityExpiresAt ??
          computePopularityExpiryIso(),
      }))
    );
  }

  upsertPopularityOnly(
    country: string,
    items: Array<{ keyword: string; popularity: number }>
  ): void {
    if (items.length === 0) return;
    this.upsertKeywordItems(
      country,
      items.map((item) => ({
        keyword: item.keyword,
        normalizedKeyword: normalizeKeyword(item.keyword),
        popularity: item.popularity,
        difficultyScore: null,
        difficultyState: "pending",
        appCount: null,
        orderedAppIds: [],
        orderExpiresAt: computeOrderExpiryIso(),
        popularityExpiresAt: computePopularityExpiryIso(),
      }))
    );
  }

  persistFailures(country: string, failures: FailedKeyword[]): void {
    if (failures.length === 0) return;
    const failedKeywords = failures.map((failure) => failure.keyword);
    if (failedKeywords.length > 0) {
      const existingByKeyword = new Map(
        getKeywords(country, failedKeywords).map((keyword) => [
          keyword.normalizedKeyword,
          keyword,
        ])
      );
      const now = new Date().toISOString();
      const updates = failedKeywords.flatMap((keyword) => {
        const normalizedKeyword = normalizeKeyword(keyword);
        const existing = existingByKeyword.get(normalizedKeyword);
        if (!existing) return [];
        return [
          {
            keyword: existing.keyword,
            normalizedKeyword: existing.normalizedKeyword,
            popularity: existing.popularity,
            difficultyScore: existing.difficultyScore,
            difficultyState: "failed" as const,
            appCount: existing.appCount,
            orderedAppIds: existing.orderedAppIds,
            createdAt: existing.createdAt,
            updatedAt: now,
            orderExpiresAt: existing.orderExpiresAt,
            popularityExpiresAt: existing.popularityExpiresAt,
          },
        ];
      });
      this.upsertKeywordItems(country, updates);
    }
    upsertKeywordFailures(
      country,
      failures.map((failure) => ({
        keyword: failure.keyword,
        stage: failure.stage,
        reasonCode: failure.reasonCode,
        message: failure.message,
        statusCode: failure.statusCode,
        retryable: failure.retryable,
        attempts: failure.attempts,
        requestId: failure.requestId,
      }))
    );
  }

  clearFailures(country: string, keywords: string[]): void {
    if (keywords.length === 0) return;
    deleteKeywordFailures(country, keywords);
  }

  upsertCompetitorDocs(country: string, docs: CompetitorAppDoc[]): void {
    if (docs.length === 0) return;

    upsertCompetitorAppDocs(
      country,
      docs.map((doc) => ({
        appId: doc.appId,
        name: doc.name,
        subtitle: doc.subtitle,
        averageUserRating: doc.averageUserRating,
        userRatingCount: doc.userRatingCount,
        releaseDate: doc.releaseDate,
        currentVersionReleaseDate: doc.currentVersionReleaseDate,
        icon: doc.icon as Record<string, unknown> | undefined,
        iconArtwork: doc.iconArtwork,
        additionalLocalizations: doc.additionalLocalizations,
        expiresAt: doc.expiresAt,
      }))
    );
  }
}

export const keywordWriteRepository = new KeywordWriteRepository();
