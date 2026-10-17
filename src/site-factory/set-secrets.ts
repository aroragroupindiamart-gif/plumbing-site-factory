/**
 * Sets up all the secrets on GitHub for an already existing repository.
 *
 * Usage:
 *   npx tsx ./src/site-factory/set-secrets.ts ./src/site-factory/plumbing-site-3-anti-gravity.json
 */
import sodium from "libsodium-wrappers";
import { readFileSync } from "node:fs";
import type { SiteConfig } from "./types.js";
import { toRepoSecrets } from "./types.js";

// Basic dotenv-like parser
function loadEnv() {
  try {
    const envContent = readFileSync(".env", "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || "";
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  } catch (e) {
    // Ignore if no .env file
  }
}

loadEnv();

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
      "User-Agent": "Antigravity-Deployer"
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

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error("Usage: npx tsx set-secrets.ts <path-to-site-config.json>");
    process.exit(1);
  }

  const config: SiteConfig = JSON.parse(readFileSync(configPath, "utf-8"));
  const githubToken = requireEnv("GITHUB_PAT");
  const cloudflareAccountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const cloudflareApiToken = requireEnv("CLOUDFLARE_API_TOKEN");

  console.log(`Loading secrets mapping for repository ${config.githubOwner}/${config.siteId}...`);
  const secrets = toRepoSecrets(config, cloudflareAccountId, cloudflareApiToken);
  
  for (const [name, value] of Object.entries(secrets)) {
    console.log(`Uploading secret ${name} to GitHub...`);
    await setRepoSecret(githubToken, config.githubOwner, config.siteId, name, value);
  }
  console.log("\nSuccess: All deployment secrets have been successfully set on your GitHub repository!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
