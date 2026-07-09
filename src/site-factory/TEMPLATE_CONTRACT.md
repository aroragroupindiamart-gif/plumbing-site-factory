# Site Template Contract

This defines exactly what varies between niche-directory sites generated from
`plumbing-site-2`, and what stays identical. Nothing in this file changes how
the current live site behaves — it only documents the existing config surface
so it can be reused as a generation source.

## Per-site (varies, set via `SiteConfig` + GitHub Actions secrets)

| Field | Source | Notes |
|---|---|---|
| `siteId` | new, chosen per site | Used as GitHub repo name and Cloudflare Worker name (`wrangler.toml` `name` field is set at deploy time via the repo it lives in — each generated repo deploys its own independently-named Worker). |
| `NEXT_PUBLIC_BRAND_NAME` | GitHub Actions secret | Brand name shown across the site. |
| `NEXT_PUBLIC_PHONE_NUMBER` / `NEXT_PUBLIC_PHONE_TEL` | GitHub Actions secret | Display and `tel:` link phone numbers. |
| `NEXT_PUBLIC_SITE_URL` | GitHub Actions secret | `https://<domain>`, used for canonical URLs, sitemap, JSON-LD. |
| `NEXT_PUBLIC_NICHE` / `_PLURAL` / `_SINGULAR` / `NEXT_PUBLIC_SCHEMA_TYPE` | GitHub Actions secret | Only change these if the niche itself changes (e.g. "Plumbing" → "Electrical"). All 100 plumbing sites should keep these identical. |
| `NEXT_PUBLIC_GA_ID` / `NEXT_PUBLIC_ADSENSE_ID` / `NEXT_PUBLIC_GSC_TOKEN` | GitHub Actions secret (optional) | Per-site analytics/verification IDs. |
| `NEXT_PUBLIC_CONTENT_SALT` | GitHub Actions secret, auto-derived from `siteId` | Offsets which spintax variant each city/service page selects. See `CONTENT_DIFFERENTIATION.md`. |
| `lib/data/content-pack.json` | Committed per site by `site:create-repo` | AI-generated sentence-level templates unique to that site. See `CONTENT_DIFFERENTIATION.md`. |
| Domain + DNS + Worker Custom Domain binding | Cloudflare zone, created per site | See `setup-cloudflare-domain.ts`. |
| GitHub repo | Generated per site from the template | See `create-site-repo.ts`. |
| Registry entry (`sites-registry.json`) | Auto-written by `site:create-repo` and `site:setup-domain` | Lives in this monorepo, not in the generated site's own repo — it's the lookup index across all launched sites. See `README.md`. |

## Shared across every site (do not fork per site)

- All app code under `app/`, `components/`, `lib/` (except the config values above).
- `locations.json` (2,249 cities) and `services.json` (150 services) — the full dataset.
- The tiering logic that controls how many services each city gets.
- The deploy pipeline (`.github/workflows/deploy.yml`, `wrangler.toml`, `open-next.config.ts`).
- The rendering strategy: state + city pages are statically generated at build time; service pages render on demand via the Worker and are cached at the edge. This keeps CI build time and storage small regardless of how many sites you run.

## Cost/scale notes

- Keep generated repos **public** — GitHub Actions minutes are unlimited and free on public repos, uncapped even at 100 sites. Private repos only get 2,000 free minutes/month combined across the account.
- All Workers live in the same Cloudflare account and share its request quota. The free plan caps at 100,000 requests/day account-wide; once real traffic accumulates across multiple sites, move the account to the $5/month Workers Paid plan (10M requests/month included) rather than staying on Free.
- Because content (city/service data) is shared verbatim across every site, sites that only swap the brand name carry real duplicate-content SEO risk. `site:create-repo` now generates a unique sentence-level content pack + variant salt per site to mitigate this — see `CONTENT_DIFFERENTIATION.md` for the mechanism and its limits.
