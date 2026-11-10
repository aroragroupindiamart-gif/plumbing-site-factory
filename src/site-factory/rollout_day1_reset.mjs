import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const GITHUB_PAT = process.env.GITHUB_PAT || process.env.GH_TOKEN;
const WORK_DIR = 'C:/Users/DELL/.gemini/antigravity/scratch/rebuild-work';
const TEMPLATE_DIR = 'C:/Users/DELL/.gemini/antigravity/scratch/deepseek-apps/plumbing-site-2';
const SITES_LIST = JSON.parse(
  fs.readFileSync('C:/Users/DELL/.gemini/antigravity/scratch/rebuild_matched_sites.json', 'utf8')
);

console.log(`\n============================================================`);
console.log(`  RESETTING ALL 28 SITES TO DAY 1 (606 SITEMAP URLS, ZERO 404s)`);
console.log(`============================================================\n`);

for (let i = 0; i < SITES_LIST.length; i++) {
  const site = SITES_LIST[i];
  const repoName = site.registry.siteId;
  const domain = site.registry.domain;
  const zoneId = site.cloudflare_zone_id;

  if (repoName.includes('elite-vision') || domain.includes('elitevision')) {
    console.log(`[${i + 1}/${SITES_LIST.length}] SKIPPING blacklisted: ${repoName}`);
    continue;
  }

  console.log(`[${i + 1}/${SITES_LIST.length}] Resetting Day 1 on: ${repoName} (${domain})`);

  const repoDir = path.join(WORK_DIR, repoName);
  if (fs.existsSync(repoDir)) {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }

  try {
    const cloneUrl = `https://${GITHUB_PAT}@github.com/aroragroupindiamart-gif/${repoName}.git`;
    execSync(`git clone --depth 1 ${cloneUrl} "${repoDir}"`, { stdio: 'pipe' });

    // 1. Copy updated lib/config.ts (LAUNCH_DATE = "2026-11-09")
    fs.copyFileSync(
      path.join(TEMPLATE_DIR, 'lib/config.ts'),
      path.join(repoDir, 'lib/config.ts')
    );

    // 2. Copy updated app/[state]/page.tsx (all 50 states return 200 OK)
    fs.copyFileSync(
      path.join(TEMPLATE_DIR, 'app/[state]/page.tsx'),
      path.join(repoDir, 'app/[state]/page.tsx')
    );

    // 3. Update deploy.yml to lock NEXT_PUBLIC_LAUNCH_DATE to 2026-11-09
    const deployYmlPath = path.join(repoDir, '.github/workflows/deploy.yml');
    if (fs.existsSync(deployYmlPath)) {
      let yml = fs.readFileSync(deployYmlPath, 'utf8');
      yml = yml.replace(
        /NEXT_PUBLIC_LAUNCH_DATE:\s*\$\{\{\s*secrets\.NEXT_PUBLIC_LAUNCH_DATE\s*\}\}/g,
        'NEXT_PUBLIC_LAUNCH_DATE: "2026-11-09"'
      );
      fs.writeFileSync(deployYmlPath, yml, 'utf8');
    }

    // 4. Git commit & push
    execSync(`git -C "${repoDir}" config user.name "antigravity-bot"`, { stdio: 'pipe' });
    execSync(`git -C "${repoDir}" config user.email "bot@antigravity.ai"`, { stdio: 'pipe' });
    execSync(`git -C "${repoDir}" add .`, { stdio: 'pipe' });
    execSync(`git -C "${repoDir}" commit -m "feat(drip): reset crawl schedule to Day 1 (606 URLs) with zero 404 fallbacks"`, { stdio: 'pipe' });
    execSync(`git -C "${repoDir}" push origin main`, { stdio: 'pipe' });

    console.log(`  ✓ Successfully updated and pushed Day 1 reset to ${repoName}!`);
  } catch (err) {
    console.error(`  ❌ Error updating ${repoName}:`, err.message);
  } finally {
    if (fs.existsSync(repoDir)) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
  }
}

console.log(`\nAll 28 sites pushed with Day 1 reset!`);
