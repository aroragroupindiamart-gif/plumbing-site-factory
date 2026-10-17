import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const GITHUB_API = "https://api.github.com";
const GITHUB_OWNER = "aroragroupindiamart-gif";
const GITHUB_PAT = process.env.GITHUB_PAT || "";

const SITE_REPOS = [
  "hongda-plumbing",
  "ez-plumbing-supplies",
  "casablanca-plumbing",
  "plumbing-logics",
  "plumbing-pembroke-pines",
  "rayvinzant-plumbing",
  "jib-plumbing-and-heating",
  "red-white-blue-plumbing",
  "probity-plumbing",
  "plumbing-casa-blanca"
];

const BASE_DIR = "C:/Users/DELL/.gemini/antigravity/scratch/deepseek-apps/plumbing-site-2";

const FILES_TO_UPDATE = [
  "middleware.ts",
  "app/layout.tsx",
  "next.config.js",
  "app/sitemap/[state]/route.ts"
];

async function getFileSha(repo: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `token ${GITHUB_PAT}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Plumbing-Site-Fixer"
      }
    });
    if (!res.ok) return null;
    const json = await res.json() as any;
    return json.sha;
  } catch {
    return null;
  }
}

async function updateFile(repo: string, path: string, content: string, message: string) {
  const sha = await getFileSha(repo, path);
  const base64Content = Buffer.from(content, "utf-8").toString("base64");

  const body: any = {
    message,
    content: base64Content,
    branch: "main"
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_PAT}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Plumbing-Site-Fixer",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update ${path} on ${repo}: ${res.status} ${err}`);
  }
}

async function main() {
  console.log("=== Pushing SEO & Sitemap 404 / Noindex Fix Across All 10 Repos ===");

  const fileContents: Record<string, string> = {};
  for (const f of FILES_TO_UPDATE) {
    fileContents[f] = readFileSync(resolve(BASE_DIR, f), "utf-8");
  }

  for (let i = 0; i < SITE_REPOS.length; i++) {
    const repo = SITE_REPOS[i];
    console.log(`\n[${i + 1}/${SITE_REPOS.length}] Updating ${repo}...`);

    for (const f of FILES_TO_UPDATE) {
      process.stdout.write(`  Updating ${f}... `);
      await updateFile(repo, f, fileContents[f], "fix: remove noindex and fix sitemap xml routing");
      console.log("OK");
      await new Promise(r => setTimeout(r, 400));
    }
  }

  console.log("\n=== All 10 Repositories Updated Successfully! ===");
  console.log("GitHub Actions build and deployments will automatically redeploy the Workers.");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
