export const SUPPORTED_COUNTRIES = ["US", "TR", "DE", "GB", "FR", "IT"] as const;
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

export type StorefrontConfig = {
  country: SupportedCountry;
  storefrontId: number;
  appStoreUrlSegment: string;
  acceptLanguage: string;
  /**
   * Apple's `dslang` cookie value (region-language). Used in the
   * `Cookie: dslang=<value>` header for App Store HTML scraping.
   */
  dslangCookie: string;
};

// Apple App Store storefront identifiers. The storefront ID is the value Apple
// puts in the `X-Apple-Store-Front` HTTP header and the Search Ads
// `storefronts` request field. Apple does not publish this table officially;
// the canonical community reference is:
//   https://gist.github.com/daktak/f887352d564b54f9e529404cc0eb60d5
// Verified 2026-05 by issuing a `lookup?country=<cc>` against the iTunes API
// for each entry and confirming results returned localized content.
const CONFIGS: Record<SupportedCountry, StorefrontConfig> = {
  US: {
    country: "US",
    storefrontId: 143441,
    appStoreUrlSegment: "us",
    acceptLanguage: "en-US,en;q=0.9",
    dslangCookie: "US-EN",
  },
  TR: {
    country: "TR",
    storefrontId: 143480,
    appStoreUrlSegment: "tr",
    acceptLanguage: "tr-TR,tr;q=0.9,en;q=0.6",
    dslangCookie: "TR-TR",
  },
  DE: {
    country: "DE",
    storefrontId: 143443,
    appStoreUrlSegment: "de",
    acceptLanguage: "de-DE,de;q=0.9,en;q=0.6",
    dslangCookie: "DE-DE",
  },
  GB: {
    country: "GB",
    storefrontId: 143444,
    appStoreUrlSegment: "gb",
    acceptLanguage: "en-GB,en;q=0.9",
    dslangCookie: "GB-EN",
  },
  FR: {
    country: "FR",
    storefrontId: 143442,
    appStoreUrlSegment: "fr",
    acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.6",
    dslangCookie: "FR-FR",
  },
  IT: {
    country: "IT",
    storefrontId: 143450,
    appStoreUrlSegment: "it",
    acceptLanguage: "it-IT,it;q=0.9,en;q=0.6",
    dslangCookie: "IT-IT",
  },
};

export function isSupportedCountry(input: string): input is SupportedCountry {
  return (SUPPORTED_COUNTRIES as readonly string[]).includes(input.toUpperCase());
}

export function getStorefrontConfig(country: string): StorefrontConfig {
  const normalized = country.toUpperCase();
  if (!isSupportedCountry(normalized)) {
    throw new Error(`Unsupported country code: ${country}`);
  }
  return CONFIGS[normalized];
}

export function getAppStoreUrlSegment(country: string): string {
  return getStorefrontConfig(country).appStoreUrlSegment;
}

export function getAppStoreDslangCookieHeader(country: string): string {
  return `dslang=${getStorefrontConfig(country).dslangCookie}`;
}
