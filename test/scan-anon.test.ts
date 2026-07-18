import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMcpServer } from "../src/server.js";
import type { Config } from "../src/client.js";
import { scanSite, ToolError } from "../src/tools/scanSite.js";
import { getScanById } from "../src/tools/getScan.js";

const ANON_CONFIG: Config = {
  baseUrl: "https://agent-ready.dev",
  apiKey: null,
  scanTimeoutMs: 60_000,
  getTimeoutMs: 5_000,
};

const ORIGINAL_FETCH = globalThis.fetch;
const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const COMPLETED_SCAN = {
  id: "anon1",
  status: "completed",
  rootUrl: "https://example.com",
  createdAt: "2026-07-18T00:00:00.000Z",
  completedAt: "2026-07-18T00:01:00.000Z",
  pagesDiscovered: 1,
  pagesScanned: 1,
  vercelScore: 72,
  vercelRating: "good",
  llmstxtScore: 60,
  siteChecks: [],
  llmstxtChecks: [],
  pageResults: [],
  shareToken: "anon1",
};

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("scanSite without an API key", () => {
  it("falls back to the public /api/scan path without auth and notes the tier", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ scan: COMPLETED_SCAN, shareUrl: "/scan/anon1" }, 201),
    );

    const result = await scanSite(ANON_CONFIG, { url: "https://example.com" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://agent-ready.dev/api/scan");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      url: "https://example.com",
    });

    const structured = result.structuredContent!;
    expect(structured.status).toBe("completed");
    expect(structured.vercelScore).toBe(72);
    expect(String(structured.message)).toContain("anonymous free tier");
    expect(String(structured.message)).toContain("https://agent-ready.dev/pricing");
  });

  it("maps quota exhaustion to a ToolError carrying the reset date and Pro hint", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: "Free tier limit reached (3 scans per 30 days).",
          resetAt: "2026-08-13T00:00:00.000Z",
          upgrade: true,
        },
        429,
      ),
    );

    const err = await scanSite(ANON_CONFIG, { url: "https://example.com" }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ToolError);
    expect((err as ToolError).code).toBe("quota_exhausted");
    expect((err as ToolError).message).toContain("2026-08-13");
    expect((err as ToolError).message).toContain("AGENT_READY_API_KEY");
  });

  it("rejects a malformed anonymous response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ nope: true }, 201));
    const err = await scanSite(ANON_CONFIG, { url: "https://example.com" }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ToolError);
    expect((err as ToolError).code).toBe("invalid_response");
  });

  it("passes SDK output-schema validation end-to-end through the registered handler", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ scan: COMPLETED_SCAN, shareUrl: "/scan/anon1" }, 201),
    );

    const server = createMcpServer(ANON_CONFIG);
    interface RegisteredTools {
      _registeredTools: Record<
        string,
        { handler: (args: Record<string, unknown>) => Promise<unknown> }
      >;
    }
    const tools = (server as unknown as RegisteredTools)._registeredTools;
    const result = (await tools.scan_site!.handler({
      url: "https://example.com",
    })) as {
      isError?: boolean;
      structuredContent?: Record<string, unknown>;
    };

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent?.status).toBe("completed");
    expect(String(result.structuredContent?.message)).toContain(
      "anonymous free tier",
    );
  });
});

describe("getScanById without an API key", () => {
  it("explains that history needs a Pro key and scan_site works keyless", async () => {
    const err = await getScanById(ANON_CONFIG, { id: "abc" }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ToolError);
    expect((err as ToolError).code).toBe("missing_api_key");
    expect((err as ToolError).message).toContain("scan_site works without one");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
