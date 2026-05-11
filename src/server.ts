import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./client.js";
import { registerPrompts } from "./prompts.js";
import { getScanById } from "./tools/getScan.js";
import { scanSite, ToolError } from "./tools/scanSite.js";
import { getScanInputShape, scanSiteInputShape } from "./types.js";

const SERVER_INFO = {
  name: "agent-ready",
  version: "0.1.0",
} as const;

export function createMcpServer(config: Config): McpServer {
  const server = new McpServer(SERVER_INFO);

  server.registerTool(
    "scan_site",
    {
      title: "Scan a site for AI agent readability",
      description:
        "Runs the agent-ready.dev scanner against a URL and returns structured results: Vercel score, llmstxt.org score, and per-check findings with remediation hints. Scans may take up to ~60s; if the local poll deadline elapses, the tool returns the scan id and asks you to poll with get_scan.",
      inputSchema: scanSiteInputShape,
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
    },
    async (args) => {
      try {
        return await getScanById(config, args);
      } catch (err) {
        return toolErrorToContent(err);
      }
    },
  );

  registerPrompts(server);

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
