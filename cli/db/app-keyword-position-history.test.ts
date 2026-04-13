import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  insertAppKeywordPositionHistoryPoints,
  listAppKeywordPositionHistory,
  pruneAppKeywordPositionHistoryBefore,
} from "./app-keyword-position-history";
import { closeDbForTests } from "./store";

const TEST_DB_PATH = path.join(
  os.tmpdir(),
  `aso-app-keyword-position-history-${process.pid}-${Date.now()}.sqlite`
);

function cleanDbFiles(): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${TEST_DB_PATH}${suffix}`);
    } catch {}
  }
}

describe("app-keyword-position-history", () => {
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

  it("stores normalized keyword history points in ascending capture order", () => {
    insertAppKeywordPositionHistoryPoints([
      {
        appId: "app-1",
        keyword: "  Mixed Term  ",
        country: "US",
        position: 11,
        capturedAt: "2026-04-10T00:00:00.000Z",
      },
      {
        appId: "app-1",
        keyword: "mixed term",
        country: "US",
        position: 7,
        capturedAt: "2026-04-11T00:00:00.000Z",
      },
    ]);

    expect(listAppKeywordPositionHistory("app-1", "MIXED TERM", "US")).toEqual([
      {
        appId: "app-1",
        keyword: "mixed term",
        country: "US",
        position: 11,
        capturedAt: "2026-04-10T00:00:00.000Z",
      },
      {
        appId: "app-1",
        keyword: "mixed term",
        country: "US",
        position: 7,
        capturedAt: "2026-04-11T00:00:00.000Z",
      },
    ]);
  });

  it("updates existing point for same app/keyword/country/capturedAt", () => {
    insertAppKeywordPositionHistoryPoints([
      {
        appId: "app-1",
        keyword: "term",
        country: "US",
        position: 12,
        capturedAt: "2026-04-10T00:00:00.000Z",
      },
    ]);
    insertAppKeywordPositionHistoryPoints([
      {
        appId: "app-1",
        keyword: "term",
        country: "US",
        position: 8,
        capturedAt: "2026-04-10T00:00:00.000Z",
      },
    ]);

    const rows = listAppKeywordPositionHistory("app-1", "term", "US");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.position).toBe(8);
  });

  it("omits null-position points from chart history reads", () => {
    insertAppKeywordPositionHistoryPoints([
      {
        appId: "app-1",
        keyword: "term",
        country: "US",
        position: null,
        capturedAt: "2026-04-10T00:00:00.000Z",
      },
      {
        appId: "app-1",
        keyword: "term",
        country: "US",
        position: 5,
        capturedAt: "2026-04-11T00:00:00.000Z",
      },
    ]);

    expect(listAppKeywordPositionHistory("app-1", "term", "US")).toEqual([
      {
        appId: "app-1",
        keyword: "term",
        country: "US",
        position: 5,
        capturedAt: "2026-04-11T00:00:00.000Z",
      },
    ]);
  });

  it("prunes points older than the provided cutoff", () => {
    insertAppKeywordPositionHistoryPoints([
      {
        appId: "app-1",
        keyword: "term",
        country: "US",
        position: 9,
        capturedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        appId: "app-1",
        keyword: "term",
        country: "US",
        position: 7,
        capturedAt: "2026-04-10T00:00:00.000Z",
      },
    ]);

    const removed = pruneAppKeywordPositionHistoryBefore("2026-04-05T00:00:00.000Z");
    expect(removed).toBe(1);
    expect(listAppKeywordPositionHistory("app-1", "term", "US")).toEqual([
      {
        appId: "app-1",
        keyword: "term",
        country: "US",
        position: 7,
        capturedAt: "2026-04-10T00:00:00.000Z",
      },
    ]);
  });
});
