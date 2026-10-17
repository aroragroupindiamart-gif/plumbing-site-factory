import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const envContent = readFileSync(".env", "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  } catch (e) {}
}

loadEnv();

const GITHUB_API = "https://api.github.com";
const CF_API = "https://api.cloudflare.com/client/v4";

const OWNER = process.env.GITHUB_OWNER || "aroragroupindiamart-gif";
const GITHUB_PAT = process.env.GITHUB_PAT || "";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const CLOUDFLARE_DNS_API_TOKEN = process.env.CLOUDFLARE_DNS_API_TOKEN || "";

const SITES_BATCH_2 = [
  { domain: "plumbingrepairnews.com", siteId: "plumbing-repair-news" },
  { domain: "mjplumbings.com", siteId: "mj-plumbings" },
  { domain: "plumbersugarland.com", siteId: "plumber-sugarland" },
  { domain: "southpointplumbing.com", siteId: "south-point-plumbing" },
  { domain: "miltonplumbingllc.com", siteId: "milton-plumbing-llc" },
  { domain: "amplumbingrepair.com", siteId: "am-plumbing-repair" },
  { domain: "plumbingparamedicsc.com", siteId: "plumbing-paramedic-sc" },
  { domain: "charlestonplumbingservice.com", siteId: "charleston-plumbing-service" },
  { domain: "laplumbingsupplies.com", siteId: "la-plumbing-supplies" },
  { domain: "dupageplumbing.com", siteId: "dupage-plumbing" }
];

async function cfRequest<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_DNS_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as any;
  if (!data.success) {
    throw new Error(`Cloudflare ${method} ${path} failed: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}

async function checkGithubRuns(): Promise<boolean> {
  for (const s of SITES_BATCH_2) {
    const res = await fetch(`${GITHUB_API}/repos/${OWNER}/${s.siteId}/actions/runs?per_page=1`, {
      headers: { Authorization: `token ${GITHUB_PAT}`, "User-Agent": "Plumbing" }
    });
    const data = await res.json() as any;
    const run = data.workflow_runs?.[0];
    if (run?.status !== "completed") {
      console.log(`  Waiting for ${s.siteId} (current status: ${run?.status})...`);
      return false;
    }
  }
  return true;
}

async function main() {
  console.log("=== Waiting for all 10 Cloudflare Worker Deployments to Complete ===");
  while (true) {
    const allDone = await checkGithubRuns();
    if (allDone) {
      console.log("\nAll 10 Cloudflare Worker deployments completed successfully!");
      break;
    }
    await new Promise((r) => setTimeout(r, 8000));
  }

  console.log("\n=== Binding Custom Domains to Cloudflare Workers ===");

  for (let i = 0; i < SITES_BATCH_2.length; i++) {
    const { domain, siteId } = SITES_BATCH_2[i];
    console.log(`[${i + 1}/10] Binding ${domain} to Worker "${siteId}"...`);

    const zones = await cfRequest<any[]>("GET", `/zones?name=${domain}&account.id=${CLOUDFLARE_ACCOUNT_ID}`);
    if (!zones || zones.length === 0) {
      console.error(`  Zone not found for ${domain}`);
      continue;
    }
    const zoneId = zones[0].id;

    try {
      await cfRequest("PUT", `/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains`, {
        zone_id: zoneId,
        hostname: domain,
        service: siteId,
        environment: "production",
      });
      console.log(`  -> Successfully bound ${domain} to ${siteId}!`);
    } catch (err: any) {
      console.error(`  -> Binding error: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\n=== All 10 Domains Bound Successfully! ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
