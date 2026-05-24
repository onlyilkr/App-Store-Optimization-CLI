import {
  getAppStoreDslangCookieHeader,
  getAppStoreUrlSegment,
  getStorefrontConfig,
  isSupportedCountry,
  SUPPORTED_COUNTRIES,
} from "./aso-storefronts";

describe("aso-storefronts", () => {
  it("returns US config", () => {
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

  it("exposes the canonical six countries in order", () => {
    expect([...SUPPORTED_COUNTRIES]).toEqual(["US", "TR", "DE", "GB", "FR", "IT"]);
  });

  it("isSupportedCountry is case-insensitive and rejects unknowns", () => {
    expect(isSupportedCountry("tr")).toBe(true);
    expect(isSupportedCountry("ZZ")).toBe(false);
  });

  it("each supported country has a unique storefront id and url segment", () => {
    const configs = SUPPORTED_COUNTRIES.map((c) => getStorefrontConfig(c));
    const ids = configs.map((c) => c.storefrontId);
    const segments = configs.map((c) => c.appStoreUrlSegment);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(segments).size).toBe(segments.length);
  });

  it("getAppStoreDslangCookieHeader returns the full Cookie header value", () => {
    expect(getAppStoreDslangCookieHeader("US")).toBe("dslang=US-EN");
    expect(getAppStoreDslangCookieHeader("TR")).toBe("dslang=TR-TR");
  });

  it("getAppStoreUrlSegment returns lowercase segment", () => {
    expect(getAppStoreUrlSegment("US")).toBe("us");
    expect(getAppStoreUrlSegment("de")).toBe("de");
  });
});
