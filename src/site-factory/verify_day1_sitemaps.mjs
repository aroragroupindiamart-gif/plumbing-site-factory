import fs from 'fs';

const GITHUB_PAT = process.env.GITHUB_PAT || process.env.GH_TOKEN;
const SITES_LIST = JSON.parse(
  fs.readFileSync('C:/Users/DELL/.gemini/antigravity/scratch/rebuild_matched_sites.json', 'utf8')
);

async function checkSite(site) {
  const repoName = site.registry.siteId;
  const domain = site.registry.domain;

  let runData = { id: null, status: 'unknown', conclusion: 'unknown' };
  try {
    const r = await fetch(`https://api.github.com/repos/aroragroupindiamart-gif/${repoName}/actions/runs?per_page=1`, {
      headers: {
        'Authorization': 'token ' + GITHUB_PAT,
        'User-Agent': 'Antigravity'
      }
    });
    const data = await r.json();
    if (data.workflow_runs && data.workflow_runs.length > 0) {
      const run = data.workflow_runs[0];
      runData = {
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
      };
    }
  } catch (err) {
    runData.status = 'error';
  }

  let sitemapCount = null;
  let homeHttp = null;
  let gscPreserved = false;
  let stateHubHttp = null;
  let leafPageHttp = null;

  if (runData.status === 'completed' && runData.conclusion === 'success') {
    // 1. Check sitemap
    try {
      const smRes = await fetch(`https://${domain}/sitemap.xml`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000)
      });
      if (smRes.ok) {
        const text = await smRes.text();
        const matches = text.match(/<loc>/g);
        sitemapCount = matches ? matches.length : 0;
      }
    } catch (e) {
      sitemapCount = 'err';
    }

    // 2. Check homepage & verification
    try {
      const hRes = await fetch(`https://${domain}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000)
      });
      homeHttp = hRes.status;
      const html = await hRes.text();
      gscPreserved = html.includes('google-site-verification');
    } catch (e) {
      homeHttp = 'err';
    }

    // 3. Check non-dripped state hub (e.g. /vt or /wy) - MUST NOT 404!
    try {
      const stRes = await fetch(`https://${domain}/vt`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000)
      });
      stateHubHttp = stRes.status;
    } catch (e) {
      stateHubHttp = 'err';
    }

    // 4. Check non-dripped leaf page (e.g. /wy/thermopolis/toilet-repair) - MUST NOT 404!
    try {
      const lfRes = await fetch(`https://${domain}/wy/thermopolis/toilet-repair`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000)
      });
      leafPageHttp = lfRes.status;
    } catch (e) {
      leafPageHttp = 'err';
    }
  }

  return {
    repoName,
    domain,
    run: runData,
    sitemapCount,
    homeHttp,
    gscPreserved,
    stateHubHttp,
    leafPageHttp
  };
}

async function main() {
  console.log(`Checking Day 1 reset status across all ${SITES_LIST.length} sites...`);
  const results = [];
  for (let i = 0; i < SITES_LIST.length; i += 4) {
    const chunk = SITES_LIST.slice(i, i + 4);
    const chunkResults = await Promise.all(chunk.map(checkSite));
    results.push(...chunkResults);
  }

  const succeeded = results.filter(r => r.run.conclusion === 'success');
  const inProgress = results.filter(r => r.run.status === 'in_progress');
  const sitemaps606 = results.filter(r => r.sitemapCount === 606);

  console.log(`\n============================================================`);
  console.log(`DAY 1 RESET POLL SUMMARY:`);
  console.log(`  Total Sites: ${results.length}`);
  console.log(`  Deployed (Success): ${succeeded.length}`);
  console.log(`  In Progress: ${inProgress.length}`);
  console.log(`  Sitemaps at Exactly 606 URLs: ${sitemaps606.length}`);
  console.log(`============================================================\n`);

  console.log('| # | Domain | Run Status | Sitemap URLs | Home HTTP | State Hub (/vt) | Leaf (/wy/.../toilet-repair) | GSC Verified |');
  console.log('|---|---|---|---|---|---|---|---|');
  results.forEach((r, idx) => {
    const stat = r.run.status === 'completed' ? `completed (${r.run.conclusion})` : r.run.status;
    const sm = r.sitemapCount === 606 ? `✅ 606` : (r.sitemapCount || 'pending');
    const home = r.homeHttp || '-';
    const stateHub = r.stateHubHttp ? (r.stateHubHttp === 200 ? '✅ 200 OK' : `❌ ${r.stateHubHttp}`) : '-';
    const leaf = r.leafPageHttp ? (r.leafPageHttp === 200 ? '✅ 200 OK' : `❌ ${r.leafPageHttp}`) : '-';
    const gsc = r.gscPreserved ? '✅ Yes' : (r.run.conclusion === 'success' ? '❌ No' : 'pending');
    console.log(`| ${idx + 1} | ${r.domain} | ${stat} | ${sm} | ${home} | ${stateHub} | ${leaf} | ${gsc} |`);
  });
}

main();
