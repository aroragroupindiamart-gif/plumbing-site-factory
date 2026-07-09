# Site Factory — launch checklist

Tooling to spin up additional niche-directory sites (same niche as
`plumbing-site-2`) reusing the same GitHub and Cloudflare accounts, without
a full manual/agent setup session per site.

See `TEMPLATE_CONTRACT.md` for what varies per site vs. what's shared.

## What's automated vs. manual

| Step | Automated? | How |
|---|---|---|
| Create the new GitHub repo | Yes | `site:create-repo` — generates from the `plumbing-site-2` template |
| Enable GitHub Actions on the new repo | Yes | `site:create-repo` |
| Set the new repo's deploy secrets (brand, phone, niche, Cloudflare creds) | Yes | `site:create-repo` |
| Trigger the first deploy | Yes, automatically | Repo generation pushes an initial commit, which triggers `deploy.yml` |
| Register the domain as a Cloudflare zone | Yes | `site:setup-domain` |
| **Update nameservers at the domain registrar** | **No — manual** | You do this once per domain, at whichever registrar you bought it from. Cloudflare gives you two nameserver values; the script prints them and waits for the zone to go active. |
| Bind the domain to the new site's Worker (Custom Domain + DNS) | Yes | `site:setup-domain`, once the zone is active |
| Generate unique sentence-level content + a per-site variant salt | Yes | `site:create-repo` — see `CONTENT_DIFFERENTIATION.md` |
| Record the site in the local registry (domain, repo, salt, zone id) | Yes | `site:create-repo` and `site:setup-domain` both write to `sites-registry.json` |

## One-time setup (do this once, not per site)

1. Make sure `GITHUB_PAT`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` are set (already configured for `plumbing-site-2`'s own deploys — reused as-is for every new site).
2. Add a second Cloudflare secret, `CLOUDFLARE_DNS_API_TOKEN`, scoped with: Account > Zone > Edit, Zone > DNS > Edit, Account > Workers Custom Domains > Edit. This is separate from `CLOUDFLARE_API_TOKEN` on purpose — that one stays deploy-only.

## Per-site steps

1. Copy `example-site-config.json` to a new file and fill in that site's `siteId`, `brandName`, `phoneNumber`, `phoneTel`, and `domain`. Leave the niche fields as-is unless the niche itself is changing.
2. `pnpm --filter @workspace/scripts run site:create-repo -- path/to/your-config.json`
3. Buy the domain and point its nameservers at whatever the Cloudflare dashboard/API assigns once you run the next step.
4. `pnpm --filter @workspace/scripts run site:setup-domain -- path/to/your-config.json`
5. Wait for the zone to go active (the script polls automatically) and for the GitHub Actions deploy triggered in step 2 to finish. The site is then live at `https://<domain>`.

## Finding a site later (once you have many)

Every site created via `site:create-repo` is recorded in `sites-registry.json`
(siteId, domain, repo URL, brand, niche, content salt, Cloudflare zone id).
To find which repo to edit for a given domain:

```
pnpm --filter @workspace/scripts run site:find -- example.com
pnpm --filter @workspace/scripts run site:find            # lists every registered site
```

## Not handled by this tooling (do separately)

- Upgrading the Cloudflare account to the Workers Paid plan once combined traffic approaches the free tier's request cap.
- Buying the domain itself.
- Fully eliminating duplicate-content SEO risk — `site:create-repo` generates unique sentence-level content per site (see `CONTENT_DIFFERENTIATION.md`), but page structure, dataset facts, and schema markup are still shared across sites by design.
