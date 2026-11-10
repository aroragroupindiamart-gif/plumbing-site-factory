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
| `NEXT_PUBLIC_DRIP_COUNT` | GitHub Actions secret (optional) | Controls 30-day drip-feeding (e.g. `2` for initial 2 states rollout). |
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
- The rendering strategy: state + city pages are statically generated at build time; service pages render on demand via the Worker and are cached at the edge. Automated 30-day drip-feeding starts conservatively at 3 states (~8k-10k pages) in Week 1, expanding to 10 states in Week 2, 25 states in Week 3, and all 50 states in Week 4+.

## Cost/scale notes

- Keep generated repos **public** — GitHub Actions minutes are unlimited and free on public repos, uncapped even at 100 sites. Private repos only get 2,000 free minutes/month combined across the account.
- All Workers live in the same Cloudflare account and share its request quota. The free plan caps at 100,000 requests/day account-wide; once real traffic accumulates across multiple sites, move the account to the $5/month Workers Paid plan (10M requests/month included) rather than staying on Free.
- Because content (city/service data) is shared verbatim across every site, sites that only swap the brand name carry real duplicate-content SEO risk. `site:create-repo` now generates a unique sentence-level content pack + variant salt per site to mitigate this — see `CONTENT_DIFFERENTIATION.md` for the mechanism and its limits.

## Route 3 v3.2 Locked Architectural Standards (Permanent)

All new sites generated from `victor-moody-plumbing` must strictly inherit and preserve:
1. **Day 1 Footprint (46 URLs)**: Exactly 1 Homepage + 9 Authority Diagnostic Hubs & Cost Guide + 36 Wave-1 City Landing Pages (12 Audited AZ/CA Metros × 3 Core Services).
2. **Single Direct Sitemap**: `/sitemap.xml` directly returns all 46 URLs with `Cache-Control: public, max-age=0, must-revalidate`.
3. **Hub 301/308 Redirects**: `/cost-guide`, `/high-water-pressure`, `/backflow-preventer`, `/repipe`, `/cast-iron-pipe-replacement` cleanly redirect to canonical hubs.
4. **Strict State Clamping**: States with 0 dripped cities (e.g. `/ny`, `/tx`, `/il`, `/pa`) return true HTTP 404.
5. **Local Municipal Data Box**: Every city page displays $\ge 4$ verified local infrastructure points (Water District, GPG Hardness, PSI Code, Backflow Compliance Agency).
6. **Pre-Call Priming Block**: 3-point LeadSmart pre-qualification block active on all city/hub pages.
7. **User-Mandated Conversion Assets**: Star ratings (`★ 4.8`), review counts, 30–45 min dispatch timing, and flat-rate pricing claims must NEVER be removed or altered.
8. **Edge Cache**: Dynamic pages revalidate at 5 minutes (`revalidate = 300`).
9. **Per-Vertical DIDs**: `getDidForService()` binds to vertical DIDs with fallback to primary phone.
10. **Aged & Expired Domain Protocol**: All portfolio domains are aged assets with existing backlink profiles. Sites must preserve plumbing entity relevance, redirect top legacy backlink URLs (e.g. `/services`, `/about-us`) via 301/308 to relevant Authority Hubs to reclaim historical link juice, and maintain the 46 Day-1 URL cap to prevent triggering Google's Expired Domain Abuse filter.
