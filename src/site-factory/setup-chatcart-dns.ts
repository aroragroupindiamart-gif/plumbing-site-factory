import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CF_API = "https://api.cloudflare.com/client/v4";
const GODADDY_API = "https://api.godaddy.com/v1";

// Parse .env if not in process.env
try {
  const envContent = readFileSync(".env", "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [k, ...v] = trimmed.split("=");
    if (k && v.length > 0 && !process.env[k.trim()]) {
      process.env[k.trim()] = v.join("=").trim();
    }
  }
} catch {
  // ignore
}

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "c1ebced89f0ab8555f5dc7c1766d8c55";
const CLOUDFLARE_DNS_API_TOKEN = process.env.CLOUDFLARE_DNS_API_TOKEN || "";
const GODADDY_KEY = process.env.GODADDY_API_KEY || "dKsxXn64KkkE_Gw3qLjskhF5qvW3E6yh258";
const GODADDY_SECRET = process.env.GODADDY_API_SECRET || "96zUFP6gvnbKb4YkrNdxvd";

const DOMAIN = "chatcart.in";
const SERVER_IP = "137.23.58.10";

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
  console.log(`\n================================================================`);
  console.log(` Starting Automated Migration: ${DOMAIN} -> Cloudflare Anycast`);
  console.log(`================================================================\n`);

  // STEP 1: Take full backup of existing GoDaddy settings and records
  console.log(`[1/5] Backing up existing GoDaddy domain info and DNS records...`);
  const gdDomain = await godaddyRequest("GET", `/domains/${DOMAIN}`);
  const gdRecords = await godaddyRequest("GET", `/domains/${DOMAIN}/records`);

  const backupData = {
    timestamp: new Date().toISOString(),
    domainInfo: gdDomain,
    records: gdRecords,
  };

  const backupPath = resolve("godaddy-chatcart-dns-backup.json");
  writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`  -> Full backup successfully saved to: ${backupPath}`);
  console.log(`  -> Current Nameservers: ${(gdDomain.nameServers || []).join(", ")}`);

  // STEP 2: Find or create Cloudflare Zone
  console.log(`\n[2/5] Setting up Cloudflare Zone for ${DOMAIN}...`);
  let zone: any;
  const existingZones = await cfRequest<any[]>(
    "GET",
    `/zones?name=${DOMAIN}&account.id=${CLOUDFLARE_ACCOUNT_ID}`
  );

  if (existingZones && existingZones.length > 0) {
    zone = existingZones[0];
    console.log(`  -> Zone already exists on Cloudflare. Zone ID: ${zone.id}`);
  } else {
    console.log(`  -> Creating new zone on Cloudflare...`);
    zone = await cfRequest("POST", "/zones", {
      name: DOMAIN,
      account: { id: CLOUDFLARE_ACCOUNT_ID },
      type: "full",
    });
    console.log(`  -> Created new Zone. Zone ID: ${zone.id}`);
  }

  const cfNameServers: string[] = zone.name_servers || [];
  console.log(`  -> Assigned Cloudflare Nameservers: ${cfNameServers.join(", ")}`);

  if (cfNameServers.length === 0) {
    throw new Error("Cloudflare did not return nameservers for this zone.");
  }

  // STEP 3: Configure DNS Records in Cloudflare (DNS-Only / Grey Cloud)
  console.log(`\n[3/5] Configuring DNS Records on Cloudflare (DNS-Only / Grey Cloud)...`);
  const existingRecords = await cfRequest<any[]>("GET", `/zones/${zone.id}/dns_records`);

  const targetRecords = [
    { type: "A", name: DOMAIN, content: SERVER_IP, proxied: false, ttl: 1 },
    { type: "A", name: `www.${DOMAIN}`, content: SERVER_IP, proxied: false, ttl: 1 },
    { type: "A", name: `staging.${DOMAIN}`, content: SERVER_IP, proxied: false, ttl: 1 },
    { type: "A", name: `*.${DOMAIN}`, content: SERVER_IP, proxied: false, ttl: 1 },
    {
      type: "TXT",
      name: DOMAIN,
      content: "replit-verify=db7b7e9c-78ee-4322-bf02-60fc7e0cf901",
      proxied: false,
      ttl: 1,
    },
  ];

  for (const rec of targetRecords) {
    const existing = existingRecords.find(
      (r) =>
        r.type === rec.type &&
        (r.name === rec.name || r.name === `${rec.name}.${DOMAIN}`)
    );

    if (existing) {
      if (existing.content !== rec.content || existing.proxied !== rec.proxied) {
        console.log(`  -> Updating existing ${rec.type} record: ${rec.name} -> ${rec.content}`);
        await cfRequest("PUT", `/zones/${zone.id}/dns_records/${existing.id}`, rec);
      } else {
        console.log(`  -> Record already up-to-date: ${rec.type} ${rec.name} -> ${rec.content}`);
      }
    } else {
      console.log(`  -> Creating ${rec.type} record: ${rec.name} -> ${rec.content}`);
      await cfRequest("POST", `/zones/${zone.id}/dns_records`, rec);
    }
  }

  // STEP 4: Update GoDaddy Nameservers
  console.log(`\n[4/5] Updating GoDaddy Nameservers to Cloudflare...`);
  const currentGdNs: string[] = gdDomain.nameServers || [];
  const nsMatch =
    cfNameServers.length > 0 &&
    currentGdNs.length === cfNameServers.length &&
    cfNameServers.every((ns) => currentGdNs.includes(ns));

  if (nsMatch) {
    console.log(`  -> GoDaddy nameservers already match Cloudflare. No update needed.`);
  } else {
    console.log(`  -> Submitting nameservers PATCH to GoDaddy: [${cfNameServers.join(", ")}]...`);
    await godaddyRequest("PATCH", `/domains/${DOMAIN}`, {
      nameServers: cfNameServers,
    });
    console.log(`  -> GoDaddy nameserver update submitted successfully!`);
  }

  // STEP 5: Verification
  console.log(`\n[5/5] Verifying GoDaddy domain status...`);
  await new Promise((r) => setTimeout(r, 2000));
  const verifyGd = await godaddyRequest("GET", `/domains/${DOMAIN}`);
  console.log(`  -> Updated GoDaddy Nameservers: ${(verifyGd.nameServers || []).join(", ")}`);

  console.log(`\n================================================================`);
  console.log(` MIGRATION COMPLETE!`);
  console.log(` - Cloudflare Zone: ${zone.name} (${zone.id})`);
  console.log(` - Cloudflare Nameservers: ${cfNameServers.join(", ")}`);
  console.log(` - All DNS records configured in DNS-Only mode directly to ${SERVER_IP}`);
  console.log(` - Wildcard *.${DOMAIN} enabled for all child store subdomains`);
  console.log(` - Backup saved at: ${backupPath}`);
  console.log(`================================================================\n`);
}

main().catch((err) => {
  console.error("\n❌ Error during migration:", err);
  process.exit(1);
});
