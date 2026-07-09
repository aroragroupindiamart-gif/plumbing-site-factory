# Content Differentiation Strategy

Every site generated from `plumbing-site-2` shares the same city/service
dataset (`locations.json`, `services.json`) and the same page templates. Left
alone, that means every site would render byte-identical sentences for the
same city/service combination — a real duplicate-content SEO risk once
dozens of sites are live and competing for the same search results.

This document describes how content is varied per site, and the hard
constraint that makes it safe to do so without touching the current live
site's behavior.

## The mechanism

1. **Content pack** (`lib/data/content-pack.json`) — every sentence-level
   template (intro paragraphs, body paragraphs, trust bullets, FAQ answers)
   lives in this JSON file instead of being hardcoded in
   `app/[state]/[place]/[service]/page.tsx`. Templates use `{placeholder}`
   tokens (`{kw}`, `{cityName}`, `{brandName}`, etc.), rendered at build/request
   time via `lib/content.ts`'s `renderTemplate()`.

2. **Variant selection salt** (`NEXT_PUBLIC_CONTENT_SALT`, read via
   `lib/config.ts`) — `lib/spintax.ts`'s `selectVariant()` picks which
   template a given city/service page uses via a deterministic hash of
   `(locationId, serviceId, salt)`. Different sites use different salts, so
   even sites that shared the exact same content pack wouldn't pick the same
   variant for the same city/service pair.

3. **Per-site AI-generated content pack**
   (`scripts/src/site-factory/generate-content-pack.ts`) — when a new site is
   created via `site:create-repo`, this script calls an LLM to write a full
   replacement `content-pack.json` with genuinely different wording (not
   synonym-swapped) tailored to that site's brand/niche, then commits it into
   the new repo. This is the primary lever for real content diversity —
   the salt alone only reorders which of a *shared* set of sentences gets
   picked; the AI-generated pack changes the sentences themselves.

## Hard constraint: the live site never changes

The plumbing-directory template's own `lib/data/content-pack.json` must stay
**exactly** the same set of variants, in the same order, as before this
system existed (currently 4 intro variants, 4 body1, 4 body2, 3 trust-bullet
sets, 2 FAQ answer variants per question). Its `NEXT_PUBLIC_CONTENT_SALT`
must stay unset (defaults to `0`).

This matters because `selectVariant()`'s hash is `(locationId * 31 +
serviceId + salt * 97) % variants.length` — both `variants.length` and `salt`
are part of the hash. Changing either one changes which variant every
existing page on the live site renders, which counts as a runtime behavior
change and is out of scope for this tooling. **Never run
`generate-content-pack.ts` against the live plumbing-directory repo, and
never hand-edit its `content-pack.json` to add/remove/reorder entries.**

New sites don't have this constraint — their content pack and salt are
assigned once at creation time, so there's no "before" output to preserve.

## What `site:create-repo` does automatically

- Assigns each site a deterministic non-zero salt derived from its `siteId`
  (`siteContentSalt()` in `types.ts`) and sets it as the
  `NEXT_PUBLIC_CONTENT_SALT` repo secret.
- Calls `generateContentPack()` to produce a full new set of templates (at
  least 6 intro/body variants, 4 trust-bullet sets, 3 FAQ answer variants per
  question — more than the template's default 4/4/4/3/2, for extra diversity)
  and commits it to the new repo's `lib/data/content-pack.json`, overwriting
  the copy inherited from the template.
- If content pack generation fails (e.g. the LLM call errors, or GitHub's
  "generate from template" hasn't finished initializing the repo yet), the
  site still deploys with the template's default content pack + its unique
  salt, and the script prints a follow-up command to retry generation later:
  `pnpm --filter @workspace/scripts run site:generate-content-pack -- path/to/config.json`
  (pipe the output to `lib/data/content-pack.json` in the target repo and
  commit it manually, or re-run `site:create-repo`'s content-pack step).

## Residual duplicate-content risk

This reduces — it does not eliminate — duplicate-content risk:

- The underlying **facts** per page (city name, service name, star ratings,
  FAQ question wording) still come from the same shared dataset and JSON-LD
  structure across all sites. Only the marketing-copy sentences vary.
- Two sites could theoretically get very similar AI-generated packs if
  prompted with near-identical niche/brand inputs. Skim a new site's
  generated `content-pack.json` against a couple of existing ones before
  scaling to dozens of sites.
- This does not address other duplicate-content vectors like identical page
  structure/layout, identical schema.org markup shape, or identical site
  architecture — those remain a known tradeoff of the templated approach.
