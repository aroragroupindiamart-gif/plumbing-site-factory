/**
 * Binds pureplumbservices.com as a Custom Domain to the Cloudflare Worker.
 *
 * Usage:
 *   npx tsx ./src/site-factory/bind-domain.ts
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
  const token = requireEnv("CLOUDFLARE_API_TOKEN");
  const domain = "pureplumbservices.com";
  const workerName = "plumbing-site-3-anti-gravity";

  console.log(`Searching for Cloudflare Zone ID for "${domain}"...`);
  const zones = await cf(token, "GET", `/zones?name=${domain}&account.id=${accountId}`);
  if (zones.length === 0) {
    throw new Error(`Could not find a Zone for "${domain}" in your Cloudflare account. Make sure you have added the site to Cloudflare first.`);
  }

  const zoneId = zones[0].id;
  const zoneStatus = zones[0].status;
  console.log(`Found Zone ID: ${zoneId} (Status: ${zoneStatus})`);

  if (zoneStatus !== "active") {
    console.log(`Warning: The zone "${domain}" is currently "${zoneStatus}".`);
    console.log(`Please make sure you have pointed your domain registrar nameservers to Cloudflare:`);
    for (const ns of zones[0].name_servers || []) {
      console.log(`  - ${ns}`);
    }
  }

  // 1. Bind Apex Domain: pureplumbservices.com
  console.log(`Binding "${domain}" to Worker "${workerName}"...`);
  try {
    await cf(token, "PUT", `/accounts/${accountId}/workers/domains`, {
      zone_id: zoneId,
      hostname: domain,
      service: workerName,
      environment: "production",
    });
    console.log(`Successfully bound apex domain: "${domain}"`);
  } catch (err) {
    console.error(`Error binding apex domain: ${(err as Error).message}`);
  }

  // 2. Bind Subdomain: www.pureplumbservices.com
  const wwwDomain = `www.${domain}`;
  console.log(`Binding "${wwwDomain}" to Worker "${workerName}"...`);
  try {
    await cf(token, "PUT", `/accounts/${accountId}/workers/domains`, {
      zone_id: zoneId,
      hostname: wwwDomain,
      service: workerName,
      environment: "production",
    });
    console.log(`Successfully bound subdomain: "${wwwDomain}"`);
  } catch (err) {
    console.error(`Error binding subdomain: ${(err as Error).message}`);
  }

  console.log("\nSuccess: Custom domain bindings completed on Cloudflare!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
