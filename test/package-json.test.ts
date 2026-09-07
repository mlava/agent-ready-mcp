import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

describe("npm package surface", () => {
  const pkg = JSON.parse(read("package.json")) as {
    description: string;
    files: string[];
  };

  it("description carries the current check count and fits npm's listing", () => {
    // Keep in step with the registry total in README/manifest/resources.
    expect(pkg.description).toContain("72 checks");
    // npmjs.com clips long descriptions mid-word ("...70 checks with p").
    expect(pkg.description.length).toBeLessThanOrEqual(220);
  });

  it("ships our own README and LICENSE, not a bystander's", () => {
    // v0.1.1–v0.7.6 published the MCP Registry project's README/LICENSE
    // because release.yml untarred mcp-publisher into the repo root.
    expect(pkg.files).toContain("README.md");
    expect(pkg.files).toContain("LICENSE");
    expect(read("README.md").split("\n")[0]).toBe("# agent-ready-mcp");
    expect(read("LICENSE").split("\n")[0]).toBe("MIT License");
  });
});
