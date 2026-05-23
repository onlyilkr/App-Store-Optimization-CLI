import {
  getStorefrontConfig,
  isSupportedCountry,
  listSupportedCountries,
  SUPPORTED_COUNTRIES,
} from "./aso-storefronts";

describe("aso-storefronts", () => {
  it("returns US config by default", () => {
    const config = getStorefrontConfig("US");
    expect(config.storefrontId).toBe(143441);
    expect(config.appStoreUrlSegment).toBe("us");
    expect(config.acceptLanguage).toBe("en-US,en;q=0.9");
    expect(config.dslangCookie).toBe("US-EN");
  });

  it("normalizes lowercase input", () => {
    expect(getStorefrontConfig("us").storefrontId).toBe(143441);
  });

  it("throws on unknown country", () => {
    expect(() => getStorefrontConfig("ZZ")).toThrow(/Unsupported country/);
  });

  it("supports the canonical six countries", () => {
    expect(listSupportedCountries()).toEqual(["US", "TR", "DE", "GB", "FR", "IT"]);
  });

  it("isSupportedCountry is case-insensitive and rejects unknowns", () => {
    expect(isSupportedCountry("tr")).toBe(true);
    expect(isSupportedCountry("ZZ")).toBe(false);
  });

  it("each supported country has a unique storefront id", () => {
    const ids = SUPPORTED_COUNTRIES.map((c) => getStorefrontConfig(c).storefrontId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
