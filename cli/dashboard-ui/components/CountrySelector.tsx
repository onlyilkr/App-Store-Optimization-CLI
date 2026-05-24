import {
  SUPPORTED_COUNTRIES,
  type SupportedCountry,
} from "../../shared/aso-storefronts";

export const COUNTRY_FLAG: Record<SupportedCountry, string> = {
  US: "🇺🇸",
  TR: "🇹🇷",
  DE: "🇩🇪",
  GB: "🇬🇧",
  FR: "🇫🇷",
  IT: "🇮🇹",
};

export const COUNTRY_LABEL: Record<SupportedCountry, string> = {
  US: "United States",
  TR: "Türkiye",
  DE: "Deutschland",
  GB: "United Kingdom",
  FR: "France",
  IT: "Italia",
};

type CountrySelectorProps = {
  value: SupportedCountry;
  onChange: (country: SupportedCountry) => void;
  disabled?: boolean;
  id?: string;
};

export function CountrySelector({
  value,
  onChange,
  disabled,
  id,
}: CountrySelectorProps) {
  return (
    <select
      id={id}
      className="ui-input country-selector"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as SupportedCountry)}
      aria-label="Country / App Store storefront"
    >
      {SUPPORTED_COUNTRIES.map((code) => (
        <option key={code} value={code}>
          {COUNTRY_FLAG[code]} {code} — {COUNTRY_LABEL[code]}
        </option>
      ))}
    </select>
  );
}
