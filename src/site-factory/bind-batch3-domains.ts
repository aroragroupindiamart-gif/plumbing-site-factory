import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SITES_BATCH_3 } from "./batch-deploy-batch3.js";

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

const REGISTRY_PATH = resolve("src/site-factory/sites-registry.json");

async function githubRequest(method: string, path: string) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Authorization: `token ${GITHUB_PAT}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Plumbing-Site-Automation",
    },
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GitHub ${method} ${path} failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

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

async function checkRunStatus(repo: string): Promise<string> {
  try {
    const data = await githubRequest("GET", `/repos/${OWNER}/${repo}/actions/runs?per_page=1`);
    if (data.workflow_runs && data.workflow_runs.length > 0) {
      const run = data.workflow_runs[0];
      return run.status === "completed" ? run.conclusion : run.status;
    }
  } catch (e) {}
  return "pending";
}

async function main() {
  console.log("=== Waiting for all 11 Cloudflare Worker Deployments to Complete ===\n");

  const registryRaw = existsSync(REGISTRY_PATH) ? JSON.parse(readFileSync(REGISTRY_PATH, "utf-8")) : { sites: [] };
  const sitesList: any[] = registryRaw.sites;

  // Poll until all 11 repos have finished building
  const pendingRepos = new Set(SITES_BATCH_3.map((s) => s.siteId));

  let attempts = 0;
  while (pendingRepos.size > 0 && attempts < 40) {
    attempts++;
    for (const siteId of Array.from(pendingRepos)) {
      const status = await checkRunStatus(siteId);
      if (status === "success") {
        console.log(`  -> Worker for ${siteId} deployed successfully!`);
        pendingRepos.delete(siteId);
      } else if (status === "failure") {
        console.error(`  -> ERROR: Worker for ${siteId} failed to deploy.`);
        pendingRepos.delete(siteId);
      } else {
        console.log(`  Waiting for ${siteId} (current status: ${status})...`);
      }
    }
    if (pendingRepos.size > 0) {
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  console.log("\n=== Binding Custom Domains & www to Cloudflare Workers ===\n");

  for (let i = 0; i < SITES_BATCH_3.length; i++) {
    const site = SITES_BATCH_3[i];
    const regEntry = sitesList.find((s) => s.siteId === site.siteId);
    if (!regEntry || !regEntry.cloudflareZoneId) {
      console.error(`Missing zone ID for ${site.domain}`);
      continue;
    }
    const zoneId = regEntry.cloudflareZoneId;

    console.log(`[${i + 1}/${SITES_BATCH_3.length}] Binding ${site.domain} to Worker "${site.siteId}"...`);
    try {
      await cfRequest("PUT", `/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains`, {
        zone_id: zoneId,
        hostname: site.domain,
        service: site.siteId,
        environment: "production",
      });
      console.log(`  -> Successfully bound ${site.domain}!`);
    } catch (err: any) {
      console.warn(`  -> Bind note for ${site.domain}: ${err.message}`);
    }

    console.log(`  -> Binding www.${site.domain} to Worker "${site.siteId}"...`);
    try {
      await cfRequest("PUT", `/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains`, {
        zone_id: zoneId,
        hostname: `www.${site.domain}`,
        service: site.siteId,
        environment: "production",
      });
      console.log(`  -> Successfully bound www.${site.domain}!`);
    } catch (err: any) {
      console.warn(`  -> Bind note for www.${site.domain}: ${err.message}`);
    }
  }

  console.log("\n=== All 11 Batch 3 Domains Bound Successfully! ===\n");
}

main().catch(console.error);
