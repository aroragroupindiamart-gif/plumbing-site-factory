/**
 * Registers a site's domain as a Cloudflare zone and binds it to that site's
 * Cloudflare Worker as a Custom Domain (Cloudflare then manages the DNS record
 * for it automatically — no manual DNS record needed).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run site:setup-domain -- path/to/site-config.json
 *
 * Requires env vars:
 *   CLOUDFLARE_ACCOUNT_ID     — reused as-is across all sites
 *   CLOUDFLARE_DNS_API_TOKEN  — a SEPARATE token from the deploy-only CLOUDFLARE_API_TOKEN.
 *                               Create it at dash.cloudflare.com/profile/api-tokens with:
 *                                 - Account > Zone > Edit   (to create the zone)
 *                                 - Zone > DNS > Edit       (to manage its DNS records)
 *                                 - Account > Workers Custom Domains > Edit
 *                               The existing CLOUDFLARE_API_TOKEN used by GitHub Actions
 *                               is deploy-only and does not have these permissions.
 *
 * The one step this script cannot do for you: after the zone is created, you
 * must update the domain's nameservers at whatever registrar you bought it
 * from to the two nameservers Cloudflare assigns (printed below). Cloudflare
 * can't do this for you, and neither can we — it requires access to the
 * registrar account.
 */
import { readFileSync } from "node:fs";
import type { SiteConfig } from "./types.js";
import { siteContentSalt } from "./types.js";
import { registryEntryFromConfig, upsertSiteEntry } from "./site-registry.js";

interface CloudflareResponse<T = unknown> {
  success: boolean;
  errors: unknown;
  result: T;
}

const CF_API = "https://api.cloudflare.com/client/v4";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function cf<T = any>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as CloudflareResponse<T>;
  if (!json.success) {
    throw new Error(`Cloudflare API ${method} ${path} failed: ${JSON.stringify(json.errors)}`);
  }
  return json.result;
}

async function findOrCreateZone(token: string, accountId: string, domain: string) {
  const existing = await cf(token, "GET", `/zones?name=${domain}&account.id=${accountId}`);
  if (existing.length > 0) {
    console.log(`Zone for ${domain} already exists.`);
    return existing[0];
  }
  console.log(`Creating zone for ${domain}...`);
  return cf(token, "POST", "/zones", { name: domain, account: { id: accountId } });
}

async function waitForZoneActive(token: string, zoneId: string, domain: string, maxAttempts = 20) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const zone = await cf(token, "GET", `/zones/${zoneId}`);
    if (zone.status === "active") {
      console.log(`Zone for ${domain} is active.`);
      return zone;
    }
    console.log(
      `Zone status: ${zone.status} (attempt ${attempt}/${maxAttempts}). ` +
        `Make sure nameservers are set to: ${zone.name_servers?.join(", ") ?? "(pending)"}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
  throw new Error(
    `Zone for ${domain} did not become active after ${maxAttempts} attempts. ` +
      "Nameservers may not be updated at the registrar yet — re-run this script once they are.",
  );
}

async function bindWorkerCustomDomain(token: string, accountId: string, zoneId: string, domain: string, workerName: string) {
  console.log(`Binding ${domain} to Worker "${workerName}" as a Custom Domain...`);
  return cf(token, "PUT", `/accounts/${accountId}/workers/domains`, {
    zone_id: zoneId,
    hostname: domain,
    service: workerName,
    environment: "production",
  });
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error("Usage: tsx setup-cloudflare-domain.ts <path-to-site-config.json>");
    process.exit(1);
  }

  const config: SiteConfig = JSON.parse(readFileSync(configPath, "utf-8"));
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const dnsToken = requireEnv("CLOUDFLARE_DNS_API_TOKEN");

  const zone = await findOrCreateZone(dnsToken, accountId, config.domain);

  if (zone.status !== "active") {
    console.log(`\nSet ${config.domain}'s nameservers at your registrar to:`);
    for (const ns of zone.name_servers ?? []) console.log(`  - ${ns}`);
    console.log("\nWaiting for the zone to become active (this can take a few minutes to a few hours)...");
  }

  const activeZone = zone.status === "active" ? zone : await waitForZoneActive(dnsToken, zone.id, config.domain);

  await bindWorkerCustomDomain(dnsToken, accountId, activeZone.id, config.domain, config.siteId);

  upsertSiteEntry({
    ...registryEntryFromConfig(config, siteContentSalt(config.siteId)),
    cloudflareZoneId: activeZone.id,
  });
  console.log(`Updated sites-registry.json with the Cloudflare zone id.`);

  console.log(`\nDone. https://${config.domain} will serve the "${config.siteId}" Worker once the deploy finishes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
