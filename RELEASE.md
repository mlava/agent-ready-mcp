# Release Procedure

This repo publishes `agent-ready-mcp`, the stdio MCP server for Agent Ready.
Follow this document when cutting a release.

## Version Surfaces

The release version must be identical in all five public surfaces:

1. `package.json` `version`
2. `server.json` top-level `version`
3. `server.json` `packages[0].version`
4. `manifest.json` top-level `version`
5. `src/server.ts` `SERVER_INFO` `version:`

Do not hand-edit those files for a release bump. `scripts/sync-server-version.mjs`
derives every secondary surface from `package.json` and is wired to the npm
`version` lifecycle hook. `npm version patch`, `npm version minor`, or
`npm version major` updates and stages the version surfaces in one version
commit. `test/version-sync.test.ts` guards this.

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. It uses
Node 20, installs with `npm ci`, then runs `npm run typecheck`, `npm test`, and
`npm run build`.

## Release Run

1. Start clean.

   ```bash
   git status --short
   ```

2. Install dependencies.

   ```bash
   npm ci
   ```

3. Run the local checks that CI and release will run.

   ```bash
   npm run typecheck
   npm test
   npm run build
   npm run pack
   ```

   `npm run pack` writes `agent-ready-mcp.mcpb` at the repo root. It refuses to
   pack if `package.json` and `manifest.json` disagree, or if
   `dist/mcp-server.mjs` has not been built.

4. Create the version commit and tag.

   ```bash
   npm version patch
   ```

   Use `npm version minor` or `npm version major` instead when the release
   warrants it.

5. Inspect the resulting version commit before pushing.

   ```bash
   git show --stat HEAD
   ```

   The stat must include the files that hold all five version surfaces:

   - `package.json`
   - `server.json` with both the top-level `version` and `packages[0].version`
   - `manifest.json`
   - `src/server.ts`

   `package-lock.json` will normally be present too because `npm version`
   updates it from `package.json`.

   Do not push if the commit only changed `package.json` and `server.json`.

6. Push the version commit.

   ```bash
   git push
   ```

7. Push the tag created by `npm version`. Replace `v0.5.1` if this release
   uses a different version.

   ```bash
   git push origin v0.5.1
   ```

## What The Tag Does

Pushing a `v*` tag triggers `.github/workflows/release.yml`. The workflow:

1. Checks out the tag.
2. Sets up Node 20 with npm registry publishing configured.
3. Runs `npm ci`.
4. Runs `npm run typecheck`.
5. Runs `npm test`.
6. Runs `npm run build`.
7. Runs `npm run pack` to build `agent-ready-mcp.mcpb`.
8. Downloads the latest `mcp-publisher` from `modelcontextprotocol/registry`.
9. Validates `server.json` with `mcp-publisher validate server.json`.
10. Publishes to npm with Sigstore provenance.
11. Authenticates to the official MCP registry with GitHub OIDC.
12. Publishes `server.json` to the official MCP registry.
13. Creates the GitHub Release for the tag and attaches `agent-ready-mcp.mcpb`.

The two orderings above are deliberate. Validation runs *before* npm publish
because npm versions are immutable — metadata the registry would reject has to
fail the release before the package is public. The GitHub Release is created
*last* because it is the public announcement: it should only exist once npm and
the registry have both accepted the version.

The workflow owns npm publishing, MCP registry publishing, and `.mcpb` bundle
upload. Never run `npm publish`, `mcp-publisher publish`, or manual bundle upload
for a release; doing that races the workflow.

The one repository secret required by the release workflow is `NPM_TOKEN`, an
npm automation token with publish access for `agent-ready-mcp`. The MCP registry
publish uses GitHub OIDC and does not use a stored registry secret.

## Manual Tail

After the workflow succeeds:

1. Review the GitHub Release created by the workflow and replace or edit the
   generated notes as needed.

### The `.mcpb` bundle

Releases **v0.1.1 through v0.4.0 each attached `agent-ready-mcp.mcpb`** (the Claude
Desktop Extension bundle). **v0.5.0 and v0.5.1 attached nothing** because packing was
manual and the generated bundle is gitignored. Keep the scripted `npm run pack` and
workflow upload in place so the bundle cannot silently disappear again.

The repo's `manifest.json` remains the v0.3 document consumed by Glama Marketplace.
`npm run pack` creates a temporary mcpb-conformed copy for the packer and must not
modify the checked-in manifest.

There is no LobeHub step. This server is **not listed on LobeHub** (verified
2026-07-13 with `lhm mcp search` — the sibling `scholar-sidekick-mcp` is listed, this
one is not, and `lobehub.com/mcp/<slug>` returns HTTP 200 for *any* slug because it
serves an SPA shell, so a 200 there proves nothing). Getting listed would need a
first-time `lhm plugin submit`, not a metadata refresh. If that ever happens, add the
refresh step back here.

## Immutable Registry Versions

MCP registry versions are immutable. Metadata in `server.json` cannot be edited
after publish, including:

- `title`
- `description`
- `websiteUrl`
- `icons`
- whether an environment variable `isRequired`

Audit the registry card metadata before tagging. A one-string metadata fix after
publish costs a full version bump.
