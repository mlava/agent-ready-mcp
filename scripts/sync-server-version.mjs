// Keep server.json (the MCP registry manifest) in lockstep with package.json.
// Run automatically by the npm `version` lifecycle hook, so `npm version <bump>`
// updates both files in a single version commit. Without this, server.json's
// version drifts behind package.json and the MCP registry publish fails with
// "cannot publish duplicate version" (the registry also pins which npm version
// MCP clients install, so it must not lag).
//
// server.json carries the version in two places: the top-level `version` and
// each entry in `packages[].version`. Both are set to package.json's version.

import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const target = pkg.version;

const path = "server.json";
const server = JSON.parse(readFileSync(path, "utf8"));

server.version = target;
if (Array.isArray(server.packages)) {
  for (const p of server.packages) p.version = target;
}

// Preserve 2-space indentation + trailing newline (matches the committed file).
writeFileSync(path, JSON.stringify(server, null, 2) + "\n");
console.log(`synced server.json → ${target}`);
