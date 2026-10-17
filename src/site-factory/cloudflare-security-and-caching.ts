/**
 * Standard Cloudflare Caching & WAF Security Protocol for Plumbing Sites
 *
 * Automatically applies:
 * 1. Smart Tiered Cache ("on") - routes through Cloudflare's regional tier 1 data centers
 * 2. 30-Day "Cache Everything" Page Rule (2,592,000s) on *domain/* to prevent Worker invocations
 * 3. Edge WAF Geo-Block Rule - blocks non-US and non-IN traffic at edge while strictly allowing Googlebot & verified bots
 */

const CF_API = "https://api.cloudflare.com/client/v4";

async function cfRequest<T = any>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as { success: boolean; errors: unknown; result: T };
  if (!json.success) {
    throw new Error(`Cloudflare API ${method} ${path} failed: ${JSON.stringify(json.errors)}`);
  }
  return json.result;
}

/**
 * 1. Enables Smart Tiered Cache
 */
export async function enableSmartTieredCache(token: string, zoneId: string, domain: string): Promise<void> {
  console.log(`[Cache] Enabling Smart Tiered Cache for "${domain}"...`);
  try {
    await cfRequest(token, "PATCH", `/zones/${zoneId}/cache/tiered_cache`, { value: "on" });
    console.log(`[Cache] ✅ Smart Tiered Cache enabled for "${domain}".`);
  } catch (err) {
    console.warn(`[Cache] ⚠️ Could not enable Smart Tiered Cache for "${domain}": ${(err as Error).message}`);
  }
}

/**
 * 2. Ensures a 30-Day "Cache Everything" Page Rule exists for *domain/*
 */
export async function ensure30DayPageRule(token: string, zoneId: string, domain: string): Promise<void> {
  console.log(`[PageRule] Checking Page Rules for "${domain}"...`);
  try {
    const existingRules = await cfRequest<any[]>(token, "GET", `/zones/${zoneId}/pagerules`);
    const cacheRule = existingRules.find((rule: any) =>
      rule.actions.some((act: any) => act.id === "cache_level" && act.value === "cache_everything")
    );

    if (cacheRule) {
      console.log(`[PageRule] Updating existing 'Cache Everything' rule for "${domain}" to 30-day TTL...`);
      await cfRequest(token, "PUT", `/zones/${zoneId}/pagerules/${cacheRule.id}`, {
        targets: cacheRule.targets,
        actions: [
          { id: "cache_level", value: "cache_everything" },
          { id: "edge_cache_ttl", value: 2592000 }, // 30 days
        ],
        status: "active",
      });
      console.log(`[PageRule] ✅ Updated existing Cache Everything rule for "${domain}".`);
      return;
    }

    if (existingRules.length >= 3) {
      console.warn(`[PageRule] ⚠️ "${domain}" already has 3 page rules (free plan limit).`);
      return;
    }

    console.log(`[PageRule] Creating 30-Day 'Cache Everything' rule for "*${domain}/*"...`);
    await cfRequest(token, "POST", `/zones/${zoneId}/pagerules`, {
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
        { id: "cache_level", value: "cache_everything" },
        { id: "edge_cache_ttl", value: 2592000 }, // 30 days
      ],
      status: "active",
    });
    console.log(`[PageRule] ✅ 30-Day Cache Everything rule created for "${domain}".`);
  } catch (err) {
    console.warn(`[PageRule] ⚠️ Failed to configure Page Rule for "${domain}": ${(err as Error).message}`);
  }
}

/**
 * 3. Deploys Edge WAF Geo-Block Rule
 * Blocks all non-US and non-IN traffic, while strictly whitelisting verified search engine bots.
 */
export async function deployWafGeoBlockRule(token: string, zoneId: string, domain: string): Promise<void> {
  console.log(`[WAF] Deploying Edge Geo-Block rule for "${domain}"...`);
  try {
    const url = `/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`;
    const payload = {
      description: "Custom WAF Ruleset",
      rules: [
        {
          action: "block",
          description: "Block Non-US and Non-IN Except Verified Bots",
          expression: '(not ip.geoip.country in {"US" "IN"} and not cf.client.bot)',
          enabled: true,
        },
      ],
    };

    await cfRequest(token, "PUT", url, payload);
    console.log(`[WAF] ✅ Edge Geo-Block rule deployed for "${domain}" (US/IN allowed, verified bots allowed).`);
  } catch (err) {
    console.warn(`[WAF] ⚠️ Failed to deploy WAF rule for "${domain}": ${(err as Error).message}`);
  }
}

/**
 * Main helper: executes all 3 Cloudflare optimizations sequentially
 */
export async function applyFullCloudflareOptimizations(token: string, zoneId: string, domain: string): Promise<void> {
  console.log(`\n--- Applying Cloudflare Caching & WAF Protocols for "${domain}" ---`);
  await enableSmartTieredCache(token, zoneId, domain);
  await ensure30DayPageRule(token, zoneId, domain);
  await deployWafGeoBlockRule(token, zoneId, domain);
  console.log(`--- Finished Cloudflare Protocols for "${domain}" ---\n`);
}
