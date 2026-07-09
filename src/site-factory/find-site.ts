/**
 * Looks up a launched site by domain or siteId in the local registry
 * (sites-registry.json). Use this before making a change to "one of the 100
 * sites" — it tells you which repo to open.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run site:find -- example.com
 *   pnpm --filter @workspace/scripts run site:find -- my-site-id
 *   pnpm --filter @workspace/scripts run site:find                 (lists all sites)
 */
import { findSite, loadRegistry } from "./site-registry.js";

function main() {
  const query = process.argv[2];

  if (!query) {
    const { sites } = loadRegistry();
    if (sites.length === 0) {
      console.log("No sites registered yet. Run site:create-repo to launch one.");
      return;
    }
    console.log(`${sites.length} site(s) registered:\n`);
    for (const s of sites) {
      console.log(`${s.siteId}  —  ${s.domain}  —  ${s.repoUrl}`);
    }
    return;
  }

  const site = findSite(query);
  if (!site) {
    console.error(`No site found matching "${query}". Run with no arguments to list all registered sites.`);
    process.exit(1);
  }

  console.log(JSON.stringify(site, null, 2));
}

main();
