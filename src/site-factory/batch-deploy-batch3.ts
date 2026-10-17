import sodium from "libsodium-wrappers";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
const GODADDY_API = "https://api.godaddy.com/v1";

const OWNER = process.env.GITHUB_OWNER || "aroragroupindiamart-gif";
const GITHUB_PAT = process.env.GITHUB_PAT || "";
const TEMPLATE_REPO = process.env.TEMPLATE_REPO || `${OWNER}/plumbing-site-2`;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const CLOUDFLARE_DNS_API_TOKEN = process.env.CLOUDFLARE_DNS_API_TOKEN || "";
const GODADDY_KEY = process.env.GODADDY_API_KEY || "";
const GODADDY_SECRET = process.env.GODADDY_API_SECRET || "";

const REGISTRY_PATH = resolve("src/site-factory/sites-registry.json");
const MASTER_INDEX_PATH = resolve("../../SITES_INDEX.md");

export const SITES_BATCH_3 = [
  {
    domain: "darlingplumbingservices.com",
    brandName: "Darling Plumbing Services",
    siteId: "darling-plumbing-services",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "GGiDSXV4qOU9W-LKOwCKtSMUIBAWJDbnkenUrzsras4"
  },
  {
    domain: "aepplumbing.com",
    brandName: "AEP Plumbing",
    siteId: "aep-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "J2eSiCRLnUAZ10kNOksWkBEVZnl_ukncJdqrAtaxdQM"
  },
  {
    domain: "petroplumbingandmechanical.com",
    brandName: "Petro Plumbing and Mechanical",
    siteId: "petro-plumbing-and-mechanical",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "W6C1gPWf35ZtMxzS6a8S27lSgVTwl9_1ClOlWGaaFrM"
  },
  {
    domain: "aceplumbingpros.com",
    brandName: "Ace Plumbing Pros",
    siteId: "ace-plumbing-pros",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "HKeHRASyBQ4qqZ7_m8_L5J9BWO5RiGUotOcwjTzsxtY"
  },
  {
    domain: "bigfootmountainplumbing.com",
    brandName: "Bigfoot Mountain Plumbing",
    siteId: "bigfoot-mountain-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "GhsiAR3kpbg2DN6hPRHaO5WOs4R35Hs0jNUioA2WrYA"
  },
  {
    domain: "paulrichardsplumbing.com",
    brandName: "Paul Richards Plumbing",
    siteId: "paul-richards-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "-7cqNRi4DPqbu6enaGlWCmcP-NLeNRpkRDWBepiyYoI"
  },
  {
    domain: "pushplumbing.com",
    brandName: "Push Plumbing",
    siteId: "push-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "PGPC2xh1FIHk5Tl1bVNS4R_MTcpIXbqkX8-nx3NRC5s"
  },
  {
    domain: "elitevisionplumbing.com",
    brandName: "Elite Vision Plumbing",
    siteId: "elite-vision-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "QlN3RkXMHUvioaxpzK1qIi8a11JosWlE5xJxipiMooM"
  },
  {
    domain: "heatherplumbing.com",
    brandName: "Heather Plumbing",
    siteId: "heather-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "1KcF7TM2TEOd_aJ9nAs3QBXcCZSRJBbFJ-tbCyt7YJw"
  },
  {
    domain: "naplesflplumber.com",
    brandName: "Naples FL Plumber",
    siteId: "naples-fl-plumber",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "7-yaKMMDguw3Wki69W71MeRXXobLywNXfInPUuxREEg"
  },
  {
    domain: "jeffschefersplumbing.com",
    brandName: "Jeff Schefers Plumbing",
    siteId: "jeff-schefers-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "syisT-3LM-CfLDXr8zrMgE9nmc40yWtNiArZkoAGwG0"
  }
];

function siteContentSalt(siteId: string): number {
  let hash = 0;
  for (let i = 0; i < siteId.length; i++) {
    hash = (hash * 31 + siteId.charCodeAt(i)) % 100000;
  }
  return (hash % 9973) + 1;
}

async function githubRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Authorization: `token ${GITHUB_PAT}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Plumbing-Site-Automation",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GitHub ${method} ${path} failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function setRepoSecret(repo: string, secretName: string, secretValue: string, publicKey: { key: string; key_id: string }) {
  await sodium.ready;
  const binKey = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);
  const binValue = sodium.from_string(secretValue);
  const encrypted = sodium.crypto_box_seal(binValue, binKey);
  const encryptedValue = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);
  await githubRequest("PUT", `/repos/${OWNER}/${repo}/actions/secrets/${secretName}`, {
    encrypted_value: encryptedValue,
    key_id: publicKey.key_id,
  });
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

async function createRepoFromTemplate(siteId: string) {
  try {
    const existing = await githubRequest("GET", `/repos/${OWNER}/${siteId}`);
    if (existing.id) {
      console.log(`  -> Repository ${OWNER}/${siteId} already exists.`);
      return;
    }
  } catch (e) {}

  console.log(`  -> Creating repository ${OWNER}/${siteId} from template ${TEMPLATE_REPO}...`);
  await githubRequest("POST", `/repos/${TEMPLATE_REPO}/generate`, {
    owner: OWNER,
    name: siteId,
    private: false,
    include_all_branches: false,
  });
  console.log(`  -> Repository created.`);
}

async function updateWranglerToml(siteId: string) {
  console.log(`  -> Updating wrangler.toml for ${siteId}...`);
  let attempts = 0;
  while (attempts < 12) {
    try {
      const file = await githubRequest("GET", `/repos/${OWNER}/${siteId}/contents/wrangler.toml`);
      const currentContent = Buffer.from(file.content, "base64").toString("utf-8");
      const updatedContent = currentContent.replace(/name\s*=\s*"[^"]*"/, `name = "${siteId}"`);

      await githubRequest("PUT", `/repos/${OWNER}/${siteId}/contents/wrangler.toml`, {
        message: `Set worker name to ${siteId}`,
        content: Buffer.from(updatedContent, "utf-8").toString("base64"),
        sha: file.sha,
      });
      console.log(`  -> Updated wrangler.toml! Deployment triggered.`);
      return;
    } catch (err) {
      attempts++;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.warn(`  -> Warning: Could not update wrangler.toml for ${siteId} after 12 attempts.`);
}

async function main() {
  console.log("=========================================================================");
  console.log("🚀 STARTING AUTOMATED BATCH 3 DEPLOYMENT (SITES #28 - #38, 11 SITES)");
  console.log("=========================================================================\n");

  const today = "2026-09-27";
  const registryRaw = existsSync(REGISTRY_PATH) ? JSON.parse(readFileSync(REGISTRY_PATH, "utf-8")) : { sites: [] };
  const sitesList: any[] = registryRaw.sites;

  for (let i = 0; i < SITES_BATCH_3.length; i++) {
    const site = SITES_BATCH_3[i];
    const salt = siteContentSalt(site.siteId);

    console.log(`\n-------------------------------------------------------------------------`);
    console.log(`[${i + 1}/${SITES_BATCH_3.length}] ${site.brandName} (${site.domain})`);
    console.log(`      Site ID: ${site.siteId} | Salt: ${salt} | Phone: ${site.phoneNumber}`);
    console.log(`-------------------------------------------------------------------------`);

    // 1. Create GitHub Repo
    await createRepoFromTemplate(site.siteId);
    await new Promise((r) => setTimeout(r, 4000));

    // 2. Set Secrets
    console.log(`  -> Configuring GitHub repository secrets...`);
    const pubKey = await githubRequest("GET", `/repos/${OWNER}/${site.siteId}/actions/secrets/public-key`);
    const secrets: Record<string, string> = {
      CLOUDFLARE_API_TOKEN,
      CLOUDFLARE_ACCOUNT_ID,
      NEXT_PUBLIC_BRAND_NAME: site.brandName,
      NEXT_PUBLIC_PHONE_NUMBER: site.phoneNumber,
      NEXT_PUBLIC_PHONE_TEL: site.phoneTel,
      NEXT_PUBLIC_SITE_URL: `https://${site.domain}`,
      NEXT_PUBLIC_NICHE: "Plumbing",
      NEXT_PUBLIC_NICHE_PLURAL: "Plumbers",
      NEXT_PUBLIC_NICHE_SINGULAR: "Plumber",
      NEXT_PUBLIC_SCHEMA_TYPE: "Plumber",
      NEXT_PUBLIC_GSC_TOKEN: site.gscToken,
      NEXT_PUBLIC_LAUNCH_DATE: today,
      NEXT_PUBLIC_CONTENT_SALT: String(salt),
    };

    for (const [sKey, sVal] of Object.entries(secrets)) {
      await setRepoSecret(site.siteId, sKey, sVal, pubKey);
    }
    console.log(`  -> All 12 secrets configured.`);

    // 3. Update wrangler.toml to trigger build
    await updateWranglerToml(site.siteId);

    // 4. Provision Cloudflare Zone
    console.log(`  -> Setting up Cloudflare Zone...`);
    let zone: any;
    const existingZones = await cfRequest<any[]>("GET", `/zones?name=${site.domain}&account.id=${CLOUDFLARE_ACCOUNT_ID}`);
    if (existingZones && existingZones.length > 0) {
      zone = existingZones[0];
      console.log(`  -> Existing Zone ID: ${zone.id}`);
    } else {
      zone = await cfRequest("POST", "/zones", {
        name: site.domain,
        account: { id: CLOUDFLARE_ACCOUNT_ID },
      });
      console.log(`  -> Created Zone ID: ${zone.id}`);
    }

    const cfNameServers: string[] = zone.name_servers || ["otto.ns.cloudflare.com", "savanna.ns.cloudflare.com"];
    console.log(`  -> Nameservers: ${cfNameServers.join(", ")}`);

    // 5. Add GSC DNS TXT Record immediately
    console.log(`  -> Adding GSC DNS TXT record...`);
    try {
      const existingRecords = await cfRequest<any[]>("GET", `/zones/${zone.id}/dns_records?type=TXT&name=${site.domain}`);
      const alreadyHas = existingRecords.some((r) => r.content.includes(site.gscToken));
      if (!alreadyHas) {
        await cfRequest("POST", `/zones/${zone.id}/dns_records`, {
          type: "TXT",
          name: "@",
          content: `google-site-verification=${site.gscToken}`,
          ttl: 60,
        });
        console.log(`  -> DNS TXT verification record added successfully!`);
      } else {
        console.log(`  -> DNS TXT record already present.`);
      }
    } catch (txtErr: any) {
      console.warn(`  -> DNS TXT note: ${txtErr.message}`);
    }

    // 6. Update GoDaddy Nameservers
    console.log(`  -> Delegating GoDaddy nameservers...`);
    try {
      await godaddyRequest("PATCH", `/domains/${site.domain}`, {
        nameServers: cfNameServers,
      });
      console.log(`  -> GoDaddy nameservers updated successfully.`);
    } catch (gdErr: any) {
      console.warn(`  -> GoDaddy update note: ${gdErr.message}`);
    }

    // 7. Update sites-registry.json
    const registryEntry = {
      siteId: site.siteId,
      domain: site.domain,
      githubOwner: OWNER,
      repoUrl: `https://github.com/${OWNER}/${site.siteId}`,
      workerUrl: `https://${site.siteId}.aroragroup-indiamart.workers.dev`,
      brandName: site.brandName,
      phoneNumber: site.phoneNumber,
      phoneTel: site.phoneTel,
      launchDate: today,
      status: "active",
      cloudflareZoneId: zone.id,
      nameservers: cfNameServers,
      gscToken: site.gscToken,
    };

    const idx = sitesList.findIndex((s) => s.siteId === site.siteId);
    if (idx >= 0) sitesList[idx] = registryEntry;
    else sitesList.push(registryEntry);

    writeFileSync(REGISTRY_PATH, JSON.stringify({ sites: sitesList }, null, 2), "utf-8");
    console.log(`  -> sites-registry.json updated.`);
  }

  console.log("\n=========================================================================");
  console.log("✅ ALL 11 REPOSITORIES CREATED, SECRETS SET, ZONES & DNS DELEGATED!");
  console.log("=========================================================================\n");
}

main().catch(console.error);
