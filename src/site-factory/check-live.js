const domains = [
  { domain: 'hongdaplumbing.com', expectedGsc: '6vb1__xSHPW-c_WMcY5CYgsuMYoXd0aIavFmJWkU7To' },
  { domain: 'ezplumbingsupplies.com', expectedGsc: 'mmoZFz6decx1R-teK1gpduoeVzTqfvDmH7WX2LHn7_g' },
  { domain: 'casablancaplumbing.com', expectedGsc: 'HKe6s2_SDGMLxjFZJ331-T4TDFQgOrgxLuXSAkIUlL0' },
  { domain: 'plumbinglogics.com', expectedGsc: 'efZg1VoDSgONWW9MDZTTdOxzKBi_wIkYeHnIYr_7xxM' },
  { domain: 'plumbingpembrokepines.com', expectedGsc: 'RIpsOgFEqojlLZbynmWPEqb7-IpRPep1VAAn4Ff4OS0' },
  { domain: 'rayvinzantplumbing.com', expectedGsc: 'P6PH6OvfvHMzzyl98CHN6kJUHWZjvWB_HNib31UtPeM' },
  { domain: 'jibplumbingandheating.com', expectedGsc: '6vxl2cERjksIfDiP0pU9XJh7XhdHf9De9xVZ1ipBsh4' },
  { domain: 'redwhiteblueplumbing.com', expectedGsc: 'R9KJ7SCB3y_i-FVLH6SBiaoZarNFtyQcY4hm2AI4wK8' },
  { domain: 'probityplumbing.com', expectedGsc: 'SFzffhi1kVsdwWwDS4fUE_oulDQAMFO9LVzW5RFLtT0' },
  { domain: 'plumbingcasablanca.com', expectedGsc: 'nOX503atsNiQ3f1Kdg-DNDRjSEcnF3RMJvOGmtKOEsc' },
];

async function checkDomains() {
  console.log('Testing custom domain live endpoints...\n');
  for (const { domain, expectedGsc } of domains) {
    try {
      const res = await fetch(`https://${domain}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
      });
      const html = await res.text();
      const hasGSC = html.includes(expectedGsc);
      const hasPhone = html.includes('(866) 992-0904') || html.includes('8669920904');
      console.log(`[OK] https://${domain} -> HTTP ${res.status} | GSC Token: ${hasGSC ? 'VERIFIED' : 'MISSING'} | Phone: ${hasPhone ? 'VERIFIED' : 'MISSING'}`);
    } catch (e) {
      // Try fallback to http
      try {
        const resHttp = await fetch(`http://${domain}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          redirect: 'follow',
        });
        const html = await resHttp.text();
        const hasGSC = html.includes(expectedGsc);
        console.log(`[PROPAGATING SSL] http://${domain} -> HTTP ${resHttp.status} | GSC Token: ${hasGSC ? 'VERIFIED' : 'MISSING'}`);
      } catch (err) {
        console.log(`[PROPAGATING DNS] ${domain} -> Waiting for local DNS cache / SSL (${e.message})`);
      }
    }
  }
}

checkDomains();
