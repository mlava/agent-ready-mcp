import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { getScanById } from "../src/tools/getScan.js";
import { scanSite } from "../src/tools/scanSite.js";
import { askQuery } from "../src/tools/ask.js";
import { askOutputShape, scanOutputShape } from "../src/output.js";
import type { Config } from "../src/client.js";

const ORIGINAL_FETCH = globalThis.fetch;

// The SDK validates each handler's structuredContent against these shapes at
// runtime; replicate that here so a schema/response drift fails the suite.
const scanOutput = z.object(scanOutputShape);
const askOutput = z.object(askOutputShape);

// A realistic full v1 Scan — mirrors agent-ready/src/lib/api/schemas.ts ScanSchema.
const FULL_SCAN = {
  id: "V1StGXR8_Z",
  rootUrl: "https://example.com",
  status: "completed",
  createdAt: "2026-06-02T00:00:00.000Z",
  completedAt: "2026-06-02T00:00:30.000Z",
  pagesDiscovered: 12,
  pagesScanned: 5,
  vercelScore: 82,
  vercelRating: "good",
  llmstxtScore: 70,
  siteChecks: [
    { checkId: "S1", name: "llms.txt exists", status: "pass", message: "ok", howToFix: null, details: {} },
  ],
  llmstxtChecks: [
    { checkId: "L1", name: "file accessible", status: "fail", message: "missing", howToFix: "add llms.txt", details: {} },
  ],
  pageResults: [
    {
      url: "https://example.com/",
      checks: [
        { checkId: "P11", name: "BreadcrumbList", status: "warn", message: "x", howToFix: null, details: { depth: 2 } },
      ],
    },
  ],
  shareToken: "tok_abc",
};

function makeResponse(status: number, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const CONFIG: Config = {
  baseUrl: "https://agent-ready.dev",
  apiKey: "ar_live_test",
  scanTimeoutMs: 60_000,
  getTimeoutMs: 5_000,
};

describe("tool structuredContent", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("get_scan returns a full Scan that satisfies scanOutputShape", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, FULL_SCAN));
    const result = await getScanById(CONFIG, { id: "V1StGXR8_Z" });
    expect(result.structuredContent).toBeDefined();
    expect(() => scanOutput.parse(result.structuredContent)).not.toThrow();
    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc.vercelScore).toBe(82);
    expect(sc.status).toBe("completed");
  });

  it("scan_site running placeholder satisfies scanOutputShape", async () => {
    // 202 placeholder; scanTimeoutMs 0 returns the placeholder without polling.
    fetchMock.mockResolvedValueOnce(
      makeResponse(202, {
        id: "abc",
        status: "running",
        url: "https://example.com",
        pollUrl: "/api/v1/scans/abc",
      }),
    );
    const result = await scanSite(
      { ...CONFIG, scanTimeoutMs: 0 },
      { url: "https://example.com" },
    );
    expect(result.structuredContent).toBeDefined();
    expect(() => scanOutput.parse(result.structuredContent)).not.toThrow();
    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc.status).toBe("running");
    expect(sc.id).toBe("abc");
  });

  it("ask answer envelope satisfies askOutputShape", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(200, {
        _meta: { response_type: "answer", version: "0.1", mode: "list" },
        query_id: "q1",
        site: "agent-ready.dev",
        mode: "list",
        query: "score",
        results: [
          {
            url: "https://agent-ready.dev/methodology",
            name: "How is the score calculated?",
            site: "agent-ready.dev",
            score: 4.747,
            description: "...",
            schema_object: { "@context": "https://schema.org", "@type": "Article" },
          },
        ],
      }),
    );
    const result = await askQuery(CONFIG, { q: "how is the score calculated" });
    expect(result.structuredContent).toBeDefined();
    expect(() => askOutput.parse(result.structuredContent)).not.toThrow();
  });

  it("ask failure envelope (NO_RESULTS) satisfies askOutputShape", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(404, {
        _meta: { response_type: "failure", version: "0.1", mode: "list" },
        error: { code: "NO_RESULTS", message: "no match" },
      }),
    );
    const result = await askQuery(CONFIG, { q: "zzz" });
    expect(result.structuredContent).toBeDefined();
    expect(() => askOutput.parse(result.structuredContent)).not.toThrow();
  });
});
