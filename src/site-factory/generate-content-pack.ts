/**
 * Generates a unique `content-pack.json` for a new niche-directory site using
 * an LLM, so that every site launched from the template has genuinely
 * different sentence-level wording instead of reusing the plumbing-directory
 * template's default 4 variants for every pool.
 *
 * This is invoked by create-site-repo.ts for new sites only. It must NEVER be
 * run against the live plumbing-directory repo's own content-pack.json,
 * since expanding/changing that file's arrays changes which variant every
 * existing page selects (see lib/spintax.ts selectVariant — the array length
 * is part of the hash), which would alter the live site's rendered output.
 *
 * Usage (standalone):
 *   pnpm --filter @workspace/scripts run site:generate-content-pack -- path/to/site-config.json > content-pack.json
 *
 * Requires env vars (auto-provisioned by the Anthropic AI integration):
 *   AI_INTEGRATIONS_ANTHROPIC_BASE_URL
 *   AI_INTEGRATIONS_ANTHROPIC_API_KEY
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { SiteConfig } from "./types.js";

const ContentPackSchema = z.object({
  intro: z.array(z.string()).min(4),
  body1: z.array(z.string()).min(4),
  body2: z.array(z.string()).min(4),
  trustBulletSets: z.array(z.array(z.string()).min(5)).min(3),
  faqCostAnswers: z.array(z.string()).min(2),
  faqArrivalAnswers: z.array(z.string()).min(2),
  faqBeforeArrivalAnswers: z.array(z.string()).min(2),
});

export type ContentPack = z.infer<typeof ContentPackSchema>;

const ALLOWED_PLACEHOLDERS = [
  "{kw}",
  "{kw0}",
  "{kw1}",
  "{cityName}",
  "{brandName}",
  "{nichePluralLower}",
  "{nicheLower}",
  "{phoneNumber}",
];

function buildPrompt(config: SiteConfig): string {
  return `You are writing template sentences for a programmatic local-services directory website (niche: "${config.niche}", brand name: "${config.brandName}"). These templates will be reused across thousands of city/service pages, with placeholder tokens substituted per page.

Return ONLY a single JSON object (no markdown fences, no commentary) with this exact shape:

{
  "intro": [string, ... at least 6 entries],
  "body1": [string, ... at least 6 entries],
  "body2": [string, ... at least 6 entries],
  "trustBulletSets": [ [string, ... exactly 5 entries], ... at least 4 sets ],
  "faqCostAnswers": [string, ... at least 3 entries],
  "faqArrivalAnswers": [string, ... at least 3 entries],
  "faqBeforeArrivalAnswers": [string, ... at least 3 entries]
}

Rules:
- Every sentence must read naturally for a "${config.niche}" service business.
- You MUST use only these placeholder tokens where relevant, written literally with curly braces: ${ALLOWED_PLACEHOLDERS.join(", ")}. Do not invent other placeholders. Do not use any placeholder that isn't in this list.
- "kw", "kw0", "kw1" are all service-keyword phrases (e.g. "drain cleaning") — use at most one of them per sentence.
- Vary sentence structure, tone, and word choice significantly across the entries within each pool — these must NOT feel like reworded copies of each other. This is the single most important requirement: real semantic and structural diversity, not synonym-swapping.
- Keep each sentence between 1 and 2 sentences long, similar in length to typical marketing copy (roughly 15-40 words).
- trustBulletSets entries are short trust-signal bullet phrases (3-10 words each), not full sentences.
- Do not mention competitors or make specific unverifiable claims (e.g. specific years in business, review counts, or awards).
- Output valid JSON only.`;
}

function stripPlaceholderViolations(pack: ContentPack): void {
  const placeholderRegex = /\{(\w+)\}/g;
  const allowedNames = new Set(ALLOWED_PLACEHOLDERS.map((p) => p.slice(1, -1)));
  const allStrings: string[] = [
    ...pack.intro,
    ...pack.body1,
    ...pack.body2,
    ...pack.trustBulletSets.flat(),
    ...pack.faqCostAnswers,
    ...pack.faqArrivalAnswers,
    ...pack.faqBeforeArrivalAnswers,
  ];
  for (const s of allStrings) {
    let match: RegExpExecArray | null;
    placeholderRegex.lastIndex = 0;
    while ((match = placeholderRegex.exec(s))) {
      if (!allowedNames.has(match[1])) {
        throw new Error(`Generated content pack used an unsupported placeholder "{${match[1]}}" in: "${s}"`);
      }
    }
  }
}

export async function generateContentPack(config: SiteConfig): Promise<ContentPack> {
  const anthropic = new Anthropic({
    apiKey: requireEnv("AI_INTEGRATIONS_ANTHROPIC_API_KEY"),
    baseURL: requireEnv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL"),
  });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: buildPrompt(config) }],
  });

  const block = message.content[0];
  const text = block.type === "text" ? block.text : "";
  const jsonText = extractJson(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Failed to parse generated content pack as JSON: ${(err as Error).message}\n\nRaw output:\n${text}`);
  }

  const pack = ContentPackSchema.parse(parsed);
  stripPlaceholderViolations(pack);
  return pack;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error("Usage: tsx generate-content-pack.ts <path-to-site-config.json>");
    process.exit(1);
  }
  const config: SiteConfig = JSON.parse(readFileSync(configPath, "utf-8"));
  const pack = await generateContentPack(config);
  process.stdout.write(JSON.stringify(pack, null, 2) + "\n");
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
