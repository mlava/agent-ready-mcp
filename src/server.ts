import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./client.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { getScanById } from "./tools/getScan.js";
import { scanSite, ToolError } from "./tools/scanSite.js";
import { askQuery } from "./tools/ask.js";
import { validateStructuredData } from "./tools/validateStructuredData.js";
import {
  askOutputShape,
  scanOutputShape,
  validateOutputShape,
} from "./output.js";
import {
  askInputShape,
  getScanInputShape,
  scanSiteInputShape,
  validateStructuredDataInputShape,
} from "./types.js";

const SERVER_INFO = {
  name: "agent-ready",
  version: "0.5.0",
} as const;

export function createMcpServer(config: Config): McpServer {
  const server = new McpServer(SERVER_INFO);

  // Annotations are mirrored from manifest.json. Glama and Lobehub probe the
  // runtime (tools/list response), not the manifest, so these must be passed
  // explicitly to registerTool — see scholar-sidekick-mcp v0.5.x for the
  // same gotcha.
  const READ_ONLY_OPEN_WORLD = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  } as const;

  server.registerTool(
    "scan_site",
    {
      title: "Scan a site for AI agent readability",
      description:
        "Runs the agent-ready.dev scanner against a URL and returns structured results: Vercel score, llmstxt.org score, and per-check findings with remediation hints. Scans may take up to ~60s; if the local poll deadline elapses, the tool returns the scan id and asks you to poll with get_scan.",
      inputSchema: scanSiteInputShape,
      outputSchema: scanOutputShape,
      annotations: READ_ONLY_OPEN_WORLD,
    },
    async (args) => {
      try {
        return await scanSite(config, args);
      } catch (err) {
        return toolErrorToContent(err);
      }
    },
  );

  server.registerTool(
    "get_scan",
    {
      title: "Get a previous scan by id",
      description:
        "Fetches a completed or in-progress scan by its id. Only scans owned by the authenticated API key's user are returned.",
      inputSchema: getScanInputShape,
      outputSchema: scanOutputShape,
      annotations: READ_ONLY_OPEN_WORLD,
    },
    async (args) => {
      try {
        return await getScanById(config, args);
      } catch (err) {
        return toolErrorToContent(err);
      }
    },
  );

  server.registerTool(
    "ask",
    {
      title: "Ask Agent Ready in natural language",
      description:
        "Natural-language search (NLWeb /ask) over Agent Ready's own content — scoring methodology, the check registry, the specs it validates, and the content library (explainers, comparisons, how-to guides, glossary). Public, no API key required. Returns Schema.org-typed result objects; optional itemType narrows to a corpus type and mode 'summarize' adds an extractive summary.",
      inputSchema: askInputShape,
      outputSchema: askOutputShape,
      annotations: READ_ONLY_OPEN_WORLD,
    },
    async (args) => {
      try {
        return await askQuery(config, args);
      } catch (err) {
        return toolErrorToContent(err);
      }
    },
  );

  server.registerTool(
    "validate_structured_data",
    {
      title: "Validate JSON-LD structured data",
      description:
        "Validates a page's (or a pasted) JSON-LD against Agent Ready's structured-data checks (schema lint + agent-coherence: freshness honesty, canonical/.md coherence, entity-name consistency, extraction signal) and returns a verdict with per-check fix guidance. Provide exactly one of `url` (fetch + validate) or `jsonld` (validate a string the agent just authored — no network needed). Public, no API key required. The one structured-data check the first-party validators (validator.schema.org, Rich Results Test) don't do.",
      inputSchema: validateStructuredDataInputShape,
      outputSchema: validateOutputShape,
      annotations: READ_ONLY_OPEN_WORLD,
    },
    async (args) => {
      try {
        return await validateStructuredData(config, args);
      } catch (err) {
        return toolErrorToContent(err);
      }
    },
  );

  registerPrompts(server);
  registerResources(server);

  return server;
}

function toolErrorToContent(err: unknown) {
  const error =
    err instanceof ToolError
      ? { code: err.code, message: err.message }
      : { code: "internal_error", message: "Tool invocation failed." };
  if (!(err instanceof ToolError)) {
    process.stderr.write(`MCP tool error: ${err instanceof Error ? err.message : String(err)}\n`);
  }
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error }) }],
  };
}
