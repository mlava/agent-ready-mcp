import type { Config } from "../client.js";
import { ApiError, getScanFromApi } from "../client.js";
import { ToolError } from "./scanSite.js";

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
}

export async function getScanById(
  config: Config,
  input: { id: string },
): Promise<ToolResult> {
  try {
    const scan = await getScanFromApi(config, input.id);
    return {
      content: [{ type: "text", text: JSON.stringify(scan) }],
      structuredContent: scan as Record<string, unknown>,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        throw new ToolError("not_found", `Scan ${input.id} not found.`);
      }
      if (err.code === "missing_api_key") {
        throw new ToolError(
          "missing_api_key",
          "get_scan needs a Pro API key (scan history is account-scoped). " +
            "scan_site works without one on the anonymous tier and returns its result inline. " +
            "Keys: https://agent-ready.dev/dashboard/api-keys",
        );
      }
      throw new ToolError(err.code, err.message);
    }
    throw err;
  }
}
