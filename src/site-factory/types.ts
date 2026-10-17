/**
 * Shape of a single site's configuration. This is the only thing that should
 * differ between sites generated from the plumbing-directory template — the
 * app code, data, and deploy pipeline stay identical across every site.
 */
export interface SiteConfig {
  /** Short machine-friendly id, e.g. "victor-moody-plumbing". Used as the GitHub repo name and Cloudflare Worker name. */
  siteId: string;

  /** GitHub org/user that will own the new repo, e.g. "aroragroupindiamart-gif". */
  githubOwner: string;

  /** Owner/repo of the template to generate from, e.g. "aroragroupindiamart-gif/plumbing-site-2". */
  templateRepo: string;

  /** Public brand name shown across the site. */
  brandName: string;

  /** Display phone number, e.g. "(800) 555-0000". */
  phoneNumber: string;

  /** Digits-only phone number for tel: links, e.g. "8005550000". */
  phoneTel: string;

  /** Production domain, e.g. "victormoodyplumbinginc.com" (no protocol, no trailing slash). */
  domain: string;

  /** Niche labels — same defaults as the plumbing template unless the niche itself changes. */
  niche: string;
  nichePlural: string;
  nicheSingular: string;
  schemaType: string;

  /** Optional analytics/verification values. Leave undefined to skip. */
  gaId?: string;
  adsenseId?: string;
  gscToken?: string;

  /** Optional drip-feeding count (e.g. 2 for initial 2 states rollout). Leave undefined for full release. */
  dripCount?: number;

  /** Optional launch date YYYY-MM-DD for automated drip-feeding. Defaults to current date. */
  launchDate?: string;

  /** Optional layout design concept ("dispatch" | "credential" | "journey" | "hyperlocal" | "onethumb"). Defaults to rotating based on salt. */
  designConcept?: "dispatch" | "credential" | "journey" | "hyperlocal" | "onethumb";
}

/**
 * Deterministic non-zero salt derived from siteId, used so each generated
 * site's spintax hashing (lib/spintax.ts selectVariant) doesn't line up
 * variant-for-variant with every other site sharing the same content pack
 * shape. Salt=0 is reserved for the live plumbing-directory template itself.
 */
export function siteContentSalt(siteId: string): number {
  let hash = 0;
  for (let i = 0; i < siteId.length; i++) {
    hash = (hash * 31 + siteId.charCodeAt(i)) % 100000;
  }
  return (hash % 9973) + 1;
}

/** Fields that must be set as GitHub Actions repo secrets for the deploy workflow to run. */
export function toRepoSecrets(config: SiteConfig, cloudflareAccountId: string, cloudflareApiToken: string): Record<string, string> {
  const secrets: Record<string, string> = {
    CLOUDFLARE_API_TOKEN: cloudflareApiToken,
    CLOUDFLARE_ACCOUNT_ID: cloudflareAccountId,
    NEXT_PUBLIC_BRAND_NAME: config.brandName,
    NEXT_PUBLIC_PHONE_NUMBER: config.phoneNumber,
    NEXT_PUBLIC_PHONE_TEL: config.phoneTel,
    NEXT_PUBLIC_SITE_URL: `https://${config.domain}`,
    NEXT_PUBLIC_NICHE: config.niche,
    NEXT_PUBLIC_NICHE_PLURAL: config.nichePlural,
    NEXT_PUBLIC_NICHE_SINGULAR: config.nicheSingular,
    NEXT_PUBLIC_SCHEMA_TYPE: config.schemaType,
    NEXT_PUBLIC_LAUNCH_DATE: config.launchDate || new Date().toISOString().split("T")[0],
  };
  if (config.gaId) secrets.NEXT_PUBLIC_GA_ID = config.gaId;
  if (config.adsenseId) secrets.NEXT_PUBLIC_ADSENSE_ID = config.adsenseId;
  if (config.gscToken) secrets.NEXT_PUBLIC_GSC_TOKEN = config.gscToken;
  if (config.dripCount !== undefined) secrets.NEXT_PUBLIC_DRIP_COUNT = String(config.dripCount);
  if (config.designConcept) secrets.NEXT_PUBLIC_DESIGN_CONCEPT = config.designConcept;
  secrets.NEXT_PUBLIC_CONTENT_SALT = String(siteContentSalt(config.siteId));
  return secrets;
}
