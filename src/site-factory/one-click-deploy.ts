import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import sodium from "libsodium-wrappers";

// Load environment variables from .env
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

const GITHUB_OWNER = process.env.GITHUB_OWNER || "aroragroupindiamart-gif";
const GITHUB_PAT = process.env.GITHUB_PAT || "";
const TEMPLATE_REPO = process.env.TEMPLATE_REPO || `${GITHUB_OWNER}/plumbing-site-2`;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const CLOUDFLARE_DNS_API_TOKEN = process.env.CLOUDFLARE_DNS_API_TOKEN || "";
const GODADDY_KEY = process.env.GODADDY_API_KEY || "";
const GODADDY_SECRET = process.env.GODADDY_API_SECRET || "";

const REGISTRY_PATH = resolve("src/site-factory/sites-registry.json");
const MASTER_INDEX_PATH = resolve("../../SITES_INDEX.md");

function siteContentSalt(siteId: string): number {
  let hash = 0;
  for (let i = 0; i < siteId.length; i++) {
    hash = (hash * 31 + siteId.charCodeAt(i)) % 100000;
  }
  return (hash % 9973) + 1;
}

function cleanPhoneTel(phone: string): string {
  return phone.replace(/\D/g, "");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
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

async function cfRequest<T = any>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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

async function setRepoSecret(repo: string, secretName: string, secretValue: string, publicKey: { key_id: string; key: string }) {
  await sodium.ready;
  const binkey = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);
  const binsec = sodium.from_string(secretValue);
  const encBytes = sodium.crypto_box_seal(binsec, binkey);
  const encrypted = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);

  await githubRequest("PUT", `/repos/${GITHUB_OWNER}/${repo}/actions/secrets/${secretName}`, {
    encrypted_value: encrypted,
    key_id: publicKey.key_id,
  });
}

export interface DeploySiteParams {
  domain: string;
  brandName: string;
  phoneNumber: string;
  gscToken?: string;
  siteId?: string;
}

export async function deploySingleSite(params: DeploySiteParams) {
  const domain = params.domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const brandName = params.brandName.trim();
  const phoneNumber = params.phoneNumber.trim();
  const siteId = params.siteId || slugify(domain.replace(/\.[^.]+$/, ""));
  const phoneTel = cleanPhoneTel(phoneNumber);
  const salt = siteContentSalt(siteId);
  const launchDate = new Date().toISOString().split("T")[0];
  const gscToken = params.gscToken?.trim() || "";

  console.log(`\n========================================================`);
  console.log(`🚀 DEPLOYING NEW SITE: ${brandName} (${domain})`);
  console.log(`   Site ID: ${siteId} | Phone: ${phoneNumber} | Salt: ${salt}`);
  console.log(`========================================================\n`);

  // Step 1: Create GitHub Repo
  console.log(`[1/6] Creating GitHub repository "${siteId}" from template "${TEMPLATE_REPO}"...`);
  let repoCreated = false;
  try {
    await githubRequest("POST", `/repos/${TEMPLATE_REPO}/generate`, {
      owner: GITHUB_OWNER,
      name: siteId,
      description: `${brandName} - Programmatic Plumbing Directory`,
      private: false,
    });
    repoCreated = true;
    console.log(`  -> Repo created. Waiting 8s for initialization...`);
    await new Promise((r) => setTimeout(r, 8000));
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      console.log(`  -> Repo "${siteId}" already exists. Proceeding with existing repo.`);
    } else {
      throw err;
    }
  }

  // Step 2: Set Secrets
  console.log(`[2/6] Configuring repository secrets...`);
  const pubKey = await githubRequest("GET", `/repos/${GITHUB_OWNER}/${siteId}/actions/secrets/public-key`);
  const secrets: Record<string, string> = {
    CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID,
    NEXT_PUBLIC_BRAND_NAME: brandName,
    NEXT_PUBLIC_SITE_URL: `https://${domain}`,
    NEXT_PUBLIC_PHONE_NUMBER: phoneNumber,
    NEXT_PUBLIC_PHONE_TEL: phoneTel,
    NEXT_PUBLIC_CONTENT_SALT: String(salt),
    NEXT_PUBLIC_LAUNCH_DATE: launchDate,
  };
  if (gscToken) {
    secrets.NEXT_PUBLIC_GSC_VERIFICATION = gscToken;
  }

  for (const [key, val] of Object.entries(secrets)) {
    await setRepoSecret(siteId, key, val, pubKey);
  }
  console.log(`  -> Secrets configured successfully.`);

  // Step 3: Trigger GitHub Actions Deployment
  console.log(`[3/6] Triggering GitHub Actions deployment...`);
  try {
    await githubRequest("POST", `/repos/${GITHUB_OWNER}/${siteId}/actions/workflows/deploy.yml/dispatches`, {
      ref: "main",
    });
    console.log(`  -> Build workflow dispatched.`);
  } catch (e: any) {
    console.log(`  -> Workflow trigger note: ${e.message}`);
  }

  // Step 4: Create Cloudflare Zone
  console.log(`[4/6] Provisioning Cloudflare Zone...`);
  let zone: any;
  const existing = await cfRequest<any[]>(CLOUDFLARE_DNS_API_TOKEN, "GET", `/zones?name=${domain}&account.id=${CLOUDFLARE_ACCOUNT_ID}`);
  if (existing && existing.length > 0) {
    zone = existing[0];
    console.log(`  -> Existing Zone ID: ${zone.id}`);
  } else {
    zone = await cfRequest(CLOUDFLARE_DNS_API_TOKEN, "POST", "/zones", {
      name: domain,
      account: { id: CLOUDFLARE_ACCOUNT_ID },
    });
    console.log(`  -> Created Zone ID: ${zone.id}`);
  }

  const cfNameServers: string[] = zone.name_servers || ["otto.ns.cloudflare.com", "savanna.ns.cloudflare.com"];
  console.log(`  -> Assigned Cloudflare Nameservers: ${cfNameServers.join(", ")}`);

  // Step 5: Update GoDaddy Nameservers
  console.log(`[5/6] Updating GoDaddy nameservers...`);
  try {
    await godaddyRequest("PATCH", `/domains/${domain}`, {
      nameServers: cfNameServers,
    });
    console.log(`  -> GoDaddy nameservers updated to [${cfNameServers.join(", ")}].`);
  } catch (err: any) {
    console.warn(`  -> Note on GoDaddy update: ${err.message}`);
  }

  // Step 6: Bind Custom Domain to Worker
  console.log(`[6/6] Binding ${domain} to Cloudflare Worker "${siteId}"...`);
  try {
    await cfRequest(CLOUDFLARE_DNS_API_TOKEN, "PUT", `/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains`, {
      zone_id: zone.id,
      hostname: domain,
      service: siteId,
      environment: "production",
    });
    console.log(`  -> Successfully bound ${domain} to Worker "${siteId}"!`);
  } catch (err: any) {
    console.log(`  -> Custom domain bind status: ${err.message}`);
  }

  // Update Registry
  try {
    if (existsSync(REGISTRY_PATH)) {
      const reg = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
      const entry = {
        siteId,
        domain,
        githubOwner: GITHUB_OWNER,
        repoUrl: `https://github.com/${GITHUB_OWNER}/${siteId}`,
        workerUrl: `https://${siteId}.aroragroup-indiamart.workers.dev`,
        brandName,
        phoneNumber,
        phoneTel,
        launchDate,
        status: "active",
        cloudflareZoneId: zone.id,
        nameservers: cfNameServers,
      };
      const idx = reg.sites.findIndex((s: any) => s.domain === domain);
      if (idx >= 0) reg.sites[idx] = entry;
      else reg.sites.push(entry);
      writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2));
    }
  } catch (e) {}

  console.log(`\n✅ DEPLOYMENT COMPLETE!`);
  console.log(`   Domain: https://${domain}`);
  console.log(`   Worker: https://${siteId}.aroragroup-indiamart.workers.dev`);
  console.log(`   GitHub: https://github.com/${GITHUB_OWNER}/${siteId}`);
}

// CLI handler
if (process.argv[1]?.includes("one-click-deploy")) {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : "";
  };

  const domain = getArg("--domain");
  const brandName = getArg("--brand");
  const phoneNumber = getArg("--phone");
  const gscToken = getArg("--gsc");

  if (!domain || !brandName || !phoneNumber) {
    console.log(`
Usage:
  npx tsx src/site-factory/one-click-deploy.ts --domain <domain> --brand "<brand>" --phone "<phone>" [--gsc "<token>"]

Example:
  npx tsx src/site-factory/one-click-deploy.ts --domain sampleplumbing.com --brand "Sample Plumbing" --phone "(866) 555-0199" --gsc "token123"
`);
    process.exit(0);
  }

  deploySingleSite({ domain, brandName, phoneNumber, gscToken }).catch((err) => {
    console.error("Fatal deployment error:", err);
    process.exit(1);
  });
}
