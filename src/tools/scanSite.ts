import type { Config } from "../client.js";
import { ApiError, getScanFromApi, postScan } from "../client.js";

export class ToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
}

interface ScanPlaceholder {
  id: string;
  status: "running" | "queued";
  url?: string;
  pollUrl?: string;
  message?: string;
}

interface ScanResult {
  status?: string;
  id?: string;
}

const POLL_INTERVAL_MS = 2_000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scanSite(
  config: Config,
  input: { url: string; pageLimit?: number },
): Promise<ToolResult> {
  let placeholder: ScanPlaceholder;
  try {
    placeholder = (await postScan(config, {
      url: input.url,
      pageLimit: input.pageLimit,
    })) as ScanPlaceholder;
  } catch (err) {
    if (err instanceof ApiError) {
      throw new ToolError(err.code, err.message);
    }
    throw err;
  }

  if (!placeholder.id) {
    throw new ToolError(
      "invalid_response",
      "Scan accepted but no id returned from /api/v1/scans.",
    );
  }

  // The REST endpoint always returns 202 + a placeholder. Poll for completion
  // up to the configured scan timeout, then return whatever we have. Callers
  // can use get_scan with the id to fetch the final result later.
  const deadline = Date.now() + config.scanTimeoutMs;
  let last: ScanResult | ScanPlaceholder = placeholder;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    try {
      last = (await getScanFromApi(config, placeholder.id)) as ScanResult;
    } catch (err) {
      // Transient errors during polling — keep trying until the deadline.
      if (err instanceof ApiError && err.status === 429) {
        // Rate-limited reads — back off for one extra interval.
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      if (err instanceof ApiError && err.status === 404) {
        // Scan vanished — shouldn't happen, but surface it clearly.
        throw new ToolError(
          "not_found",
          `Scan ${placeholder.id} disappeared during polling.`,
        );
      }
      // Other errors: re-throw — the caller can decide whether to retry.
      if (err instanceof ApiError) {
        throw new ToolError(err.code, err.message);
      }
      throw err;
    }

    if (last && (last as ScanResult).status && (last as ScanResult).status !== "running") {
      // Terminal state — return the full payload.
      return { content: [{ type: "text", text: JSON.stringify(last) }] };
    }
  }

  // Deadline hit while scan is still running. Return the placeholder so the
  // caller can poll later via get_scan.
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          id: placeholder.id,
          status: "running",
          url: input.url,
          pollUrl: placeholder.pollUrl ?? `/api/v1/scans/${placeholder.id}`,
          message:
            "Scan still running after the local poll deadline. Call get_scan with this id to fetch the final result.",
        }),
      },
    ],
  };
}
