import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type JsonObject = Record<string, unknown>;

function readServerJson(): JsonObject {
  const text = readFileSync(new URL("../server.json", import.meta.url), "utf8");
  return JSON.parse(text) as JsonObject;
}

function display(value: unknown): string {
  return JSON.stringify(value);
}

describe("server.json registry metadata", () => {
  it("declares the hosted remote MCP endpoint", () => {
    const server = readServerJson();
    const remotes = Array.isArray(server.remotes) ? server.remotes : [];
    const remote = remotes[0] as JsonObject | undefined;

    expect(remote, `server.json remotes[0] drifted to ${display(remote)}`).toBeDefined();
    expect(
      remote?.type,
      `server.json remotes[0].type drifted to ${display(remote?.type)}`,
    ).toBe("streamable-http");
    expect(
      remote?.url,
      `server.json remotes[0].url drifted to ${display(remote?.url)}`,
    ).toBe("https://agent-ready.dev/api/v1/mcp");
  });

  it("preserves the npm package and one-click install metadata", () => {
    const server = readServerJson();
    const packages = Array.isArray(server.packages) ? server.packages : [];
    const npmPackage = packages[0] as JsonObject | undefined;
    const transport = npmPackage?.transport as JsonObject | undefined;
    const environmentVariables = Array.isArray(npmPackage?.environmentVariables)
      ? npmPackage.environmentVariables
      : [];
    const apiKey = environmentVariables.find(
      (variable) => (variable as JsonObject).name === "AGENT_READY_API_KEY",
    ) as JsonObject | undefined;

    expect(
      npmPackage?.identifier,
      `server.json packages[0].identifier drifted to ${display(npmPackage?.identifier)}`,
    ).toBe("agent-ready-mcp");
    expect(
      transport?.type,
      `server.json packages[0].transport.type drifted to ${display(transport?.type)}`,
    ).toBe("stdio");
    expect(server.title, `server.json title drifted to ${display(server.title)}`).toBe(
      "Agent Ready",
    );
    expect(
      server.websiteUrl,
      `server.json websiteUrl drifted to ${display(server.websiteUrl)}`,
    ).toBeTruthy();
    expect(
      Array.isArray(server.icons) ? server.icons.length : server.icons,
      `server.json icons drifted to ${display(server.icons)}`,
    ).toBe(2);
    expect(
      apiKey?.isRequired,
      `server.json AGENT_READY_API_KEY.isRequired drifted to ${display(apiKey?.isRequired)}`,
    ).not.toBe(true);
  });
});
