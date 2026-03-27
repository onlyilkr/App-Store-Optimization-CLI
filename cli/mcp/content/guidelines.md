## ASO MCP Guidelines

Use `aso_evaluate_keywords` to evaluate explicit ASO keyword candidates (US storefront only).

## Tool Input

- `keywords`: array of ASO search term candidates (single-word or long-tail phrases).
- `minPopularity` (optional): minimum popularity threshold.
- `maxDifficulty` (optional): maximum difficulty threshold.

## Behavior

- Keywords are normalized to lowercase, deduplicated, and invalid candidates are dropped.
- The tool runs `aso keywords <terms> --stdout --min-popularity ... --max-difficulty ...` under the hood.
- CLI `--stdout` contract is explicit:
  - success (`exitCode=0`): stdout JSON with `items`, `failedKeywords`, `filteredOut`
  - failure (`exitCode!=0`): stdout JSON error envelope with `error.code`, `error.message`, optional `error.help`
- MCP does not write directly to DB; keyword association is handled by the CLI command path.
- Output is a JSON array containing only accepted keywords with compact fields:
  - `keyword`
  - `popularity`
  - `difficulty` (nullable when difficulty is masked/paywalled)
- If difficulty entitlement is unavailable, difficulty-based filtering (`maxDifficulty`) is ignored for that run.

## Auth Requirement

If machine-safe execution fails because interactive Apple Search Ads auth is required, the user must run:

```bash
aso auth
```

Then retry `aso_evaluate_keywords`.
