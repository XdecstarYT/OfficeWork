/**
 * Builds src/data/templateIndex.json - the browse-level metadata for every
 * template in templates/.
 *
 * The Filing Cabinet only ever needs this metadata to render cards, search,
 * filter and sort. The heavy parts of a template (its `fields` array and
 * `bodyTemplate` string) are ~68% of the library's bytes and are only needed
 * once you actually open one, so they stay in the per-template JSON files and
 * get loaded on demand (see src/lib/templates.ts).
 *
 * Run with: npm run build:template-index
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(here, "..", "templates");
const outFile = path.join(here, "..", "src", "data", "templateIndex.json");
// Flat, minified copies served as plain static files. Keeping the filename
// equal to the template id means the app can build the URL from the id alone
// and needs no id -> path map in the bundle at all.
const publicDir = path.join(here, "..", "public", "templates");

interface TemplateFile {
  id: string;
  category: string;
  categoryId: string;
  subcategory: string;
  subcategoryId: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: "quick" | "standard" | "detailed";
  tags: string[];
  fields: unknown[];
  bodyTemplate: string;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".json") ? [full] : [];
  });
}

const files = walk(templatesDir).sort();
const templates = files.map((file) => {
  const t = JSON.parse(fs.readFileSync(file, "utf8")) as TemplateFile;
  const filename = path.basename(file, ".json");
  if (t.id !== filename) {
    throw new Error(`Template id "${t.id}" does not match its filename "${filename}" (${file})`);
  }
  return t;
});

const seen = new Set<string>();
for (const t of templates) {
  if (seen.has(t.id)) throw new Error(`Duplicate template id: ${t.id}`);
  seen.add(t.id);
}

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });
for (const t of templates) {
  fs.writeFileSync(path.join(publicDir, `${t.id}.json`), JSON.stringify(t));
}

const index = templates
  .map((t) => ({
    id: t.id,
    category: t.category,
    categoryId: t.categoryId,
    subcategory: t.subcategory,
    subcategoryId: t.subcategoryId,
    title: t.title,
    description: t.description,
    estimatedMinutes: t.estimatedMinutes,
    difficulty: t.difficulty,
    tags: t.tags,
    // Enough for the detail modal's summary line without loading the fields.
    fieldCount: t.fields.length,
    // Templates whose fields include a signature need manager sign-off; the
    // Filing Cabinet shows that before you open one.
    requiresApproval: (t.fields as { type?: string }[]).some((f) => f.type === "signature"),
  }))
  // Pre-sorted at build time so the app never pays for a 1100-element
  // localeCompare sort during startup.
  .sort((a, b) => a.title.localeCompare(b.title));

fs.writeFileSync(outFile, JSON.stringify(index));

const fullBytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
const indexBytes = fs.statSync(outFile).size;
console.log(`Indexed ${index.length} templates -> public/templates/`);
console.log(`  full library: ${(fullBytes / 1048576).toFixed(2)} MB`);
console.log(`  index:        ${(indexBytes / 1048576).toFixed(2)} MB (${((100 * indexBytes) / fullBytes).toFixed(1)}% of it)`);
