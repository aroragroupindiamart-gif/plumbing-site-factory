import { readFileSync } from "node:fs";
import sodium from "libsodium-wrappers";

const envContent = readFileSync(".env", "utf-8");

function getEnvVar(name: string): string {
  const m = envContent.match(new RegExp(`^${name}=["']?([^"'\\r\\n]+)`, "m"));
  return m ? m[1].trim() : "";
}

const GITHUB_PAT = getEnvVar("GITHUB_PAT");
const GITHUB_OWNER = getEnvVar("GITHUB_OWNER") || "aroragroupindiamart-gif";
const CLOUDFLARE_API_TOKEN = getEnvVar("CLOUDFLARE_API_TOKEN");

const NEW_PHONE_DISPLAY = "(855) 391-3175";
const NEW_PHONE_TEL = "8553913175";

// Strictly Preserved Good Performing Sites (Must NOT be touched!)
const PRESERVED_SITES = new Set([
  "charleston-plumbing-service",
  "dupage-plumbing",
  "aep-plumbing",
  "ace-plumbing-pros",
  "push-plumbing",
  "jeff-schefers-plumbing"
]);

// 25 Target Tanked & Not Performing Sites (repo name -> zoneId)
const TARGET_SITES = [
  // 14 Tanked Sites
  { repo: "ez-plumbing-supplies", domain: "ezplumbingsupplies.com", zoneId: "66753393fa0744a84c0137184ead9863" },
  { repo: "plumbing-pembroke-pines", domain: "plumbingpembrokepines.com", zoneId: "78736abcf272905d5eaab018b84acf0b" },
  { repo: "rayvinzant-plumbing", domain: "rayvinzantplumbing.com", zoneId: "946574f5272991cbcf2e5270aa6c825c" },
  { repo: "jib-plumbing-and-heating", domain: "jibplumbingandheating.com", zoneId: "85c92ee79d929f86b6b5984739bfca2e" },
  { repo: "probity-plumbing", domain: "probityplumbing.com", zoneId: "b64f5496a612471147e794b12bffa33a" },
  { repo: "plumbing-casa-blanca", domain: "plumbingcasablanca.com", zoneId: "918470d1621956094e3f1687ee573f80" },
  { repo: "plumbing-repair-news", domain: "plumbingrepairnews.com", zoneId: "2d8627189d48461368b5ee6db07b47e4" },
  { repo: "mj-plumbings", domain: "mjplumbings.com", zoneId: "77cabac06e7df470c83d2d193612c560" },
  { repo: "milton-plumbing-llc", domain: "miltonplumbingllc.com", zoneId: "c842f4f5971956760faeb5fd9b1dc38c" },
  { repo: "am-plumbing-repair", domain: "amplumbingrepair.com", zoneId: "96d2b51c48ed640cf7a65e571466dda7" },
  { repo: "plumbing-paramedic-sc", domain: "plumbingparamedicsc.com", zoneId: "8c7fe83d89fde8212fed35f374b758a6" },
  { repo: "darling-plumbing-services", domain: "darlingplumbingservices.com", zoneId: "08f8c53dd6904439487313a80560f408" },
  { repo: "petro-plumbing-and-mechanical", domain: "petroplumbingandmechanical.com", zoneId: "573755c2dff034b48dd8147c33601047" },
  { repo: "paul-richards-plumbing", domain: "paulrichardsplumbing.com", zoneId: "ee86a0c2df2bc95d2b2ea84a49f22285" },
  // 11 Not Performing Sites
  { repo: "hongda-plumbing", domain: "hongdaplumbing.com", zoneId: "18700ba6f5cb3c84fff4ad0f4e6bf629" },
  { repo: "casablanca-plumbing", domain: "casablancaplumbing.com", zoneId: "8eef6de235393e79b2650ef761dc96ed" },
  { repo: "plumbing-logics", domain: "plumbinglogics.com", zoneId: "aed33f0fdf72e3b483746be18b53b88c" },
  { repo: "red-white-blue-plumbing", domain: "redwhiteblueplumbing.com", zoneId: "92c65143ee08aae14acc6935b9034023" },
  { repo: "plumber-sugarland", domain: "plumbersugarland.com", zoneId: "b33e236231f91b6d9428ac29902ad246" },
  { repo: "south-point-plumbing", domain: "southpointplumbing.com", zoneId: "19e5dbfa683a9a6d4be8ea604d34dc22" },
  { repo: "la-plumbing-supplies", domain: "laplumbingsupplies.com", zoneId: "326fa0133ed5835a79bace298ec8dd22" },
  { repo: "bigfoot-mountain-plumbing", domain: "bigfootmountainplumbing.com", zoneId: "74032cfae23d01873c8ec13d553a7e81" },
  { repo: "elite-vision-plumbing", domain: "elitevisionplumbing.com", zoneId: "bb04fc0dd7e35e8fdf9aa67cadedc169" },
  { repo: "heather-plumbing", domain: "heatherplumbing.com", zoneId: "505701f5c4d2a12bc9595aff505ab9c9" },
  { repo: "naples-fl-plumber", domain: "naplesflplumber.com", zoneId: "de36403dafae6a0d8628dde4daa28b0d" }
];

async function githubRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Antigravity-Deployer",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return null;
  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(`GitHub ${method} ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function setRepoSecret(repo: string, name: string, value: string, publicKey: { key_id: string; key: string }) {
  await sodium.ready;
  const binKey = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);
  const binValue = sodium.from_string(value);
  const encrypted = sodium.crypto_box_seal(binValue, binKey);
  const encryptedValue = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);

  await githubRequest("PUT", `/repos/${GITHUB_OWNER}/${repo}/actions/secrets/${name}`, {
    encrypted_value: encryptedValue,
    key_id: publicKey.key_id
  });
}

async function purgeCloudflareCache(zoneId: string) {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ purge_everything: true })
    });
    const data = await res.json() as any;
    return data.success;
  } catch {
    return false;
  }
}

async function main() {
  console.log("=== TARGETED PHONE NUMBER UPDATE ===");
  console.log(`New Display Phone: ${NEW_PHONE_DISPLAY}`);
  console.log(`New Tel Link:     tel:${NEW_PHONE_TEL}`);
  console.log(`Preserved Sites (Excluded): ${PRESERVED_SITES.size} domains`);
  console.log(`Target Sites (To Update):   ${TARGET_SITES.length} domains\n`);

  // Verify GitHub auth first
  try {
    const user = await githubRequest("GET", "/user");
    console.log(`✅ GitHub Authenticated as: ${user.login}\n`);
  } catch (err: any) {
    console.error("❌ GitHub Authentication Failed:", err.message);
    console.error("Please update GITHUB_PAT in your .env file with a valid Personal Access Token.");
    process.exit(1);
  }

  for (let i = 0; i < TARGET_SITES.length; i++) {
    const item = TARGET_SITES[i];
    const { repo, domain, zoneId } = item;

    if (PRESERVED_SITES.has(repo)) {
      console.log(`[${i+1}/${TARGET_SITES.length}] 🛡️ SKIPPING (Good Performing): ${domain}`);
      continue;
    }

    console.log(`[${i+1}/${TARGET_SITES.length}] Updating ${domain} (repo: ${repo})...`);

    try {
      // 1. Fetch public key for secrets encryption
      const pubKey = await githubRequest("GET", `/repos/${GITHUB_OWNER}/${repo}/actions/secrets/public-key`);

      // 2. Update NEXT_PUBLIC_PHONE_NUMBER
      await setRepoSecret(repo, "NEXT_PUBLIC_PHONE_NUMBER", NEW_PHONE_DISPLAY, pubKey);

      // 3. Update NEXT_PUBLIC_PHONE_TEL
      await setRepoSecret(repo, "NEXT_PUBLIC_PHONE_TEL", NEW_PHONE_TEL, pubKey);
      console.log(`  -> Secrets updated: ${NEW_PHONE_DISPLAY} | tel:${NEW_PHONE_TEL}`);

      // 4. Trigger GitHub Actions deployment
      await githubRequest("POST", `/repos/${GITHUB_OWNER}/${repo}/actions/workflows/deploy.yml/dispatches`, {
        ref: "main"
      });
      console.log(`  -> GitHub Actions workflow dispatched.`);

      // 5. Purge Cloudflare Edge Cache
      const purged = await purgeCloudflareCache(zoneId);
      console.log(`  -> Cloudflare Cache Purge: ${purged ? "SUCCESS" : "SKIPPED/FAILED"}`);

    } catch (err: any) {
      console.error(`  -> ❌ Error updating ${repo}: ${err.message}`);
    }

    // Small delay between API calls
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n=============================================");
  console.log("BATCH UPDATE COMPLETE!");
  console.log("GitHub Actions builds dispatched across all target repos.");
  console.log("=============================================");
}

main();
