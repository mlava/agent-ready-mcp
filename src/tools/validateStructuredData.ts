import type { Config } from "../client.js";
import { ApiError, postValidateStructuredData } from "../client.js";
import { ToolError } from "./scanSite.js";
import type { ValidateStructuredDataInput } from "../types.js";

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
}

// validate_structured_data — thin wrapper over the public
// POST /api/v1/validate/structured-data endpoint. Validates JSON-LD from a URL
// or a pasted body and returns the D-series structured-data checks.
export async function validateStructuredData(
  config: Config,
  input: ValidateStructuredDataInput,
): Promise<ToolResult> {
  const url = input.url?.trim();
  const jsonld = input.jsonld?.trim();
  // The endpoint requires exactly one of url/jsonld; reject ambiguous calls up
  // front so the agent gets a clear message instead of a 400.
  if (Boolean(url) === Boolean(jsonld)) {
    throw new ToolError(
      "invalid_request",
      "Provide exactly one of `url` (fetch + validate) or `jsonld` (validate a pasted string).",
    );
  }

  try {
    const result = await postValidateStructuredData(
      config,
      url ? { url } : { jsonld },
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent:
        result && typeof result === "object"
          ? (result as Record<string, unknown>)
          : {},
    };
  } catch (err) {
    if (err instanceof ApiError) {
      throw new ToolError(err.code, err.message);
    }
    throw err;
  }
}
