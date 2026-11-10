# Plumbing Site Factory

Automated production factory for generating, provisioning, deploying, and managing portfolio-scale local service websites across the US.

---

## 🌟 Architecture & Engine Overview

### 1. Data-Driven Local Engineering Narrative Engine
* **Deep Local Granularity**: Renders dynamic, fact-based engineering content across 2,249 US cities using local housing eras (e.g. 1950s galvanized vs. 1980s copper vs. modern PEX), soil types, freeze-thaw cycles, and municipal water chemistry (pH & hardness metrics).
* **Guaranteed Content Differentiation**: Built-in AST-level n-gram boilerplate quality gates run during CI builds to guarantee **<30% shared content ceiling** (currently averaging **10.0%** across the entire portfolio).

### 2. 16-Week Progressive Crawl-Budget Drip Ramp
Prevents Googlebot queue saturation and algorithmic `"Discovered - currently not indexed"` dumping by matching natural domain authority accumulation:

| Phase | Days Elapsed | Active Metros | Active Services | Sitemap Indexable URLs | Strategy Focus |
|---|---|---|---|---|---|
| **Day 1** | **Day 0–1** | **60 Top Metros** | **10 Services** | **610 URLs** | Core emergency intent & tier-1 metros |
| **Weeks 1–2** | Days 2–14 | 60 $\rightarrow$ 100 Metros | 10 Services | **1,006 URLs** | Crawl trust establishment |
| **Weeks 3–4** | Days 15–28 | 100 $\rightarrow$ 250 Cities | 15 Services | **3,756 URLs** | Secondary metros & installations |
| **Weeks 5–6** | Days 29–42 | 250 $\rightarrow$ 500 Cities | 25 Services | **12,506 URLs** | Specialized diagnostic fixtures |
| **Weeks 7–8** | Days 43–56 | 500 $\rightarrow$ 800 Cities | 35 Services | **28,006 URLs** | Regional coverage |
| **Weeks 9–10** | Days 57–70 | 800 $\rightarrow$ 1,200 Cities | 50 Services | **60,006 URLs** | Suburbs & mid-tier townships |
| **Weeks 11–12** | Days 71–84 | 1,200 $\rightarrow$ 1,600 Cities | 75 Services | **120,006 URLs** | County-wide coverage |
| **Weeks 13–14** | Days 85–98 | 1,600 $\rightarrow$ 2,000 Cities | 100 Services | **200,006 URLs** | Long-tail rural clusters |
| **Weeks 15–16+** | Days 99–112+ | **All 2,249 Cities** | **All 150 Services** | **337,356 URLs** | Full national inventory |

### 3. Zero-404 Fallback Architecture
* **Historical Crawl Protection**: Even though the sitemap starts at 610 URLs on Day 1, **all 337,350 city-service combinations** remain active and return **`200 OK`** if crawled by Googlebot.
* **All 50 US State Hubs**: Automatically display top regional metros to ensure no state hub returns a 404.
* **All 9 Authority Diagnostic Hubs**: Actively indexed from Day 1 to anchor semantic topical authority.

---

## 🛠 Available Factory CLI Commands

Run these commands from the repository root:

```bash
# Provision a brand-new niche-directory repository from template
pnpm run site:create-repo -- path/to/site-config.json

# Attach Cloudflare Zone, DNS, and Edge SSL
pnpm run site:setup-domain -- path/to/site-config.json

# Upgrade an existing legacy repo to the data-driven narrative engine
pnpm run site:rebuild-single <repoName> <zoneId> [domain]

# Batch upgrade all registered sites
pnpm run site:rebuild-all

# Reset site crawl-budget schedule to Day 1 (610 sitemap URLs)
pnpm run site:reset-day1

# Automated live audit: check HTTP 200, GSC tokens, and sitemap counts
pnpm run site:verify-sitemaps
```

---

## 📁 Repository Structure

```
├── src/
│   ├── site-factory/
│   │   ├── create-site-repo.ts        # Provisions GitHub repo from template
│   │   ├── setup-cloudflare-domain.ts # Configures Cloudflare Zone and DNS
│   │   ├── rebuild_single_site.mjs    # Upgrades legacy sites to narrative engine
│   │   ├── process_all_sites.mjs      # Master multi-site rebuild orchestrator
│   │   ├── rollout_day1_reset.mjs     # Day 1 reset pipeline (610 URLs)
│   │   ├── verify_day1_sitemaps.mjs   # Automated live audit tool
│   │   ├── sites-registry.json        # Portfolio-wide master sites registry
│   │   └── rebuild_matched_sites.json # Active deployment targets
│   └── hello.ts
├── package.json
└── tsconfig.json
```
