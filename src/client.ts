// Minimal REST client for the agent-ready.dev API. The MCP package is a thin
// stdio→HTTPS wrapper: tool handlers call into this client, which sends
// Bearer-authenticated requests to the hosted REST endpoints.

export interface Config {
  baseUrl: string;
  apiKey: string | null;
  scanTimeoutMs: number;
  getTimeoutMs: number;
}

const DEFAULT_BASE_URL = "https://agent-ready.dev";
const DEFAULT_SCAN_TIMEOUT_MS = 60_000;
const DEFAULT_GET_TIMEOUT_MS = 5_000;

export function createConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const rawBase = env.AGENT_READY_API_URL ?? DEFAULT_BASE_URL;
  // Strip any trailing slash so we can append /api/v1/... cleanly.
  const baseUrl = rawBase.replace(/\/+$/, "");
  const apiKey = (env.AGENT_READY_API_KEY?.trim() ?? "") || null;

  const parsedScanTimeout = Number(env.AGENT_READY_SCAN_TIMEOUT_MS);
  const scanTimeoutMs = Number.isFinite(parsedScanTimeout) && parsedScanTimeout > 0
    ? parsedScanTimeout
    : DEFAULT_SCAN_TIMEOUT_MS;
  const parsedGetTimeout = Number(env.AGENT_READY_GET_TIMEOUT_MS);
  const getTimeoutMs = Number.isFinite(parsedGetTimeout) && parsedGetTimeout > 0
    ? parsedGetTimeout
    : DEFAULT_GET_TIMEOUT_MS;

  return { baseUrl, apiKey, scanTimeoutMs, getTimeoutMs };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchOptions {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  timeoutMs: number;
}

async function call<T>(config: Config, opts: FetchOptions): Promise<T> {
  if (!config.apiKey) {
    throw new ApiError(
      "missing_api_key",
      "AGENT_READY_API_KEY is not set. Issue a Pro API key from https://agent-ready.dev/dashboard/api-keys and set it in your MCP client config.",
    );
  }

  const url = `${config.baseUrl}${opts.path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json",
  };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ApiError(
        "timeout",
        `Request to ${opts.path} timed out after ${opts.timeoutMs}ms.`,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError("network_error", `Network error calling ${opts.path}: ${message}`);
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Non-JSON body — fall through with raw text in the error message
      // (rare; agent-ready always responds with JSON, but networks lie).
    }
  }

  if (!res.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error: { code?: string; message?: string } }).error
        : null;
    const code = detail?.code ?? `http_${res.status}`;
    const message =
      (detail?.message ?? text) || `HTTP ${res.status} from ${opts.path}`;
    throw new ApiError(code, message, res.status);
  }

  return payload as T;
}

export interface ScanRequestBody {
  url: string;
  pageLimit?: number;
}

// POST /api/scan is the public web-scan path: anonymous, IP-quota'd (3 scans
// per 30 days), 25-page depth, and synchronous — the 201 JSON body carries the
// finished scan as `{ scan, shareUrl }`. Keyless scan_site falls back to it so
// the tool works with zero configuration. Unlike the v1 routes, errors here
// are `{ error: string }`, with `resetAt` on the 429.
export async function postAnonScan(
  config: Config,
  url: string,
): Promise<unknown> {
  const path = "/api/scan";
  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(config.scanTimeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ApiError(
        "timeout",
        `Request to ${path} timed out after ${config.scanTimeoutMs}ms.`,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError("network_error", `Network error calling ${path}: ${message}`);
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Non-JSON body — surfaced via the error path below.
    }
  }

  if (!res.ok) {
    const body =
      payload && typeof payload === "object"
        ? (payload as { error?: unknown; resetAt?: unknown })
        : null;
    let message =
      typeof body?.error === "string" && body.error
        ? body.error
        : text || `HTTP ${res.status} from ${path}`;
    if (res.status === 429) {
      if (typeof body?.resetAt === "string") {
        message += ` Quota resets ${body.resetAt.slice(0, 10)}.`;
      }
      throw new ApiError("quota_exhausted", message, res.status);
    }
    throw new ApiError(`http_${res.status}`, message, res.status);
  }

  return payload;
}

export async function postScan(config: Config, body: ScanRequestBody): Promise<unknown> {
  return call(config, {
    method: "POST",
    path: "/api/v1/scans",
    body,
    timeoutMs: config.scanTimeoutMs,
  });
}

export async function getScanFromApi(config: Config, id: string): Promise<unknown> {
  return call(config, {
    method: "GET",
    path: `/api/v1/scans/${encodeURIComponent(id)}`,
    timeoutMs: config.getTimeoutMs,
  });
}

export interface AskRequestBody {
  q: string;
  itemType?: string;
  mode?: "list" | "summarize";
}

// POST /api/v1/ask is public (no API key required), and NLWeb returns an
// `_meta` envelope for both answers and failures — including NO_RESULTS (404)
// and RATE_LIMITED (429). So this has its own path rather than going through
// `call`: it doesn't require a key, sends one only if present, and passes the
// envelope through on 404/429 instead of throwing.
export async function postAsk(
  config: Config,
  body: AskRequestBody,
): Promise<unknown> {
  const url = `${config.baseUrl}/api/v1/ask`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const payloadBody = {
    query: { q: body.q, itemType: body.itemType },
    prefer: body.mode ? { mode: body.mode } : undefined,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payloadBody),
      signal: AbortSignal.timeout(config.getTimeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ApiError(
        "timeout",
        `Request to /api/v1/ask timed out after ${config.getTimeoutMs}ms.`,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError("network_error", `Network error calling /api/v1/ask: ${message}`);
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Non-JSON — fall through to the error path below.
    }
  }

  // Answers and failures both carry `_meta`; surface the envelope as-is.
  if (payload && typeof payload === "object" && "_meta" in payload) {
    return payload;
  }
  if (!res.ok) {
    throw new ApiError(`http_${res.status}`, text || `HTTP ${res.status}`, res.status);
  }
  return payload;
}

export interface ValidateRequestBody {
  url?: string;
  jsonld?: string;
}

// POST /api/v1/validate/structured-data is public (no API key required) — it
// validates JSON-LD from a URL or a pasted body synchronously. Like postAsk it
// has its own path: no key required, sent only if present.
export async function postValidateStructuredData(
  config: Config,
  body: ValidateRequestBody,
): Promise<unknown> {
  const path = "/api/v1/validate/structured-data";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.getTimeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ApiError(
        "timeout",
        `Request to ${path} timed out after ${config.getTimeoutMs}ms.`,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError("network_error", `Network error calling ${path}: ${message}`);
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Non-JSON — fall through to the error path below.
    }
  }

  if (!res.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error: { code?: string; message?: string } }).error
        : null;
    const code = detail?.code ?? `http_${res.status}`;
    const message = (detail?.message ?? text) || `HTTP ${res.status} from ${path}`;
    throw new ApiError(code, message, res.status);
  }

  return payload;
}
