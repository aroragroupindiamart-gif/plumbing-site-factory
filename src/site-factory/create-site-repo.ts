/**
 * Creates a new GitHub repo for a niche-directory site from the plumbing-directory
 * template, and populates the GitHub Actions secrets it needs to deploy itself.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run site:create-repo -- path/to/site-config.json
 *
 * Requires env vars:
 *   GITHUB_PAT               — needs `repo` + `workflow` scopes (already configured)
 *   CLOUDFLARE_ACCOUNT_ID    — reused as-is across all sites
 *   CLOUDFLARE_API_TOKEN     — the existing deploy-only token, reused as-is across all sites
 *
 * This script does NOT touch the source template repo. It only reads its
 * `is_template` setting (and flips it on if needed) and calls GitHub's
 * "generate repository from template" API to produce a brand-new, independent repo.
 */
import sodium from "libsodium-wrappers";
import { readFileSync } from "node:fs";
import type { SiteConfig } from "./types.js";
import { siteContentSalt, toRepoSecrets } from "./types.js";
import { generateContentPack } from "./generate-content-pack.js";
import { registryEntryFromConfig, upsertSiteEntry } from "./site-registry.js";

const GITHUB_API = "https://api.github.com";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function githubRequest(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${method} ${path} failed: ${res.status} ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function ensureTemplateFlag(token: string, templateRepo: string) {
  const repo = await githubRequest(token, "GET", `/repos/${templateRepo}`);
  if (!repo.is_template) {
    console.log(`Marking ${templateRepo} as a template repo...`);
    await githubRequest(token, "PATCH", `/repos/${templateRepo}`, { is_template: true });
  }
}

async function generateRepoFromTemplate(token: string, templateRepo: string, owner: string, name: string) {
  console.log(`Generating ${owner}/${name} from template ${templateRepo}...`);
  return githubRequest(token, "POST", `/repos/${templateRepo}/generate`, {
    owner,
    name,
    private: false, // public repos get unlimited free GitHub Actions minutes
    include_all_branches: false,
  });
}

async function enableActions(token: string, owner: string, repo: string) {
  await githubRequest(token, "PUT", `/repos/${owner}/${repo}/actions/permissions`, {
    enabled: true,
    allowed_actions: "all",
  });
}

async function setRepoSecret(token: string, owner: string, repo: string, secretName: string, secretValue: string) {
  const { key, key_id } = await githubRequest(token, "GET", `/repos/${owner}/${repo}/actions/secrets/public-key`);
  await sodium.ready;
  const binKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const binValue = sodium.from_string(secretValue);
  const encrypted = sodium.crypto_box_seal(binValue, binKey);
  const encryptedValue = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);
  await githubRequest(token, "PUT", `/repos/${owner}/${repo}/actions/secrets/${secretName}`, {
    encrypted_value: encryptedValue,
    key_id,
  });
}

const CONTENT_PACK_PATH = "lib/data/content-pack.json";

async function pushContentPack(token: string, owner: string, repo: string, contentPack: unknown) {
  const existing = await githubRequest(token, "GET", `/repos/${owner}/${repo}/contents/${CONTENT_PACK_PATH}`);
  const contentJson = JSON.stringify(contentPack, null, 2) + "\n";
  await githubRequest(token, "PUT", `/repos/${owner}/${repo}/contents/${CONTENT_PACK_PATH}`, {
    message: "Generate unique site content pack",
    content: Buffer.from(contentJson, "utf-8").toString("base64"),
    sha: existing.sha,
  });
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error("Usage: tsx create-site-repo.ts <path-to-site-config.json>");
    process.exit(1);
  }

  const config: SiteConfig = JSON.parse(readFileSync(configPath, "utf-8"));
  const githubToken = requireEnv("GITHUB_PAT");
  const cloudflareAccountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const cloudflareApiToken = requireEnv("CLOUDFLARE_API_TOKEN");

  await ensureTemplateFlag(githubToken, config.templateRepo);
  await generateRepoFromTemplate(githubToken, config.templateRepo, config.githubOwner, config.siteId);
  await enableActions(githubToken, config.githubOwner, config.siteId);

  const contentSalt = siteContentSalt(config.siteId);
  upsertSiteEntry(registryEntryFromConfig(config, contentSalt));
  console.log(`Registered ${config.siteId} in sites-registry.json.`);

  const secrets = toRepoSecrets(config, cloudflareAccountId, cloudflareApiToken);
  for (const [name, value] of Object.entries(secrets)) {
    console.log(`Setting secret ${name}...`);
    await setRepoSecret(githubToken, config.githubOwner, config.siteId, name, value);
  }

  console.log("Generating unique site content pack (this makes the new site's copy distinct from the template and other sites)...");
  try {
    // "Generate from template" is asynchronous on GitHub's side, so the new
    // repo's file tree may not be queryable via Contents API immediately.
    await waitForRepoContents(githubToken, config.githubOwner, config.siteId);
    const contentPack = await generateContentPack(config);
    await pushContentPack(githubToken, config.githubOwner, config.siteId, contentPack);
    console.log("Content pack generated and committed.");
  } catch (err) {
    console.warn(`Warning: could not generate a unique content pack (${(err as Error).message}).`);
    console.warn("The site will deploy with the template's default content pack. You can retry later with:");
    console.warn(`  pnpm --filter @workspace/scripts run site:generate-content-pack -- ${configPath}`);
  }

  console.log(`\nDone. Repo created: https://github.com/${config.githubOwner}/${config.siteId}`);
  console.log("The deploy workflow will run automatically on the initial commit from the template.");
  console.log("Next step: run site:setup-domain to wire up Cloudflare DNS + the custom domain.");
}

async function waitForRepoContents(token: string, owner: string, repo: string, attempts = 10, delayMs = 2000) {
  for (let i = 0; i < attempts; i++) {
    try {
      await githubRequest(token, "GET", `/repos/${owner}/${repo}/contents/${CONTENT_PACK_PATH}`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`Timed out waiting for ${owner}/${repo} contents to become available`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
