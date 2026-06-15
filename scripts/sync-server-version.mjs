// Keep every version surface in lockstep with package.json. Run automatically by
// the npm `version` lifecycle hook, so `npm version <bump>` updates all of them
// in a single version commit. Without this, the secondary surfaces drift behind
// package.json — which is how the v0.4.1 MCP-registry publish failed with
// "cannot publish duplicate version" (server.json stayed at 0.4.0).
//
// The version lives in FIVE places besides package.json:
//   - server.json            top-level `version` + each `packages[].version`
//   - manifest.json          top-level `version` (the .mcpb / DXT manifest)
//   - src/server.ts          SERVER_INFO.version (reported in the MCP handshake)
// package-lock.json is handled by `npm version` itself.

import { readFileSync, writeFileSync } from "node:fs";

const target = JSON.parse(readFileSync("package.json", "utf8")).version;
const SEMVER = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;

// server.json — JSON with two version fields. Reparse/serialize (2-space, file
// is canonical 2-space JSON so the diff stays minimal).
const server = JSON.parse(readFileSync("server.json", "utf8"));
server.version = target;
if (Array.isArray(server.packages)) {
  for (const p of server.packages) p.version = target;
}
writeFileSync("server.json", JSON.stringify(server, null, 2) + "\n");

// manifest.json — single top-level `"version": "x.y.z"`. Targeted replacement
// avoids reformatting the large tools/prompts payload.
const manifest = readFileSync("manifest.json", "utf8");
writeFileSync(
  "manifest.json",
  manifest.replace(
    new RegExp(`("version":\\s*")${SEMVER.source}(")`),
    `$1${target}$2`,
  ),
);

// src/server.ts — SERVER_INFO.version. Anchored to the name line so an unrelated
// `version:` elsewhere can't be hit.
const serverTs = readFileSync("src/server.ts", "utf8");
writeFileSync(
  "src/server.ts",
  serverTs.replace(
    new RegExp(`(name: "agent-ready",\\s*\\n\\s*version: ")${SEMVER.source}(")`),
    `$1${target}$2`,
  ),
);

console.log(`synced server.json, manifest.json, src/server.ts → ${target}`);
