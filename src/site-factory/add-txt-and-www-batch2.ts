import { readFileSync } from "node:fs";
const SITES_BATCH_2 = [
  { domain: "plumbingrepairnews.com", siteId: "plumbing-repair-news", gscToken: "-6XB6r84O_-Hb0Ba3nkKYKAcaOGojyF31AjUIrcDDNc" },
  { domain: "mjplumbings.com", siteId: "mj-plumbings", gscToken: "jOFm4YQrvXnTDjTG0YLAXLSEOzeh5HqwZlj6OoSESls" },
  { domain: "plumbersugarland.com", siteId: "plumber-sugarland", gscToken: "z1a7hauN5OsY_6hZzqrVvyoGO-WkhN7EZ9a-OIlO42s" },
  { domain: "southpointplumbing.com", siteId: "south-point-plumbing", gscToken: "N39jakq-nB3R21YGo3BPdpS51V_Am9J_OOgYbZlD4BE" },
  { domain: "miltonplumbingllc.com", siteId: "milton-plumbing-llc", gscToken: "zbuBpStzDw1s9YZZFpV5hbxQtMcvrLIfWKRf6smexiM" },
  { domain: "amplumbingrepair.com", siteId: "am-plumbing-repair", gscToken: "HkAPHXcLxjRs5O2VKPHGPYFXiZXZz2KrlITLIPzJgic" },
  { domain: "plumbingparamedicsc.com", siteId: "plumbing-paramedic-sc", gscToken: "jH4H6Z4FAJ608blpefJtgX0dDkZTYegTk1YFH4r8Ris" },
  { domain: "charlestonplumbingservice.com", siteId: "charleston-plumbing-service", gscToken: "gjmS-PTGjhfTrSmyHOZHeWCyDJdiVUZpF3yUhHTOTK0" },
  { domain: "laplumbingsupplies.com", siteId: "la-plumbing-supplies", gscToken: "FFQT2C-sSUeK8G-IWIeyBgtjJt8so0mGLAkxxwDsEBM" },
  { domain: "dupageplumbing.com", siteId: "dupage-plumbing", gscToken: "qDYcIucctqqkgJj9aV2xGj5Qwr8ShVRCGgt5aUEHA7c" }
];

const envContent = readFileSync(".env", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
}

const CF_API = "https://api.cloudflare.com/client/v4";
const CF_DNS_TOKEN = process.env.CLOUDFLARE_DNS_API_TOKEN!;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;

async function cfRequest<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CF_DNS_TOKEN}`,
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

async function main() {
  console.log("=== Enhancing all 10 Batch 2 Domains with DNS TXT Verification & www Binding ===\n");

  for (let i = 0; i < SITES_BATCH_2.length; i++) {
    const site = SITES_BATCH_2[i];
    console.log(`[${i + 1}/${SITES_BATCH_2.length}] ${site.domain} (${site.siteId})`);

    // 1. Get Zone
    const zones = await cfRequest<any[]>("GET", `/zones?name=${site.domain}&account.id=${CF_ACCOUNT_ID}`);
    if (!zones || zones.length === 0) {
      console.error(`  Zone not found for ${site.domain}`);
      continue;
    }
    const zoneId = zones[0].id;

    // 2. Add DNS TXT record
    console.log(`  -> Adding DNS TXT verification record...`);
    try {
      // Check existing TXT
      const existingRecords = await cfRequest<any[]>("GET", `/zones/${zoneId}/dns_records?type=TXT&name=${site.domain}`);
      const alreadyHas = existingRecords.some((r) => r.content.includes(site.gscToken));
      if (alreadyHas) {
        console.log(`     TXT record already exists.`);
      } else {
        await cfRequest("POST", `/zones/${zoneId}/dns_records`, {
          type: "TXT",
          name: "@",
          content: `google-site-verification=${site.gscToken}`,
          ttl: 60,
        });
        console.log(`     Successfully added TXT record!`);
      }
    } catch (err: any) {
      console.warn(`     TXT error: ${err.message}`);
    }

    // 3. Bind www domain to worker
    console.log(`  -> Binding www.${site.domain} to worker...`);
    try {
      await cfRequest("PUT", `/accounts/${CF_ACCOUNT_ID}/workers/domains`, {
        zone_id: zoneId,
        hostname: `www.${site.domain}`,
        service: site.siteId,
        environment: "production",
      });
      console.log(`     Successfully bound www.${site.domain}!`);
    } catch (err: any) {
      console.warn(`     www bind note: ${err.message}`);
    }
  }

  console.log("\n=== Finished enhancing all 10 sites! ===");
}

main().catch(console.error);
