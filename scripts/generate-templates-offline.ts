/**
 * Offline (no-API) bulk template generator.
 *
 * Unlike scripts/generate-templates.ts (which calls the Anthropic API), this
 * script builds templates procedurally from hand-authored per-subcategory
 * profiles (scripts/offline/profiles.ts) plus a shared document-shape
 * composer (scripts/offline/compose.ts). It needs no API key and runs
 * instantly, at the cost of variants within a subcategory sharing the same
 * field structure and body shape (they differ in title/description/tags,
 * like real scenario-specific business form variants do).
 *
 * Idempotent: a subcategory whose output directory already has the target
 * file count is skipped.
 *
 * Usage:
 *   npx tsx scripts/generate-templates-offline.ts
 *   npx tsx scripts/generate-templates-offline.ts --per-subcategory=5
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TAXONOMY } from "../src/data/taxonomy";
import type { DocumentTemplate } from "../src/types/template";
import { PROFILES } from "./offline/profiles";
import { buildFields, composeBody, estimateForVariant } from "./offline/compose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_ROOT = path.join(__dirname, "..", "templates");

const args = process.argv.slice(2);
function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}
const PER_SUBCATEGORY = Number(argValue("per-subcategory") ?? "11");

async function countExisting(dir: string): Promise<number> {
  try {
    const files = await readdir(dir);
    return files.filter((f) => f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Drops any flavor word that already appears in the noun, so titles/descriptions don't read "Academic Reference Reference Letter". */
function dedupeFlavor(flavor: string, noun: string): string {
  const nounWords = new Set(noun.split(/\s+/).map(normalizeWord).filter(Boolean));
  const flavorWords = flavor.split(/\s+/);
  const filtered = flavorWords.filter((w) => !nounWords.has(normalizeWord(w)));
  return filtered.length > 0 ? filtered.join(" ") : flavor;
}

function buildTitle(flavor: string, noun: string): string {
  if (flavor === "General") return noun;
  return `${dedupeFlavor(flavor, noun)} ${noun}`;
}

function buildDescription(purpose: string, flavor: string, noun: string): string {
  const capitalized = purpose.charAt(0).toUpperCase() + purpose.slice(1);
  if (flavor === "General") {
    return `${capitalized}.`;
  }
  const phrase = `${dedupeFlavor(flavor, noun)} ${noun}`.toLowerCase();
  const article = /^[aeiou]/.test(phrase) ? "An" : "A";
  return `${article} ${phrase} — ${purpose}.`;
}

function buildTags(subcategoryId: string, noun: string, flavor: string): string[] {
  const nounWords = noun.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const tags = new Set<string>([
    ...nounWords.slice(0, 2),
    flavor.toLowerCase().split(/\s+\/\s+|\s+/)[0],
    subcategoryId.replace(/-/g, " "),
  ]);
  return [...tags].slice(0, 5);
}

async function main() {
  let generated = 0;
  let skipped = 0;
  const seenSubcategoryIds = new Set<string>();

  for (const profile of PROFILES) {
    seenSubcategoryIds.add(profile.subcategoryId);

    let category = null;
    let subcategory = null;
    for (const c of TAXONOMY) {
      const sub = c.subcategories.find((s) => s.id === profile.subcategoryId);
      if (sub) {
        category = c;
        subcategory = sub;
        break;
      }
    }
    if (!category || !subcategory) {
      console.warn(`No taxonomy entry for subcategory "${profile.subcategoryId}" - skipping.`);
      continue;
    }

    const dir = path.join(TEMPLATES_ROOT, category.id, subcategory.id);
    const existing = await countExisting(dir);
    const targetCount = Math.min(PER_SUBCATEGORY, profile.flavors.length);

    if (existing >= targetCount) {
      console.log(`skip  ${category.id}/${subcategory.id} (${existing} already present)`);
      skipped += existing;
      continue;
    }

    await mkdir(dir, { recursive: true });
    const fields = buildFields(profile.docKind, profile.extraFields ?? [], profile.overrides ?? {});

    for (let i = 0; i < targetCount; i++) {
      const flavor = profile.flavors[i];
      const id = `${subcategory.id}-${String(i + 1).padStart(2, "0")}`;
      const title = buildTitle(flavor, profile.noun);
      const { minutes, difficulty } = estimateForVariant(profile.docKind, i);
      const contextLine =
        flavor === "General" ? null : `${flavor} — ${profile.purpose}.`;

      const template: DocumentTemplate = {
        id,
        category: category.name,
        categoryId: category.id,
        subcategory: subcategory.name,
        subcategoryId: subcategory.id,
        title,
        description: buildDescription(profile.purpose, flavor, profile.noun),
        estimatedMinutes: minutes,
        difficulty,
        tags: buildTags(subcategory.id, profile.noun, flavor),
        fields,
        bodyTemplate: composeBody(profile.docKind, profile.noun, fields, contextLine),
      };

      await writeFile(
        path.join(dir, `${id}.json`),
        JSON.stringify(template, null, 2) + "\n",
        "utf-8",
      );
    }

    console.log(`gen   ${category.id}/${subcategory.id} (${targetCount} templates)`);
    generated += targetCount;
  }

  const missing = TAXONOMY.flatMap((c) => c.subcategories)
    .filter((s) => !seenSubcategoryIds.has(s.id) && s.id !== "expense-reports" && s.id !== "blank-documents");
  if (missing.length) {
    console.warn(`\nNo profile defined for ${missing.length} subcategories:`, missing.map((s) => s.id));
  }

  console.log(`\nDone. Generated ${generated} new templates, ${skipped} already existed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
