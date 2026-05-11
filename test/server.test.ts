import { describe, expect, it } from "vitest";
import { createMcpServer } from "../src/server.js";
import type { Config } from "../src/client.js";

const TEST_CONFIG: Config = {
  baseUrl: "https://agent-ready.dev",
  apiKey: "ar_live_test_xxx",
  scanTimeoutMs: 60_000,
  getTimeoutMs: 5_000,
};

interface RegisteredCallback {
  callback: (args: Record<string, unknown>) => {
    messages: Array<{ role: string; content: { type: string; text: string } }>;
  };
}

interface RegisteredTools {
  _registeredTools: Record<
    string,
    { handler: (args: Record<string, unknown>) => Promise<unknown> }
  >;
}

interface RegisteredPrompts {
  _registeredPrompts: Record<string, RegisteredCallback>;
}

describe("createMcpServer", () => {
  it("registers scan_site and get_scan tools", () => {
    const server = createMcpServer(TEST_CONFIG);
    const tools = (server as unknown as RegisteredTools)._registeredTools;
    expect(Object.keys(tools).sort()).toEqual(["get_scan", "scan_site"]);
  });

  it("registers three discovery prompts", () => {
    const server = createMcpServer(TEST_CONFIG);
    const prompts = (server as unknown as RegisteredPrompts)._registeredPrompts;
    expect(Object.keys(prompts).sort()).toEqual([
      "interpret_scan",
      "remediation_plan",
      "scan",
    ]);
  });

  it("scan prompt mentions scan_site and threads the URL", () => {
    const server = createMcpServer(TEST_CONFIG);
    const prompts = (server as unknown as RegisteredPrompts)._registeredPrompts;
    const text = prompts.scan!.callback({ url: "https://example.com" })
      .messages[0]!.content.text;
    expect(text).toContain("scan_site");
    expect(text).toContain("https://example.com");
  });

  it("interpret_scan prompt references get_scan and the id", () => {
    const server = createMcpServer(TEST_CONFIG);
    const prompts = (server as unknown as RegisteredPrompts)._registeredPrompts;
    const text = prompts.interpret_scan!.callback({ id: "abc123" })
      .messages[0]!.content.text;
    expect(text).toContain("get_scan");
    expect(text).toContain("abc123");
  });

  it("remediation_plan prompt threads optional focus", () => {
    const server = createMcpServer(TEST_CONFIG);
    const prompts = (server as unknown as RegisteredPrompts)._registeredPrompts;
    const withFocus = prompts.remediation_plan!.callback({
      id: "xyz789",
      focus: "seo",
    }).messages[0]!.content.text;
    expect(withFocus).toContain("xyz789");
    expect(withFocus).toContain("Focus area: seo");

    const withoutFocus = prompts.remediation_plan!.callback({ id: "xyz789" })
      .messages[0]!.content.text;
    expect(withoutFocus).toContain("xyz789");
    expect(withoutFocus).toContain("SEO/citation and agent-protocol");
  });
});
