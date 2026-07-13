import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface VersionSurface {
  name: string;
  version: string;
}

function readJson(path: string): Record<string, unknown> {
  const text = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  return JSON.parse(text) as Record<string, unknown>;
}

function readText(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function packageVersion(): string {
  const pkg = readJson("package.json");
  return String(pkg.version);
}

function serverInfoVersion(): string {
  const source = readText("src/server.ts");
  const match = source.match(
    /const\s+SERVER_INFO\s*=\s*{[\s\S]*?\bversion:\s*"([^"]+)"/,
  );

  if (!match) {
    throw new Error("src/server.ts SERVER_INFO version could not be found");
  }

  return match[1]!;
}

describe("version surfaces", () => {
  it("keeps package, registry, manifest, and MCP handshake versions in sync", () => {
    const pkgVersion = packageVersion();
    const server = readJson("server.json");
    const packages = Array.isArray(server.packages)
      ? (server.packages as Array<Record<string, unknown>>)
      : [];
    const manifest = readJson("manifest.json");

    const surfaces: VersionSurface[] = [
      { name: "package.json version", version: pkgVersion },
      { name: "server.json top-level version", version: String(server.version) },
      {
        name: "server.json packages[0].version",
        version: String(packages[0]?.version),
      },
      { name: "manifest.json top-level version", version: String(manifest.version) },
      { name: "src/server.ts SERVER_INFO version", version: serverInfoVersion() },
    ];

    for (const surface of surfaces) {
      expect(
        surface.version,
        `${surface.name} drifted to ${surface.version}; expected ${pkgVersion}`,
      ).toBe(pkgVersion);
    }
  });
});
