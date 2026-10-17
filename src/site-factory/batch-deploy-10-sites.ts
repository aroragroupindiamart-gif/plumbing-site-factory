import sodium from "libsodium-wrappers";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

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
const GITHUB_PAT = process.env.GITHUB_PAT || "";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const OWNER = "aroragroupindiamart-gif";
const TEMPLATE_REPO = `${OWNER}/plumbing-site-2`;

const SITES = [
  {
    domain: "hongdaplumbing.com",
    brandName: "Hongda Plumbing",
    siteId: "hongda-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "6vb1__xSHPW-c_WMcY5CYgsuMYoXd0aIavFmJWkU7To"
  },
  {
    domain: "ezplumbingsupplies.com",
    brandName: "EZ Plumbing Supplies",
    siteId: "ez-plumbing-supplies",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "mmoZFz6decx1R-teK1gpduoeVzTqfvDmH7WX2LHn7_g"
  },
  {
    domain: "casablancaplumbing.com",
    brandName: "Casablanca Plumbing",
    siteId: "casablanca-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "HKe6s2_SDGMLxjFZJ331-T4TDFQgOrgxLuXSAkIUlL0"
  },
  {
    domain: "plumbinglogics.com",
    brandName: "Plumbing Logics",
    siteId: "plumbing-logics",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "efZg1VoDSgONWW9MDZTTdOxzKBi_wIkYeHnIYr_7xxM"
  },
  {
    domain: "plumbingpembrokepines.com",
    brandName: "Plumbing PEM Broke Pines",
    siteId: "plumbing-pembroke-pines",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "RIpsOgFEqojlLZbynmWPEqb7-IpRPep1VAAn4Ff4OS0"
  },
  {
    domain: "rayvinzantplumbing.com",
    brandName: "Rayvinzant Plumbing",
    siteId: "rayvinzant-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "P6PH6OvfvHMzzyl98CHN6kJUHWZjvWB_HNib31UtPeM"
  },
  {
    domain: "jibplumbingandheating.com",
    brandName: "Jib Plumbing and Heating",
    siteId: "jib-plumbing-and-heating",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "6vxl2cERjksIfDiP0pU9XJh7XhdHf9De9xVZ1ipBsh4"
  },
  {
    domain: "redwhiteblueplumbing.com",
    brandName: "Red White Blue Plumbing",
    siteId: "red-white-blue-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "R9KJ7SCB3y_i-FVLH6SBiaoZarNFtyQcY4hm2AI4wK8"
  },
  {
    domain: "probityplumbing.com",
    brandName: "Probity Plumbing",
    siteId: "probity-plumbing",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "SFzffhi1kVsdwWwDS4fUE_oulDQAMFO9LVzW5RFLtT0"
  },
  {
    domain: "plumbingcasablanca.com",
    brandName: "Plumbing Casa Blanca",
    siteId: "plumbing-casa-blanca",
    phoneNumber: "(866) 992-0904",
    phoneTel: "8669920904",
    gscToken: "nOX503atsNiQ3f1Kdg-DNDRjSEcnF3RMJvOGmtKOEsc"
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
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "Node"
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${method} ${path} failed (${res.status}): ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function setRepoSecret(repo: string, secretName: string, secretValue: string) {
  const { key, key_id } = await githubRequest("GET", `/repos/${OWNER}/${repo}/actions/secrets/public-key`);
  await sodium.ready;
  const binKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const binValue = sodium.from_string(secretValue);
  const encrypted = sodium.crypto_box_seal(binValue, binKey);
  const encryptedValue = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);
  await githubRequest("PUT", `/repos/${OWNER}/${repo}/actions/secrets/${secretName}`, {
    encrypted_value: encryptedValue,
    key_id,
  });
}

async function createRepoFromTemplate(siteId: string) {
  try {
    const existing = await githubRequest("GET", `/repos/${OWNER}/${siteId}`);
    if (existing.id) {
      console.log(`Repository ${OWNER}/${siteId} already exists.`);
      return;
    }
  } catch (e) {
    // Doesn't exist, proceed to create
  }

  console.log(`Creating repository ${OWNER}/${siteId} from template ${TEMPLATE_REPO}...`);
  await githubRequest("POST", `/repos/${TEMPLATE_REPO}/generate`, {
    owner: OWNER,
    name: siteId,
    private: false,
    include_all_branches: false
  });
  console.log(`Repository ${OWNER}/${siteId} created successfully!`);
}

async function updateWranglerToml(siteId: string) {
  console.log(`Updating wrangler.toml for ${siteId}...`);
  let attempts = 0;
  while (attempts < 10) {
    try {
      const file = await githubRequest("GET", `/repos/${OWNER}/${siteId}/contents/wrangler.toml`);
      const currentContent = Buffer.from(file.content, "base64").toString("utf-8");
      const updatedContent = currentContent.replace(/name\s*=\s*"[^"]*"/, `name = "${siteId}"`);

      await githubRequest("PUT", `/repos/${OWNER}/${siteId}/contents/wrangler.toml`, {
        message: `Set worker name to ${siteId}`,
        content: Buffer.from(updatedContent, "utf-8").toString("base64"),
        sha: file.sha
      });
      console.log(`Updated wrangler.toml for ${siteId}! Deployment triggered on main.`);
      return;
    } catch (err) {
      attempts++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.warn(`Could not update wrangler.toml for ${siteId} after 10 attempts.`);
}

async function main() {
  console.log("=== Starting Batch Provisioning for 10 Plumbing Sites ===\n");

  for (const site of SITES) {
    console.log(`\n---------------------------------------------------------`);
    console.log(`Processing [${site.brandName}] (${site.domain}) -> siteId: ${site.siteId}`);
    console.log(`---------------------------------------------------------`);

    // 1. Create GitHub Repo
    await createRepoFromTemplate(site.siteId);

    // Wait 3s for GitHub to generate files
    await new Promise(r => setTimeout(r, 3000));

    // 2. Enable GitHub Actions
    try {
      await githubRequest("PUT", `/repos/${OWNER}/${site.siteId}/actions/permissions`, {
        enabled: true,
        allowed_actions: "all"
      });
    } catch (e) {
      console.warn(`Note on actions permissions: ${(e as Error).message}`);
    }

    // 3. Set All Secrets
    console.log(`Configuring secrets for ${site.siteId}...`);
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
      NEXT_PUBLIC_SCHEMA_TYPE: "PlumbingService",
      NEXT_PUBLIC_GSC_TOKEN: site.gscToken,
      NEXT_PUBLIC_LAUNCH_DATE: "2026-09-12",
      NEXT_PUBLIC_CONTENT_SALT: String(siteContentSalt(site.siteId))
    };

    for (const [key, val] of Object.entries(secrets)) {
      await setRepoSecret(site.siteId, key, val);
    }
    console.log(`All secrets successfully uploaded for ${site.siteId}!`);

    // 4. Update wrangler.toml to set unique worker name and trigger deployment
    await updateWranglerToml(site.siteId);

    // 5. Update site registry
    const registryPath = "src/site-factory/sites-registry.json";
    if (existsSync(registryPath)) {
      const reg = JSON.parse(readFileSync(registryPath, "utf-8"));
      const existingIdx = reg.sites.findIndex((s: any) => s.siteId === site.siteId);
      const entry = {
        siteId: site.siteId,
        domain: site.domain,
        githubOwner: OWNER,
        repoUrl: `https://github.com/${OWNER}/${site.siteId}`,
        workerUrl: `https://${site.siteId}.aroragroup-indiamart.workers.dev`,
        brandName: site.brandName,
        phoneNumber: site.phoneNumber,
        phoneTel: site.phoneTel,
        launchDate: "2026-09-12",
        status: "active"
      };
      if (existingIdx >= 0) reg.sites[existingIdx] = entry;
      else reg.sites.push(entry);
      writeFileSync(registryPath, JSON.stringify(reg, null, 2) + "\n", "utf-8");
    }
  }

  console.log("\n=== ALL 10 SITES PROVISIONED & DEPLOYING IN PARALLEL! ===");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
