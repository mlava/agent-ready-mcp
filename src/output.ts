import { z } from "zod";

// Output schemas for the tools. The MCP SDK validates each handler's
// `structuredContent` against these (safeParseAsync): unknown keys are ignored,
// but a *declared* field present with the wrong type — or a missing *required*
// field — throws and fails the call. So only fields guaranteed on every response
// variant are required. scan_site alone can return a full Scan, a "running"
// placeholder, or a "failed" scan; `id` and `status` are the only fields common
// to all three, hence everything else is optional/nullable.
//
// Shapes mirror the v1 REST contract (agent-ready/src/lib/api/schemas.ts) and
// the NLWeb /ask envelope. Keep in sync by review when that contract changes.

const checkResult = z.object({
  checkId: z.string(),
  name: z.string(),
  status: z.enum(["pass", "fail", "warn", "error"]),
  message: z.string(),
  howToFix: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).optional(),
});

const pageResult = z.object({
  url: z.string(),
  checks: z.array(checkResult),
});

// `scan_site` / `get_scan`: the v1 `Scan` (GET /api/v1/scans/{id}) plus the
// running placeholder `scan_site` returns when its local poll deadline elapses.
export const scanOutputShape = {
  id: z.string(),
  status: z.enum(["running", "completed", "failed"]),
  rootUrl: z.string().optional(),
  createdAt: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  pagesDiscovered: z.number().optional(),
  pagesScanned: z.number().optional(),
  vercelScore: z.number().optional(),
  vercelRating: z.string().optional(),
  llmstxtScore: z.number().optional(),
  siteChecks: z.array(checkResult).optional(),
  llmstxtChecks: z.array(checkResult).optional(),
  pageResults: z.array(pageResult).optional(),
  shareToken: z.string().optional(),
  // Present only on the running placeholder, not on a full Scan.
  url: z.string().optional(),
  pollUrl: z.string().optional(),
  message: z.string().optional(),
} as const;

// `validate_structured_data`: the D-series result from
// POST /api/v1/validate/structured-data (agent-ready/src/lib/validators/
// structured-data.ts → ValidateResult).
export const validateOutputShape = {
  mode: z.enum(["url", "paste"]),
  url: z.string().nullable(),
  checks: z.array(checkResult),
  summary: z.object({
    pass: z.number(),
    warn: z.number(),
    fail: z.number(),
    verdict: z.enum(["agent-ready", "needs-work", "not-agent-readable"]),
  }),
} as const;

const askResult = z.object({
  url: z.string().optional(),
  name: z.string().optional(),
  site: z.string().optional(),
  score: z.number().optional(),
  description: z.string().optional(),
  schema_object: z.record(z.string(), z.unknown()).optional(),
});

// `ask`: the NLWeb /ask envelope, passed through verbatim. Carries `results` on
// an answer or `error` on a failure (NO_RESULTS / RATE_LIMITED); both share
// `_meta`.
export const askOutputShape = {
  _meta: z
    .object({
      response_type: z.string(),
      version: z.string().optional(),
      mode: z.string().optional(),
    })
    .optional(),
  query_id: z.string().optional(),
  site: z.string().optional(),
  mode: z.string().optional(),
  query: z.string().optional(),
  results: z.array(askResult).optional(),
  summary: z.string().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
} as const;
