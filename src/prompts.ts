import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Three discovery prompts. Mirror agent-ready's hosted server
// (src/lib/mcp/prompts.ts). Keep these aligned by review when either side
// changes.

const URL_DESCRIPTION =
  "Fully-qualified URL to scan (https://...). The scanner fetches this and crawls discovered internal pages up to the plan's page limit.";

const SCAN_ID_DESCRIPTION =
  "Scan id returned by an earlier scan_site call (10 characters).";

const FOCUS_DESCRIPTION =
  'Optional focus: "seo" to prioritise fixes that affect AI-Overview / ChatGPT citation, "agents" to prioritise fixes that affect MCP / A2A / agents.json clients. Defaults to a balanced plan.';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "scan",
    {
      title: "Scan a site for AI agent readability",
      description:
        "Run a fresh agent-readability scan against a URL and summarise the most important findings.",
      argsSchema: {
        url: z.string().describe(URL_DESCRIPTION),
      },
    },
    ({ url }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Use the scan_site tool from the agent-ready MCP server to scan ${url}.

Once the scan completes, summarise:
1. The overall Vercel agent-readability score (0–100) and its rating band.
2. The llms.txt sub-score, if applicable.
3. The 3–5 highest-impact failing checks and what they mean.
4. A short next-step recommendation.

If the scan returns a "running" placeholder, note the scan id and tell the user to ask you to call get_scan with that id in ~30 seconds.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "interpret_scan",
    {
      title: "Explain a previous scan in plain English",
      description:
        "Fetch a previous scan by id and translate the per-check findings into plain-English explanations.",
      argsSchema: {
        id: z.string().describe(SCAN_ID_DESCRIPTION),
      },
    },
    ({ id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Use the get_scan tool from the agent-ready MCP server with id="${id}".

For each failing or warning check, explain:
- What the check measures (in plain English, no spec jargon).
- Why it matters for AI agents (ChatGPT, Claude, Perplexity, MCP clients).
- What concrete change the site owner would make to pass it.

Group findings by category (site-wide / per-page / llms.txt / protocols). Lead with the overall score and rating band.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "remediation_plan",
    {
      title: "Produce a prioritised fix-it plan for a scan",
      description:
        "Fetch a scan by id and produce a prioritised, actionable remediation plan, optionally focused on SEO or agent-protocol fixes.",
      argsSchema: {
        id: z.string().describe(SCAN_ID_DESCRIPTION),
        focus: z.string().optional().describe(FOCUS_DESCRIPTION),
      },
    },
    ({ id, focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Use the get_scan tool from the agent-ready MCP server with id="${id}", then produce a prioritised remediation plan.

${focus ? `Focus area: ${focus}.` : "Cover both SEO/citation and agent-protocol surfaces."}

Group fixes into three buckets:
- **Now** — quick wins (≤30 min each), high impact.
- **Next** — medium-effort fixes (a few hours each).
- **Later** — structural changes (days of work).

For each fix include: the check id (e.g. P11, S15, L9), a one-sentence description, the concrete code/config change to make, and the expected impact ("unlocks 1 check" / "unlocks all 23 per-page checks" / etc.).

Skip checks that already pass.`,
          },
        },
      ],
    }),
  );
}
