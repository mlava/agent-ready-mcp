// Guard against the pre-rendered MCP resource snapshots drifting from the
// hosted agent-ready.dev registry. The resource bodies in src/resource-content.ts
// are frozen copies of content the hosted side generates dynamically (the check
// registry grows as new checks ship). This script reads the live resources from
// the hosted MCP server — `resources/read` is public, no API key — and diffs them
// against the embedded constants. Run in a scheduled workflow so drift surfaces
// without an outbound dependency on every PR.
//
// Usage: node scripts/check-resource-drift.mjs
// Env:   AGENT_READY_API_URL (default https://agent-ready.dev)

import { build } from "esbuild";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE = (process.env.AGENT_READY_API_URL ?? "https://agent-ready.dev").replace(
  /\/+$/,
  "",
);

// agent-ready://<uri> → exported constant name in src/resource-content.ts
const RESOURCES = [
  { uri: "agent-ready://methodology", constant: "METHODOLOGY_MD" },
  { uri: "agent-ready://checks", constant: "CHECKS_MD" },
  { uri: "agent-ready://llms.txt", constant: "LLMS_TXT" },
  { uri: "agent-ready://specs", constant: "SPECS_MD" },
];

// Load the embedded constants. resource-content.ts is pure data with no runtime
// imports, so an in-memory esbuild bundle imported via a data: URL is enough —
// no build step, no tsx dependency.
async function loadLocalConstants() {
  const result = await build({
    entryPoints: ["src/resource-content.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript,${encodeURIComponent(code)}`);
}

async function readLiveResources() {
  const client = new Client({ name: "resource-drift-check", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${BASE}/api/v1/mcp`),
  );
  await client.connect(transport);
  try {
    const live = {};
    for (const { uri } of RESOURCES) {
      const res = await client.readResource({ uri });
      const text = res.contents?.[0]?.text;
      if (typeof text !== "string") {
        throw new Error(`Resource ${uri} returned no text content`);
      }
      live[uri] = text;
    }
    return live;
  } finally {
    await client.close();
  }
}

// Trailing-whitespace / final-newline differences are not meaningful drift.
const normalize = (s) => s.replace(/[ \t]+$/gm, "").replace(/\n+$/, "\n");

async function main() {
  const [local, live] = await Promise.all([
    loadLocalConstants(),
    readLiveResources(),
  ]);

  const drifted = [];
  for (const { uri, constant } of RESOURCES) {
    const embedded = local[constant];
    if (typeof embedded !== "string") {
      drifted.push(`${constant}: missing export in src/resource-content.ts`);
      continue;
    }
    if (normalize(embedded) !== normalize(live[uri])) {
      drifted.push(uri);
    }
  }

  if (drifted.length > 0) {
    console.error(
      `\n✖ Resource snapshot drift detected against ${BASE}:\n` +
        drifted.map((d) => `  - ${d}`).join("\n") +
        `\n\nThe embedded snapshots in src/resource-content.ts are stale.` +
        `\nRegenerate them from the hosted resources (or the upstream agent-ready` +
        `\nrepo's buildChecksMarkdown()/METHODOLOGY_MD/LLMS_TXT/SPECS_MD) and` +
        `\nupdate the counts in src/resources.ts, README.md, and test/server.test.ts.\n`,
    );
    process.exit(1);
  }

  console.log(
    `✓ All ${RESOURCES.length} resource snapshots match the live server at ${BASE}.`,
  );
}

main().catch((err) => {
  console.error("Resource drift check failed to run:", err);
  process.exit(1);
});
