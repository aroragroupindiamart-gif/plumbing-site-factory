/**
 * Automatically configures Cloudflare "Cache Everything" Page Rules
 * for all domains in the account to prevent Worker daily quota limits.
 *
 * Usage:
 *   npx tsx ./src/site-factory/configure-caching.ts
 */
import { readFileSync } from "node:fs";

// Basic dotenv-like parser
function loadEnv() {
  try {
    const envContent = readFileSync(".env", "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  } catch (e) {
    // Ignore
  }
}

loadEnv();

const CF_API = "https://api.cloudflare.com/client/v4";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function cf(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as any;
  if (!json.success) {
    throw new Error(`Cloudflare API ${method} ${path} failed: ${JSON.stringify(json.errors)}`);
  }
  return json.result;
}

async function main() {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const token = process.env.CLOUDFLARE_DNS_API_TOKEN || requireEnv("CLOUDFLARE_API_TOKEN");

  console.log("Fetching all active Cloudflare Zones under your account...");
  let page = 1;
  const zones: any[] = [];
  while (true) {
    const batch = await cf(token, "GET", `/zones?account.id=${accountId}&status=active&per_page=50&page=${page}`);
    if (!batch || batch.length === 0) break;
    zones.push(...batch);
    if (batch.length < 50) break;
    page++;
  }
  
  if (zones.length === 0) {
    console.log("No active zones found in your Cloudflare account.");
    return;
  }

  console.log(`Found ${zones.length} active zones:`);
  for (const zone of zones) {
    console.log(`  - ${zone.name} (ID: ${zone.id})`);
  }

  for (const zone of zones) {
    const domain = zone.name;
    const zoneId = zone.id;

    console.log(`\nConfiguring caching for "${domain}"...`);

    // 1. Fetch existing Page Rules
    const existingRules = await cf(token, "GET", `/zones/${zoneId}/pagerules`);
    const cacheRule = existingRules.find((rule: any) => 
      rule.actions.some((act: any) => act.id === "cache_level" && act.value === "cache_everything")
    );

    if (cacheRule) {
      console.log(`[Updating] "${domain}" existing 'Cache Everything' rule to 30-day Edge Cache TTL (2,592,000s)...`);
      try {
        await cf(token, "PUT", `/zones/${zoneId}/pagerules/${cacheRule.id}`, {
          targets: cacheRule.targets,
          actions: [
            { id: "cache_level", value: "cache_everything" },
            { id: "edge_cache_ttl", value: 2592000 } // 30 days
          ],
          status: "active"
        });
        console.log(`Successfully updated rule for "${domain}" to 30-day TTL!`);
      } catch (err) {
        console.error(`Failed to update page rule for "${domain}": ${(err as Error).message}`);
      }
      continue;
    }

    // 2. Check if we have room for another page rule (Free limit is 3 rules)
    if (existingRules.length >= 3) {
      console.log(`[Warning] "${domain}" already has ${existingRules.length} page rules. Free plans support a max of 3. Cannot add caching automatically.`);
      continue;
    }

    // 3. Create "Cache Everything" Page Rule
    // Targets: *domain.com/*
    // Actions: Cache Everything, Edge Cache TTL: 1 hour (3600 seconds)
    console.log(`Creating 'Cache Everything' page rule for *${domain}/* ...`);
    try {
      await cf(token, "POST", `/zones/${zoneId}/pagerules`, {
        targets: [
          {
            target: "url",
            constraint: {
              operator: "matches",
              value: `*${domain}/*`,
            },
          },
        ],
        actions: [
          {
            id: "cache_level",
            value: "cache_everything",
          },
          {
            id: "edge_cache_ttl",
            value: 2592000, // cache at edge for 30 days
          },
        ],
        status: "active",
      });
      console.log(`Successfully created Cache Everything rule for "${domain}"!`);
    } catch (err) {
      console.error(`Failed to create page rule for "${domain}": ${(err as Error).message}`);
    }
  }

  console.log("\nSuccess: Cloudflare caching rules configuration complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
