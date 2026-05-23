import path from "path";
import fs from "fs";
import os from "os";
import { getDb, resetDbForTests } from "./store";

function withTempDb<T>(fn: () => T): T {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aso-db-test-"));
  process.env.ASO_DB_PATH = path.join(tmp, "test.sqlite");
  resetDbForTests();
  try {
    return fn();
  } finally {
    resetDbForTests();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ASO_DB_PATH;
  }
}

describe("projects.country migration", () => {
  it("creates the country column with US default on fresh DB", () => {
    withTempDb(() => {
      const db = getDb();
      const cols = db.prepare(`PRAGMA table_info(projects)`).all() as Array<{
        name: string;
        dflt_value: string | null;
        notnull: number;
      }>;
      const countryCol = cols.find((c) => c.name === "country");
      expect(countryCol).toBeDefined();
      expect(countryCol?.notnull).toBe(1);
      expect(countryCol?.dflt_value).toMatch(/'?US'?/);
    });
  });

  it("backfills US for any legacy projects row", () => {
    withTempDb(() => {
      const db = getDb();
      const row = db.prepare(`SELECT country FROM projects WHERE id = 'default'`).get() as { country: string };
      expect(row.country).toBe("US");
    });
  });
});
