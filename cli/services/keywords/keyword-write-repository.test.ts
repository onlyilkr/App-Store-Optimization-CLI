import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getKeyword } from "../../db/aso-keywords";
import { listKeywordFailures } from "../../db/aso-keyword-failures";
import { closeDbForTests } from "../../db/store";
import { keywordWriteRepository } from "./keyword-write-repository";

const TEST_DB_PATH = path.join(
  os.tmpdir(),
  `aso-keyword-write-repository-${process.pid}-${Date.now()}.sqlite`
);

function cleanDbFiles(): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${TEST_DB_PATH}${suffix}`);
    } catch {}
  }
}

describe("keyword-write-repository", () => {
  beforeAll(() => {
    process.env.ASO_DB_PATH = TEST_DB_PATH;
  });

  beforeEach(() => {
    closeDbForTests();
    cleanDbFiles();
  });

  afterAll(() => {
    closeDbForTests();
    cleanDbFiles();
    delete process.env.ASO_DB_PATH;
  });

  it("persists popularity-only rows as pending", () => {
    keywordWriteRepository.upsertPopularityOnly("US", [
      { keyword: "pending-term", popularity: 18 },
    ]);

    const row = getKeyword("US", "pending-term");
    expect(row?.difficultyScore).toBeNull();
    expect(row?.difficultyState).toBe("pending");
  });

  it("persists explicit paywalled state distinctly from pending/failed", () => {
    keywordWriteRepository.upsertKeywordItems("US", [
      {
        keyword: "paywalled-term",
        popularity: 24,
        difficultyScore: null,
        difficultyState: "paywalled",
        appCount: 40,
        orderedAppIds: ["app-1"],
      },
    ]);

    const row = getKeyword("US", "paywalled-term");
    expect(row?.difficultyScore).toBeNull();
    expect(row?.difficultyState).toBe("paywalled");
  });

  it("marks existing keyword rows as failed when persisting failures", () => {
    keywordWriteRepository.upsertKeywordItems("US", [
      {
        keyword: "failed-term",
        popularity: 31,
        difficultyScore: 26,
        difficultyState: "ready",
        appCount: 80,
        orderedAppIds: ["app-1", "app-2"],
      },
    ]);

    keywordWriteRepository.persistFailures("US", [
      {
        keyword: "failed-term",
        stage: "enrichment",
        reasonCode: "PLAN_REQUIRED",
        message: "Difficulty scoring is not available for this plan.",
        statusCode: 402,
        retryable: false,
        attempts: 1,
      },
    ]);

    const row = getKeyword("US", "failed-term");
    const failures = listKeywordFailures("US");
    expect(row?.difficultyScore).toBe(26);
    expect(row?.difficultyState).toBe("failed");
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      keyword: "failed-term",
      reasonCode: "PLAN_REQUIRED",
    });
  });
});
