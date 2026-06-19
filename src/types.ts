import { z } from "zod";

// Input shapes mirror agent-ready's hosted MCP server
// (src/lib/mcp/tools.ts:39-46). Keep these aligned by review when the
// hosted side changes.

export const scanSiteInputShape = {
  url: z
    .string()
    .url()
    .max(2000)
    .describe("Fully-qualified URL to scan, including scheme (https://...)."),
  pageLimit: z
    .number()
    .int()
    .min(1)
    .max(2000)
    .optional()
    .describe(
      "Optional maximum number of pages to crawl from the root URL. Capped by your plan (Free 25, Pro 250, Team 2000).",
    ),
} as const;

export const getScanInputShape = {
  id: z
    .string()
    .min(1)
    .max(100)
    .describe(
      "Scan id returned by a previous scan_site call (10-character nanoid).",
    ),
} as const;

export const askInputShape = {
  q: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      "Natural-language question about Agent Ready's scoring methodology, its check registry, the specs it validates, or its content library (explainers, comparisons, how-to guides, glossary).",
    ),
  itemType: z
    .enum(["methodology", "checks", "specs", "llms-txt", "check", "page", "any"])
    .optional()
    .describe(
      "Optional filter narrowing the search to one corpus type ('page' = explainers/guides/glossary).",
    ),
  mode: z
    .enum(["list", "summarize"])
    .optional()
    .describe("'summarize' adds an extractive summary over the top results."),
} as const;

// validate_structured_data — mirrors POST /api/v1/validate/structured-data,
// which accepts exactly one of `url` or `jsonld`. (The "exactly one"
// cross-field rule is enforced in the handler, not the per-field shape, since
// registerTool takes a ZodRawShape.)
export const validateStructuredDataInputShape = {
  url: z
    .string()
    .url()
    .max(2000)
    .optional()
    .describe(
      "URL of a page to fetch and validate its JSON-LD. Provide either url OR jsonld, not both.",
    ),
  jsonld: z
    .string()
    .max(100_000)
    .optional()
    .describe(
      "A raw JSON-LD string to validate directly (paste mode) — e.g. structured data an agent just authored. Provide either jsonld OR url, not both.",
    ),
} as const;

export type ScanSiteInput = z.infer<z.ZodObject<typeof scanSiteInputShape>>;
export type GetScanInput = z.infer<z.ZodObject<typeof getScanInputShape>>;
export type AskInput = z.infer<z.ZodObject<typeof askInputShape>>;
export type ValidateStructuredDataInput = z.infer<
  z.ZodObject<typeof validateStructuredDataInputShape>
>;
