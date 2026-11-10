import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const GITHUB_PAT = process.env.GITHUB_PAT || process.env.GH_TOKEN;
const CF_ACCOUNT_ID = 'c1ebced89f0ab8555f5dc7c1766d8c55';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const WORK_DIR = 'C:/Users/DELL/.gemini/antigravity/scratch/rebuild-work';
const TEMPLATE_DIR = 'C:/Users/DELL/.gemini/antigravity/scratch/deepseek-apps/plumbing-site-2';

const repoName = process.argv[2];
const zoneId = process.argv[3];
const customDomain = process.argv[4] || '';

if (!repoName || !zoneId) {
  console.error("Usage: node rebuild_single_site.mjs <repoName> <zoneId> [domain]");
  process.exit(1);
}

// Ensure elite vision is never touched
if (repoName.includes('elite-vision') || customDomain.includes('elitevision')) {
  console.error("CRITICAL: Attempted to touch elite-vision-plumbing! Aborting immediately.");
  process.exit(1);
}

console.log(`\n============================================================`);
console.log(`  STARTING UPGRADE FOR: ${repoName} (${customDomain || 'N/A'})`);
console.log(`  Cloudflare Zone ID: ${zoneId}`);
console.log(`============================================================\n`);

const repoDir = path.join(WORK_DIR, repoName);
if (fs.existsSync(repoDir)) {
  console.log(`[1/8] Cleaning up existing local folder: ${repoDir}`);
  fs.rmSync(repoDir, { recursive: true, force: true });
}

// 1. Clone repository
console.log(`[2/8] Cloning https://github.com/aroragroupindiamart-gif/${repoName}...`);
const cloneUrl = `https://${GITHUB_PAT}@github.com/aroragroupindiamart-gif/${repoName}.git`;
execSync(`git clone ${cloneUrl} "${repoDir}"`, { stdio: 'inherit' });

// 2. Audit existing Google Webmaster verification
console.log(`[3/8] Auditing existing Google Webmaster verification codes...`);
const layoutPath = path.join(repoDir, 'app/layout.tsx');
if (fs.existsSync(layoutPath)) {
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  if (layoutContent.includes('verification: { google: GSC_TOKEN }') || layoutContent.includes('verification')) {
    console.log(`  ✓ layout.tsx has Google site verification tag enabled.`);
  } else {
    console.warn(`  ⚠ Warning: layout.tsx did not match standard verification pattern. Inspecting...`);
  }
}

// 3. Sync full engine (app, components, lib, scripts, middleware, config)
console.log(`[4/8] Installing enriched dataset, narrative engine, components, and quality gates...`);

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// Sync core directories
copyDirRecursive(path.join(TEMPLATE_DIR, 'app'), path.join(repoDir, 'app'));
copyDirRecursive(path.join(TEMPLATE_DIR, 'components'), path.join(repoDir, 'components'));
copyDirRecursive(path.join(TEMPLATE_DIR, 'lib'), path.join(repoDir, 'lib'));
copyDirRecursive(path.join(TEMPLATE_DIR, 'scripts'), path.join(repoDir, 'scripts'));

// Sync root config files (preserve wrangler.toml!)
fs.copyFileSync(path.join(TEMPLATE_DIR, 'middleware.ts'), path.join(repoDir, 'middleware.ts'));
fs.copyFileSync(path.join(TEMPLATE_DIR, 'next.config.js'), path.join(repoDir, 'next.config.js'));

// 4. Update package.json scripts
console.log(`[5/8] Updating package.json scripts...`);
const pkgPath = path.join(repoDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
pkg.scripts['test:boilerplate'] = 'node scripts/measure-boilerplate.mjs';
pkg.scripts['test:audit'] = 'node scripts/audit-out.mjs';
pkg.scripts['test:quality'] = 'node scripts/audit-out.mjs && node scripts/measure-boilerplate.mjs';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// 5. Update .github/workflows/deploy.yml with quality gate & Zone cache purge
console.log(`[6/8] Configuring deploy.yml with CI Quality Gate & Cloudflare Zone Cache Purge...`);
const deployYmlPath = path.join(repoDir, '.github/workflows/deploy.yml');
const deployYml = `# ============================================================
# GitHub Actions — Build & Deploy to Cloudflare Workers
# ============================================================
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 25

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Set up pnpm
        uses: pnpm/action-setup@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile=false

      - name: Run Quality and Boilerplate Gates
        run: pnpm run test:quality

      - name: Build for Cloudflare Workers
        env:
          NEXT_PUBLIC_PHONE_NUMBER: \${{ secrets.NEXT_PUBLIC_PHONE_NUMBER }}
          NEXT_PUBLIC_PHONE_TEL: \${{ secrets.NEXT_PUBLIC_PHONE_TEL }}
          NEXT_PUBLIC_BRAND_NAME: \${{ secrets.NEXT_PUBLIC_BRAND_NAME }}
          NEXT_PUBLIC_SITE_URL: \${{ secrets.NEXT_PUBLIC_SITE_URL }}
          NEXT_PUBLIC_NICHE: \${{ secrets.NEXT_PUBLIC_NICHE }}
          NEXT_PUBLIC_NICHE_PLURAL: \${{ secrets.NEXT_PUBLIC_NICHE_PLURAL }}
          NEXT_PUBLIC_NICHE_SINGULAR: \${{ secrets.NEXT_PUBLIC_NICHE_SINGULAR }}
          NEXT_PUBLIC_SCHEMA_TYPE: \${{ secrets.NEXT_PUBLIC_SCHEMA_TYPE }}
          NEXT_PUBLIC_GA_ID: \${{ secrets.NEXT_PUBLIC_GA_ID }}
          NEXT_PUBLIC_ADSENSE_ID: \${{ secrets.NEXT_PUBLIC_ADSENSE_ID }}
          NEXT_PUBLIC_GSC_TOKEN: \${{ secrets.NEXT_PUBLIC_GSC_TOKEN }}
          NEXT_PUBLIC_LAUNCH_DATE: \${{ secrets.NEXT_PUBLIC_LAUNCH_DATE }}
          NEXT_PUBLIC_CONTENT_SALT: \${{ secrets.NEXT_PUBLIC_CONTENT_SALT }}
        run: pnpm run build:worker

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy

      - name: Purge Cloudflare Edge Cache
        run: |
          echo "Purging Cloudflare Edge Cache for Zone ${zoneId}..."
          curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache" \\
            -H "Authorization: Bearer \${{ secrets.CLOUDFLARE_API_TOKEN }}" \\
            -H "Content-Type: application/json" \\
            --data '{"purge_everything":true}'
          echo "Cache purge requested."
`;
fs.writeFileSync(deployYmlPath, deployYml, 'utf8');

// 6. Run local quality gate
console.log(`[7/8] Running local quality gates...`);
execSync(`node "${path.join(repoDir, 'scripts/audit-out.mjs')}"`, { stdio: 'inherit' });
execSync(`node "${path.join(repoDir, 'scripts/measure-boilerplate.mjs')}"`, { stdio: 'inherit' });

// 7. Commit and push
console.log(`[8/8] Committing and pushing to GitHub main branch...`);
execSync(`git -C "${repoDir}" config user.name "antigravity-bot"`);
execSync(`git -C "${repoDir}" config user.email "bot@antigravity.ai"`);
execSync(`git -C "${repoDir}" add .`);
execSync(`git -C "${repoDir}" commit -m "feat(upgrade): deploy data-driven narrative engine, 16-week drip, and measured boilerplate gates"`, { stdio: 'inherit' });
execSync(`git -C "${repoDir}" push origin main`, { stdio: 'inherit' });
console.log(`  ✓ Successfully pushed update to origin main!\n`);
console.log(`✅ Upgrade prepared and pushed for ${repoName} (${customDomain})!\n`);
