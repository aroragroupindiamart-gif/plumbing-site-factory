/**
 * A single append-only JSON file (`sites-registry.json`, committed to this
 * monorepo) that tracks every site launched via the site-factory tooling.
 *
 * This is the answer to "I want to change something on site X, how do I find
 * it?" at scale: instead of hunting through GitHub/Cloudflare dashboards for
 * one of 100+ repos, look the site up here by domain or siteId to get its
 * repo URL directly.
 *
 * This file lives in the monorepo, NOT in any individual generated site's
 * repo — it's the main agent's index across all sites, not something any
 * one site needs at runtime.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { SiteConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = join(__dirname, "sites-registry.json");

export interface SiteRegistryEntry {
  siteId: string;
  domain: string;
  githubOwner: string;
  repoUrl: string;
  templateRepo: string;
  brandName: string;
  niche: string;
  contentSalt: number;
  cloudflareZoneId?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface SiteRegistry {
  sites: SiteRegistryEntry[];
}

export function loadRegistry(): SiteRegistry {
  if (!existsSync(REGISTRY_PATH)) {
    return { sites: [] };
  }
  const raw = readFileSync(REGISTRY_PATH, "utf-8");
  return raw.trim() ? (JSON.parse(raw) as SiteRegistry) : { sites: [] };
}

function saveRegistry(registry: SiteRegistry): void {
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n", "utf-8");
}

/**
 * Adds a new site entry, or updates the existing one for the same siteId
 * (e.g. when setup-cloudflare-domain.ts later fills in cloudflareZoneId).
 */
export function upsertSiteEntry(entry: Omit<SiteRegistryEntry, "createdAt" | "updatedAt"> & { createdAt?: string }): void {
  const registry = loadRegistry();
  const now = new Date().toISOString();
  const existingIndex = registry.sites.findIndex((s) => s.siteId === entry.siteId);

  if (existingIndex >= 0) {
    registry.sites[existingIndex] = {
      ...registry.sites[existingIndex],
      ...entry,
      createdAt: registry.sites[existingIndex].createdAt,
      updatedAt: now,
    };
  } else {
    registry.sites.push({
      ...entry,
      createdAt: entry.createdAt ?? now,
      updatedAt: now,
    });
  }

  registry.sites.sort((a, b) => a.siteId.localeCompare(b.siteId));
  saveRegistry(registry);
}

export function registryEntryFromConfig(config: SiteConfig, contentSalt: number): Omit<SiteRegistryEntry, "createdAt" | "updatedAt"> {
  return {
    siteId: config.siteId,
    domain: config.domain,
    githubOwner: config.githubOwner,
    repoUrl: `https://github.com/${config.githubOwner}/${config.siteId}`,
    templateRepo: config.templateRepo,
    brandName: config.brandName,
    niche: config.niche,
    contentSalt,
  };
}

/** Finds a site by exact domain match (case-insensitive) or siteId. */
export function findSite(query: string): SiteRegistryEntry | undefined {
  const registry = loadRegistry();
  const normalized = query.trim().toLowerCase();
  return registry.sites.find(
    (s) => s.domain.toLowerCase() === normalized || s.siteId.toLowerCase() === normalized,
  );
}
