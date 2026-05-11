import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createConfig,
  getScanFromApi,
  postScan,
} from "../src/client.js";

const ORIGINAL_FETCH = globalThis.fetch;

describe("createConfig", () => {
  it("falls back to defaults when env is empty", () => {
    const config = createConfig({});
    expect(config.baseUrl).toBe("https://agent-ready.dev");
    expect(config.apiKey).toBe(null);
    expect(config.scanTimeoutMs).toBe(60_000);
    expect(config.getTimeoutMs).toBe(5_000);
  });

  it("strips trailing slashes from AGENT_READY_API_URL", () => {
    const config = createConfig({
      AGENT_READY_API_URL: "https://staging.example.com//",
    });
    expect(config.baseUrl).toBe("https://staging.example.com");
  });

  it("honours custom timeouts when finite", () => {
    const config = createConfig({
      AGENT_READY_SCAN_TIMEOUT_MS: "30000",
      AGENT_READY_GET_TIMEOUT_MS: "1500",
    });
    expect(config.scanTimeoutMs).toBe(30_000);
    expect(config.getTimeoutMs).toBe(1_500);
  });

  it("ignores garbage timeout values", () => {
    const config = createConfig({
      AGENT_READY_SCAN_TIMEOUT_MS: "not-a-number",
    });
    expect(config.scanTimeoutMs).toBe(60_000);
  });

  it("treats whitespace-only API key as absent", () => {
    const config = createConfig({ AGENT_READY_API_KEY: "   " });
    expect(config.apiKey).toBe(null);
  });
});

describe("REST client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  function makeResponse(status: number, body: unknown): Response {
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  it("throws missing_api_key when no key is configured", async () => {
    await expect(
      postScan(
        {
          baseUrl: "https://agent-ready.dev",
          apiKey: null,
          scanTimeoutMs: 1000,
          getTimeoutMs: 1000,
        },
        { url: "https://example.com" },
      ),
    ).rejects.toMatchObject({
      name: "ApiError",
      code: "missing_api_key",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends Bearer auth header on POST /api/v1/scans", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(202, {
        id: "abc1234567",
        status: "running",
        url: "https://example.com",
        pollUrl: "/api/v1/scans/abc1234567",
      }),
    );
    const result = (await postScan(
      {
        baseUrl: "https://agent-ready.dev",
        apiKey: "ar_live_test",
        scanTimeoutMs: 1000,
        getTimeoutMs: 1000,
      },
      { url: "https://example.com", pageLimit: 25 },
    )) as { id: string };

    expect(result.id).toBe("abc1234567");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://agent-ready.dev/api/v1/scans");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ar_live_test");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({
      url: "https://example.com",
      pageLimit: 25,
    });
  });

  it("URL-encodes scan ids on GET /api/v1/scans/{id}", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, { id: "weird/id" }));
    await getScanFromApi(
      {
        baseUrl: "https://agent-ready.dev",
        apiKey: "ar_live_test",
        scanTimeoutMs: 1000,
        getTimeoutMs: 1000,
      },
      "weird/id",
    );
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://agent-ready.dev/api/v1/scans/weird%2Fid");
  });

  it("surfaces structured API errors with their code and status", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(429, {
        error: { code: "rate_limited", message: "slow down" },
      }),
    );
    await expect(
      getScanFromApi(
        {
          baseUrl: "https://agent-ready.dev",
          apiKey: "ar_live_test",
          scanTimeoutMs: 1000,
          getTimeoutMs: 1000,
        },
        "abc1234567",
      ),
    ).rejects.toMatchObject({
      name: "ApiError",
      code: "rate_limited",
      status: 429,
    });
  });

  it("returns parsed JSON body on a successful GET", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(200, { id: "abc1234567", status: "complete", checks: [] }),
    );
    const result = (await getScanFromApi(
      {
        baseUrl: "https://agent-ready.dev",
        apiKey: "ar_live_test",
        scanTimeoutMs: 1000,
        getTimeoutMs: 1000,
      },
      "abc1234567",
    )) as { id: string; status: string };
    expect(result.id).toBe("abc1234567");
    expect(result.status).toBe("complete");
  });

  it("wraps non-Error throws as ApiError network_error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network kaput"));
    await expect(
      getScanFromApi(
        {
          baseUrl: "https://agent-ready.dev",
          apiKey: "ar_live_test",
          scanTimeoutMs: 1000,
          getTimeoutMs: 1000,
        },
        "abc1234567",
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
