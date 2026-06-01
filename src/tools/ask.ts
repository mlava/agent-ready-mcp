import type { Config } from "../client.js";
import { ApiError, postAsk } from "../client.js";
import { ToolError } from "./scanSite.js";
import type { AskInput } from "../types.js";

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
}

// NLWeb `ask` — natural-language query over agent-ready.dev's own content.
// Thin wrapper over the public POST /api/v1/ask endpoint; the NLWeb envelope
// (answer or failure) is passed straight through as the tool result.
export async function askQuery(
  config: Config,
  input: AskInput,
): Promise<ToolResult> {
  try {
    const envelope = await postAsk(config, input);
    return { content: [{ type: "text", text: JSON.stringify(envelope) }] };
  } catch (err) {
    if (err instanceof ApiError) {
      throw new ToolError(err.code, err.message);
    }
    throw err;
  }
}
