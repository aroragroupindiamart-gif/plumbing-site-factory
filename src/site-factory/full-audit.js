import dns from 'node:dns/promises';

const ALL_SITES = [
  { domain: 'hongdaplumbing.com', brand: 'Hongda Plumbing', gsc: '6vb1__xSHPW-c_WMcY5CYgsuMYoXd0aIavFmJWkU7To' },
  { domain: 'ezplumbingsupplies.com', brand: 'EZ Plumbing Supplies', gsc: 'mmoZFz6decx1R-teK1gpduoeVzTqfvDmH7WX2LHn7_g' },
  { domain: 'casablancaplumbing.com', brand: 'Casablanca Plumbing', gsc: 'HKe6s2_SDGMLxjFZJ331-T4TDFQgOrgxLuXSAkIUlL0' },
  { domain: 'plumbinglogics.com', brand: 'Plumbing Logics', gsc: 'efZg1VoDSgONWW9MDZTTdOxzKBi_wIkYeHnIYr_7xxM' },
  { domain: 'plumbingpembrokepines.com', brand: 'Plumbing PEM Broke Pines', gsc: 'RIpsOgFEqojlLZbynmWPEqb7-IpRPep1VAAn4Ff4OS0' },
  { domain: 'rayvinzantplumbing.com', brand: 'Rayvinzant Plumbing', gsc: 'P6PH6OvfvHMzzyl98CHN6kJUHWZjvWB_HNib31UtPeM' },
  { domain: 'jibplumbingandheating.com', brand: 'Jib Plumbing and Heating', gsc: '6vxl2cERjksIfDiP0pU9XJh7XhdHf9De9xVZ1ipBsh4' },
  { domain: 'redwhiteblueplumbing.com', brand: 'Red White Blue Plumbing', gsc: 'R9KJ7SCB3y_i-FVLH6SBiaoZarNFtyQcY4hm2AI4wK8' },
  { domain: 'probityplumbing.com', brand: 'Probity Plumbing', gsc: 'SFzffhi1kVsdwWwDS4fUE_oulDQAMFO9LVzW5RFLtT0' },
  { domain: 'plumbingcasablanca.com', brand: 'Plumbing Casa Blanca', gsc: 'nOX503atsNiQ3f1Kdg-DNDRjSEcnF3RMJvOGmtKOEsc' },
  { domain: 'cambridgeplumbings.com', brand: 'Cambridge Plumbings', gsc: null },
  { domain: 'fortifiedplumbingct.com', brand: 'Fortified Plumbing CT', gsc: null },
  { domain: 'plumbingcitruscounty.com', brand: 'Plumbing Citrus County', gsc: null },
];

async function diagnose() {
  console.log('='.repeat(80));
  console.log('FULL COMPREHENSIVE LIVE AUDIT OF ALL SITES (LOCAL + CLOUD)');
  console.log('='.repeat(80));

  const results = [];

  for (const site of ALL_SITES) {
    const report = {
      domain: site.domain,
      brand: site.brand,
      localDns: 'UNKNOWN',
      googleDns: 'UNKNOWN',
      httpsStatus: 'FAIL',
      sslValid: false,
      gscVerified: false,
      sitemapOk: false,
      error: null
    };

    // 1. Check Google DNS
    try {
      dns.setServers(['8.8.8.8']);
      const googleIps = await dns.resolve(site.domain);
      report.googleDns = googleIps.length > 0 ? googleIps.join(', ') : 'NONE';
    } catch (e) {
      report.googleDns = `ERR: ${e.code}`;
    }

    // 2. Check Local ISP DNS
    try {
      dns.setServers(['103.212.157.24']);
      const localIps = await dns.resolve(site.domain);
      report.localDns = localIps.length > 0 ? localIps.join(', ') : 'NONE';
    } catch (e) {
      report.localDns = `ERR: ${e.code}`;
    }

    // 3. Test HTTPS Fetch directly from this machine
    try {
      const res = await fetch(`https://${site.domain}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
      });
      report.httpsStatus = `HTTP ${res.status}`;
      report.sslValid = true;

      const html = await res.text();
      if (site.gsc && html.includes(site.gsc)) {
        report.gscVerified = true;
      }

      // 4. Test Sitemap
      const sitemapRes = await fetch(`https://${site.domain}/sitemap.xml`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (sitemapRes.status === 200) {
        report.sitemapOk = true;
      }
    } catch (e) {
      report.error = e.message;
    }

    results.push(report);
  }

  console.log('\nAudit Results Table:\n');
  console.table(results, ['domain', 'localDns', 'httpsStatus', 'sslValid', 'gscVerified', 'sitemapOk', 'error']);

  return results;
}

diagnose();
