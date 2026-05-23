import { assertSupportedCountry } from "./policy";

describe("assertSupportedCountry", () => {
  it.each(["US", "TR", "DE", "GB", "FR", "IT"])("accepts %s", (code) => {
    expect(() => assertSupportedCountry(code)).not.toThrow();
  });

  it.each(["JP", "BR", "ZZ", ""])("rejects %s", (code) => {
    expect(() => assertSupportedCountry(code)).toThrow(/Unsupported country/);
  });

  it("normalizes case", () => {
    expect(() => assertSupportedCountry("tr")).not.toThrow();
  });
});
