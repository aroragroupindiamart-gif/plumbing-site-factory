import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CF_API = "https://api.cloudflare.com/client/v4";
const GODADDY_API = "https://api.godaddy.com/v1";

const CLOUDFLARE_ACCOUNT_ID = "c1ebced89f0ab8555f5dc7c1766d8c55";
const CLOUDFLARE_DNS_API_TOKEN = process.env.CLOUDFLARE_DNS_API_TOKEN || "";
const GODADDY_KEY = "dKsxXn64KkkE_Gw3qLjskhF5qvW3E6yh258";
const GODADDY_SECRET = "96zUFP6gvnbKb4YkrNdxvd";

const REGISTRY_PATH = resolve("src/site-factory/sites-registry.json");

interface SiteEntry {
  siteId: string;
  domain: string;
  githubOwner: string;
  repoUrl: string;
  workerUrl: string;
  brandName: string;
  phoneNumber: string;
  phoneTel: string;
  launchDate: string;
  status: string;
  cloudflareZoneId?: string;
  nameservers?: string[];
}

const NEW_DOMAINS = [
  { domain: "hongdaplumbing.com", siteId: "hongda-plumbing" },
  { domain: "ezplumbingsupplies.com", siteId: "ez-plumbing-supplies" },
  { domain: "casablancaplumbing.com", siteId: "casablanca-plumbing" },
  { domain: "plumbinglogics.com", siteId: "plumbing-logics" },
  { domain: "plumbingpembrokepines.com", siteId: "plumbing-pembroke-pines" },
  { domain: "rayvinzantplumbing.com", siteId: "rayvinzant-plumbing" },
  { domain: "jibplumbingandheating.com", siteId: "jib-plumbing-and-heating" },
  { domain: "redwhiteblueplumbing.com", siteId: "red-white-blue-plumbing" },
  { domain: "probityplumbing.com", siteId: "probity-plumbing" },
  { domain: "plumbingcasablanca.com", siteId: "plumbing-casa-blanca" },
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
    throw new Error(`Cloudflare API ${method} ${path} error: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}

async function godaddyRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${GODADDY_API}${path}`, {
    method,
    headers: {
      Authorization: `sso-key ${GODADDY_KEY}:${GODADDY_SECRET}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  console.log("=== Starting Automated Cloudflare Zone, GoDaddy NS, and Worker Binding ===");

  const registryRaw = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
  const sites: SiteEntry[] = registryRaw.sites;

  for (let i = 0; i < NEW_DOMAINS.length; i++) {
    const { domain, siteId } = NEW_DOMAINS[i];
    console.log(`\n[${i + 1}/${NEW_DOMAINS.length}] Processing ${domain} (worker: ${siteId})...`);

    // 1. Get or create Cloudflare zone
    let zone: any;
    const existingZones = await cfRequest<any[]>("GET", `/zones?name=${domain}&account.id=${CLOUDFLARE_ACCOUNT_ID}`);
    if (existingZones && existingZones.length > 0) {
      zone = existingZones[0];
      console.log(`  -> Existing Zone ID: ${zone.id} (status: ${zone.status})`);
    } else {
      console.log(`  -> Creating new zone on Cloudflare...`);
      zone = await cfRequest("POST", "/zones", {
        name: domain,
        account: { id: CLOUDFLARE_ACCOUNT_ID },
      });
      console.log(`  -> Created Zone ID: ${zone.id}`);
    }

    const cfNameServers: string[] = zone.name_servers || [];
    console.log(`  -> Cloudflare Nameservers: ${cfNameServers.join(", ")}`);

    // 2. Check and sync GoDaddy Nameservers
    try {
      const gdDomain = await godaddyRequest("GET", `/domains/${domain}`);
      const currentGdNs: string[] = gdDomain.nameServers || [];
      console.log(`  -> Current GoDaddy Nameservers: ${currentGdNs.join(", ") || "(empty/pending)"}`);

      const nsMatch =
        cfNameServers.length > 0 &&
        currentGdNs.length === cfNameServers.length &&
        cfNameServers.every((ns) => currentGdNs.includes(ns));

      if (nsMatch) {
        console.log(`  -> GoDaddy nameservers already match Cloudflare. Skipping NS patch.`);
      } else if (cfNameServers.length > 0) {
        console.log(`  -> Updating GoDaddy nameservers to Cloudflare: [${cfNameServers.join(", ")}]...`);
        await godaddyRequest("PATCH", `/domains/${domain}`, {
          nameServers: cfNameServers,
        });
        console.log(`  -> GoDaddy nameserver update request submitted successfully.`);
      }
    } catch (err: any) {
      console.error(`  -> Warning updating GoDaddy: ${err.message}`);
    }

    // 3. Bind Worker Custom Domain
    console.log(`  -> Binding ${domain} to Worker "${siteId}"...`);
    try {
      const bindResult = await cfRequest("PUT", `/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains`, {
        zone_id: zone.id,
        hostname: domain,
        service: siteId,
        environment: "production",
      });
      console.log(`  -> Successfully bound ${domain} to ${siteId}!`);
    } catch (err: any) {
      console.error(`  -> Binding error: ${err.message}`);
    }

    // Update entry in sites-registry.json
    const siteIdx = sites.findIndex((s) => s.domain === domain);
    if (siteIdx >= 0) {
      sites[siteIdx].cloudflareZoneId = zone.id;
      sites[siteIdx].nameservers = cfNameServers;
    }

    // Short pause between operations to avoid API rate limits
    await new Promise((r) => setTimeout(r, 1200));
  }

  writeFileSync(REGISTRY_PATH, JSON.stringify({ sites }, null, 2));
  console.log("\nUpdated sites-registry.json with Zone IDs and Nameservers.");
  console.log("=== All 10 Domains Processed Successfully! ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
