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

export type ScanSiteInput = z.infer<z.ZodObject<typeof scanSiteInputShape>>;
export type GetScanInput = z.infer<z.ZodObject<typeof getScanInputShape>>;
