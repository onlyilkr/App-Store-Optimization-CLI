import {
  ASO_STOREFRONT_LANGUAGES_BY_COUNTRY,
  getStorefrontAdditionalLanguages,
  getStorefrontDefaultLanguage,
  getStorefrontLanguageConfig,
  getStorefrontLanguages,
} from "./aso-storefront-localizations";

describe("aso storefront localizations", () => {
  afterEach(() => {
    delete ASO_STOREFRONT_LANGUAGES_BY_COUNTRY.CA;
  });

  it("supports storefront configs that only define default language", () => {
    ASO_STOREFRONT_LANGUAGES_BY_COUNTRY.CA = {
      defaultLanguage: "en-CA",
    };

    expect(getStorefrontLanguageConfig("CA")).toEqual({
      defaultLanguage: "en-CA",
      additionalLanguages: [],
    });
    expect(getStorefrontAdditionalLanguages("CA")).toEqual([]);
    expect(getStorefrontLanguages("CA")).toEqual(["en-CA"]);
  });
});

describe("aso-storefront-localizations", () => {
  it.each([
    ["US", "en-US"],
    ["TR", "tr"],
    ["DE", "de-DE"],
    ["GB", "en-GB"],
    ["FR", "fr-FR"],
    ["IT", "it"],
  ])("returns %s default language as %s", (country, expected) => {
    expect(getStorefrontDefaultLanguage(country)).toBe(expected);
  });

  it("TR additional languages include en-US for fallback discovery", () => {
    const additional = getStorefrontAdditionalLanguages("TR");
    expect(additional).toContain("en-US");
  });

  it("unknown country falls back to US default", () => {
    expect(getStorefrontDefaultLanguage("ZZ")).toBe("en-US");
  });
});
