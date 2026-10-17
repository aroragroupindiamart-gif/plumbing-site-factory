import { readFileSync } from "node:fs";

const envContent = readFileSync(".env", "utf-8");

function getEnvVar(name: string): string {
  const m = envContent.match(new RegExp(`^${name}=["']?([^"'\\r\\n]+)`, "m"));
  return m ? m[1].trim() : "";
}

const GITHUB_PAT = getEnvVar("GITHUB_PAT");
const GITHUB_OWNER = getEnvVar("GITHUB_OWNER") || "aroragroupindiamart-gif";

// Strictly Preserved Good Performing Sites (Must NOT be touched!)
const PRESERVED_SITES = new Set([
  "charleston-plumbing-service",
  "dupage-plumbing",
  "aep-plumbing",
  "ace-plumbing-pros",
  "push-plumbing",
  "jeff-schefers-plumbing"
]);

// 25 Target Tanked & Not Performing Sites
const TARGET_SITES = [
  "am-plumbing-repair",
  "ez-plumbing-supplies",
  "plumbing-pembroke-pines",
  "rayvinzant-plumbing",
  "jib-plumbing-and-heating",
  "probity-plumbing",
  "plumbing-casa-blanca",
  "plumbing-repair-news",
  "mj-plumbings",
  "milton-plumbing-llc",
  "plumbing-paramedic-sc",
  "darling-plumbing-services",
  "petro-plumbing-and-mechanical",
  "paul-richards-plumbing",
  "hongda-plumbing",
  "casablanca-plumbing",
  "plumbing-logics",
  "red-white-blue-plumbing",
  "plumber-sugarland",
  "south-point-plumbing",
  "la-plumbing-supplies",
  "bigfoot-mountain-plumbing",
  "elite-vision-plumbing",
  "heather-plumbing",
  "naples-fl-plumber"
];

async function triggerDeploy(repo: string): Promise<boolean> {
  if (PRESERVED_SITES.has(repo)) {
    console.log(`🛡️ SKIPPING PRESERVED SITE: ${repo}`);
    return false;
  }

  // 1. Check existing .trigger file SHA
  let sha: string | undefined;
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/.trigger`, {
      headers: {
        Authorization: `Bearer ${GITHUB_PAT}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Antigravity"
      }
    });
    if (res.ok) {
      const data = await res.json() as any;
      sha = data.sha;
    }
  } catch {}

  // 2. Commit update to .trigger to trigger push event
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/.trigger`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "Antigravity"
    },
    body: JSON.stringify({
      message: "chore: update phone number to (855) 391-3175",
      content: Buffer.from(`trigger-deploy-${Date.now()}\n`).toString("base64"),
      sha: sha || undefined
    })
  });

  return res.ok;
}

async function main() {
  console.log("=== TRIGGERING GITHUB ACTIONS BUILDS ACROSS 25 TARGET REPOS ===");
  console.log(`Target Count: ${TARGET_SITES.length} | Preserved Count: ${PRESERVED_SITES.size}\n`);

  let triggered = 0;
  for (let i = 0; i < TARGET_SITES.length; i++) {
    const repo = TARGET_SITES[i];
    process.stdout.write(`[${i+1}/${TARGET_SITES.length}] Triggering build on ${repo}... `);
    try {
      const ok = await triggerDeploy(repo);
      if (ok) {
        triggered++;
        console.log("✅ TRIGGERED");
      } else {
        console.log("❌ FAILED");
      }
    } catch (e: any) {
      console.log(`❌ ERROR: ${e.message}`);
    }
    // Respect GitHub API secondary rate limits
    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`\nSuccessfully dispatched builds across ${triggered}/${TARGET_SITES.length} repositories!`);
}

main();
