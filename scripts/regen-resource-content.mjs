// One-off regeneration: fetch the four hosted resources and rewrite
// src/resource-content.ts from them verbatim, so check-resource-drift.mjs
// goes green by construction. Mirrors the constant order and header comment
// of the existing file.
import { writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE = (
  process.env.AGENT_READY_API_URL ?? "https://agent-ready.dev"
).replace(/\/+$/, "");

const RESOURCES = [
  { uri: "agent-ready://methodology", constant: "METHODOLOGY_MD" },
  { uri: "agent-ready://checks", constant: "CHECKS_MD" },
  { uri: "agent-ready://llms.txt", constant: "LLMS_TXT" },
  { uri: "agent-ready://specs", constant: "SPECS_MD" },
];

const HEADER = `// Static markdown bodies served as MCP resources. Mirrored from
// agent-ready/src/lib/mcp/resource-content.ts. The checks table is a
// pre-rendered snapshot (the hosted side generates it dynamically from the
// CheckDefinition registry; this side embeds it as a constant string).
// Keep both sides in sync by review when content here changes.
`;

function toTemplateLiteral(text) {
  return "`" + text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
}

const client = new Client({ name: "resource-regen", version: "0.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/api/v1/mcp`));
await client.connect(transport);
const parts = [HEADER];
for (const { uri, constant } of RESOURCES) {
  const res = await client.readResource({ uri });
  const text = res.contents?.[0]?.text;
  if (typeof text !== "string") throw new Error(`no text for ${uri}`);
  parts.push(`\nexport const ${constant} = ${toTemplateLiteral(text)};\n`);
}
await client.close();
await writeFile("src/resource-content.ts", parts.join(""));
console.log("regenerated src/resource-content.ts from", BASE);
