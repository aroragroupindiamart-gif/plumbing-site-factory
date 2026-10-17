import { readFileSync } from "node:fs";

const env = readFileSync(
  "C:/Users/DELL/.gemini/antigravity/scratch/deepseek-apps/plumbing-site-factory-script/plumbing-site-factory-main/.env",
  "utf8"
);
let pat = "";
let owner = "";
for (const line of env.split(/\r?\n/)) {
  if (line.startsWith("GITHUB_PAT=")) pat = line.split("=")[1].trim().replace(/['"]/g, "");
  if (line.startsWith("GITHUB_OWNER=")) owner = line.split("=")[1].trim().replace(/['"]/g, "");
}

const GITHUB_API = "https://api.github.com";

// Non-site repos to exclude
const EXCLUDE_REPOS = new Set([
  "plumbing-site-factory",
  "gsc-network-radar",
  "chatcart",
  "cosmetiqly",
  "ez_filing",
  "maxroas",
  "arora-group-jewellery",
  "aroragroupwholesale",
  "aroragroupwholesale-net",
  "aroragroupwholesale-us"
]);

async function getRepos() {
  let page = 1;
  const repos = [];
  while (true) {
    const res = await fetch(`${GITHUB_API}/user/repos?per_page=100&page=${page}&type=owner`, {
      headers: {
        Authorization: `token ${pat}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Cache-Enabler"
      }
    });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    repos.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return repos.filter(r => !EXCLUDE_REPOS.has(r.name) && !r.fork);
}

async function updateWranglerToml(repoName: string) {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repoName}/contents/wrangler.toml`, {
      headers: {
        Authorization: `token ${pat}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Cache-Enabler"
      }
    });

    if (!res.ok) {
      console.log(`  [Skip] ${repoName} does not have wrangler.toml (status ${res.status})`);
      return false;
    }

    const data = await res.json() as any;
    const sha = data.sha;
    const currentContent = Buffer.from(data.content, "base64").toString("utf8");

    if (currentContent.includes("[cache]")) {
      console.log(`  [Skip] ${repoName} already has [cache] enabled.`);
      return false;
    }

    let updatedContent = currentContent;
    if (currentContent.includes("assets = {")) {
      updatedContent = currentContent.replace(
        /(assets\s*=\s*\{[^\}]+\})/,
        `$1\n\n[cache]\nenabled = true`
      );
    } else if (currentContent.includes("[assets]")) {
      updatedContent = currentContent.replace(
        /(\[assets\][\s\S]*?)(?=\n\[|\n\n\[|$)/,
        `$1\n\n[cache]\nenabled = true`
      );
    } else {
      updatedContent = `[cache]\nenabled = true\n\n` + currentContent;
    }

    const putRes = await fetch(`${GITHUB_API}/repos/${owner}/${repoName}/contents/wrangler.toml`, {
      method: "PUT",
      headers: {
        Authorization: `token ${pat}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Cache-Enabler"
      },
      body: JSON.stringify({
        message: "perf: enable Cloudflare Workers Caching to slash CPU time & billing",
        content: Buffer.from(updatedContent, "utf8").toString("base64"),
        sha,
        branch: "main"
      })
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      console.error(`  [Error] Failed to update ${repoName}: ${putRes.status} ${err}`);
      return false;
    }

    console.log(`  [Success] Updated wrangler.toml on ${repoName} (Workers Caching enabled)`);
    return true;
  } catch (err: any) {
    console.error(`  [Error] ${repoName}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("=== Enabling Cloudflare Workers Caching Across All Repos ===");
  const repos = await getRepos();
  console.log(`Found ${repos.length} site repositories.\n`);

  let updatedCount = 0;
  for (let i = 0; i < repos.length; i++) {
    const r = repos[i];
    console.log(`[${i + 1}/${repos.length}] Checking ${r.name}...`);
    const updated = await updateWranglerToml(r.name);
    if (updated) updatedCount++;
    await new Promise(res => setTimeout(res, 500)); // rate limiting buffer
  }

  console.log(`\n=== Finished! Updated ${updatedCount} repositories. ===`);
  console.log("GitHub Actions workflows are automatically building and deploying the Workers with edge caching enabled.");
}

main().catch(console.error);
