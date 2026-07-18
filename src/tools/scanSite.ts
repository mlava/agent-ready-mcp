import type { Config } from "../client.js";
import { ApiError, getScanFromApi, postAnonScan, postScan } from "../client.js";

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
  structuredContent?: Record<string, unknown>;
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

const ANON_TIER_NOTE =
  "Scanned on the anonymous free tier (3 scans per 30 days per IP, 25-page depth). " +
  "A Pro API key (AGENT_READY_API_KEY) unlocks 50 scans/month, 250-page depth, " +
  "scan history via get_scan, and weekly monitoring — https://agent-ready.dev/pricing";

export async function scanSite(
  config: Config,
  input: { url: string; pageLimit?: number },
): Promise<ToolResult> {
  // Keyless fallback: the public /api/scan path runs the scan synchronously
  // on the anonymous IP quota, so the tool works with zero configuration.
  // pageLimit is server-fixed at 25 on this path; the upsell note rides the
  // declared optional `message` field of scanOutputShape.
  if (!config.apiKey) {
    let res: { scan?: Record<string, unknown>; shareUrl?: string };
    try {
      res = (await postAnonScan(config, input.url)) as typeof res;
    } catch (err) {
      if (err instanceof ApiError) {
        const hint =
          err.status === 429
            ? " Set a Pro API key (AGENT_READY_API_KEY, from https://agent-ready.dev/dashboard/api-keys) to remove the anonymous cap."
            : "";
        throw new ToolError(err.code, err.message + hint);
      }
      throw err;
    }
    if (!res || typeof res !== "object" || !res.scan) {
      throw new ToolError(
        "invalid_response",
        "Anonymous scan returned no scan payload from /api/scan.",
      );
    }
    const payload = { ...res.scan, message: ANON_TIER_NOTE };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  }

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
      // Terminal state — return the full payload as both text and structured
      // content (validated against scanOutputShape by the SDK).
      return {
        content: [{ type: "text", text: JSON.stringify(last) }],
        structuredContent: last as unknown as Record<string, unknown>,
      };
    }
  }

  // Deadline hit while scan is still running. Return the placeholder so the
  // caller can poll later via get_scan.
  const running = {
    id: placeholder.id,
    status: "running" as const,
    url: input.url,
    pollUrl: placeholder.pollUrl ?? `/api/v1/scans/${placeholder.id}`,
    message:
      "Scan still running after the local poll deadline. Call get_scan with this id to fetch the final result.",
  };
  return {
    content: [{ type: "text", text: JSON.stringify(running) }],
    structuredContent: running,
  };
}
