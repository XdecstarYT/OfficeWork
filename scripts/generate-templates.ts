/**
 * One-time (re-runnable) seed script for the Office Quest template library.
 *
 * Walks the taxonomy (10 categories x ~10 subcategories) and, for each
 * subcategory, asks Claude for a batch of realistic document templates
 * matching the DocumentTemplate schema. Idempotent: a subcategory whose
 * output directory already has the target number of files is skipped.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/generate-templates.ts
 *   npx tsx scripts/generate-templates.ts --categories=correspondence,human-resources
 *   npx tsx scripts/generate-templates.ts --per-subcategory=3   (cheap smoke test)
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TAXONOMY } from "../src/data/taxonomy";
import type { DocumentTemplate, FieldType } from "../src/types/template";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_ROOT = path.join(__dirname, "..", "templates");
const MODEL = "claude-sonnet-5";

const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "date",
  "currency",
  "number",
  "checkbox",
  "select",
  "signature",
];

const args = process.argv.slice(2);
function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

const categoryFilter = argValue("categories")?.split(",").map((s) => s.trim());
const PER_SUBCATEGORY = Number(argValue("per-subcategory") ?? "10");

const fieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(FIELD_TYPES as [FieldType, ...FieldType[]]),
  required: z.boolean(),
  placeholder: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  helpText: z.string().nullable().optional(),
});

const templateSchema = z.object({
  title: z.string(),
  description: z.string(),
  estimatedMinutes: z.number().int().positive(),
  difficulty: z.enum(["quick", "standard", "detailed"]),
  tags: z.array(z.string()),
  fields: z.array(fieldSchema).min(3),
  bodyTemplate: z.string().min(50),
});

const batchSchema = z.object({
  templates: z.array(templateSchema),
});

type RawTemplate = z.infer<typeof templateSchema>;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "\nMissing ANTHROPIC_API_KEY.\n" +
      "Set it before running this script, e.g.:\n" +
      "  export ANTHROPIC_API_KEY=sk-ant-...\n" +
      "  npx tsx scripts/generate-templates.ts\n",
  );
  process.exit(1);
}

const client = new Anthropic();

const SUBMIT_TOOL: Anthropic.Tool = {
  name: "submit_templates",
  description:
    "Submit a batch of generated office document templates matching the required schema.",
  input_schema: {
    type: "object",
    properties: {
      templates: {
        type: "array",
        description: `An array of exactly ${PER_SUBCATEGORY} distinct document templates.`,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short, specific document title, e.g. 'Q3 Marketing Expense Report'." },
            description: { type: "string", description: "One or two sentence description of when/why someone fills this out." },
            estimatedMinutes: { type: "integer", description: "Realistic minutes to complete, typically 3-30." },
            difficulty: { type: "string", enum: ["quick", "standard", "detailed"] },
            tags: { type: "array", items: { type: "string" }, description: "3-6 lowercase search tags." },
            fields: {
              type: "array",
              description: "Form fields a user fills in to produce the document. At least 4 fields.",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "snake_case field id, referenced in bodyTemplate as {{id}}." },
                  label: { type: "string" },
                  type: { type: "string", enum: FIELD_TYPES },
                  required: { type: "boolean" },
                  placeholder: { type: "string" },
                  options: { type: "array", items: { type: "string" }, description: "Only for type=select." },
                  helpText: { type: "string" },
                },
                required: ["id", "label", "type", "required"],
              },
            },
            bodyTemplate: {
              type: "string",
              description:
                "The full document body, formatted like the real thing (letterhead-style headers, proper business formatting, line breaks). Reference field values with {{field_id}} tokens matching the fields array. No lorem ipsum or placeholder-y text - use realistic, plausible business language and structure.",
            },
          },
          required: ["title", "description", "estimatedMinutes", "difficulty", "tags", "fields", "bodyTemplate"],
        },
      },
    },
    required: ["templates"],
  },
};

async function countExisting(dir: string): Promise<number> {
  try {
    const files = await readdir(dir);
    return files.filter((f) => f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

async function generateForSubcategory(
  categoryName: string,
  categoryDescription: string,
  subcategoryName: string,
  subcategoryDescription: string,
): Promise<RawTemplate[]> {
  const system = `You are helping build a realistic office-paperwork simulation game called "Office Quest". \
Your job is to generate document TEMPLATES for a filing-cabinet style library of real business paperwork. \
Realism is the entire point: every template must read and format like an actual document a real office worker \
would produce - proper structure, plausible field names, real formatting conventions (letterhead-style headers \
for letters, line-item structure for invoices, numbered sections for reports, etc). Never use "Lorem ipsum" or \
generic placeholder text in the bodyTemplate - write real, plausible business prose with {{field_id}} tokens \
standing in for the user-entered values. Each of the ${PER_SUBCATEGORY} templates you generate must be a genuinely \
distinct document variant within the given subcategory (not just reworded versions of each other).`;

  const user = `Category: ${categoryName} - ${categoryDescription}
Subcategory: ${subcategoryName} - ${subcategoryDescription}

Generate exactly ${PER_SUBCATEGORY} distinct, realistic document templates for this subcategory and submit them via the submit_templates tool.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: user }],
    tools: [SUBMIT_TOOL],
    tool_choice: { type: "tool", name: "submit_templates" },
    output_config: { effort: "medium" },
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(`No tool_use block in response (stop_reason=${response.stop_reason})`);
  }

  const parsed = batchSchema.parse(toolUse.input);
  return parsed.templates;
}

async function main() {
  const categories = categoryFilter
    ? TAXONOMY.filter((c) => categoryFilter.includes(c.id))
    : TAXONOMY;

  if (categoryFilter && categories.length === 0) {
    console.error(`No categories matched filter: ${categoryFilter.join(", ")}`);
    process.exit(1);
  }

  let generatedCount = 0;
  let skippedCount = 0;

  for (const category of categories) {
    for (const subcategory of category.subcategories) {
      const dir = path.join(TEMPLATES_ROOT, category.id, subcategory.id);
      const existing = await countExisting(dir);

      if (existing >= PER_SUBCATEGORY) {
        console.log(`skip  ${category.id}/${subcategory.id} (${existing} already present)`);
        skippedCount += existing;
        continue;
      }

      process.stdout.write(`gen   ${category.id}/${subcategory.id} ... `);
      try {
        const raw = await generateForSubcategory(
          category.name,
          category.description,
          subcategory.name,
          subcategory.description,
        );

        await mkdir(dir, { recursive: true });

        for (let i = 0; i < raw.length; i++) {
          const t = raw[i];
          const id = `${subcategory.id}-${String(i + 1).padStart(2, "0")}`;
          const template: DocumentTemplate = {
            id,
            category: category.name,
            categoryId: category.id,
            subcategory: subcategory.name,
            subcategoryId: subcategory.id,
            title: t.title,
            description: t.description,
            estimatedMinutes: t.estimatedMinutes,
            difficulty: t.difficulty,
            tags: t.tags,
            fields: t.fields.map((f) => ({
              id: f.id,
              label: f.label,
              type: f.type,
              required: f.required,
              placeholder: f.placeholder ?? undefined,
              options: f.options ?? undefined,
              helpText: f.helpText ?? undefined,
            })),
            bodyTemplate: t.bodyTemplate,
          };
          await writeFile(
            path.join(dir, `${id}.json`),
            JSON.stringify(template, null, 2) + "\n",
            "utf-8",
          );
        }

        console.log(`done (${raw.length} templates)`);
        generatedCount += raw.length;
      } catch (err) {
        console.log("FAILED");
        console.error(`  ${category.id}/${subcategory.id}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log(
    `\nDone. Generated ${generatedCount} new templates, ${skippedCount} already existed.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
