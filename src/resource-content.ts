// Static markdown bodies served as MCP resources. Mirrored from
// agent-ready/src/lib/mcp/resource-content.ts. The checks table is a
// pre-rendered snapshot (the hosted side generates it dynamically from the
// CheckDefinition registry; this side embeds it as a constant string).
// Keep both sides in sync by review when content here changes.

export const METHODOLOGY_MD = `# How Agent Ready scores a site

> 59 checks across four categories, mapped to the Vercel Agent Readability Spec and the llmstxt.org standard. Every check is open and reproducible.

## What does Agent Ready measure?

Agent Ready is an independent validator for the [Vercel Agent Readability Spec](https://vercel.com/kb/guide/agent-readability-spec) and the [llmstxt.org standard](https://llmstxt.org). The score reports how well your site exposes itself to AI agents and LLM-based clients — the same way a Lighthouse score reports how well your site performs for human users. We fetch your URL once, fan out to the discovery files and well-known endpoints AI agents probe, and grade the result.

## How is the score calculated?

Two scores are reported: an overall agent readability score (0–100) and an llms.txt sub-score (0–100).

The overall score is a simple percentage: count of passing checks divided by total checks, rounded. Warns and fails both count against you; \`pass\` is the only state that earns credit. Checks marked \`unreliable\` by the JS-rendering check (P23) are excluded entirely so a single architectural choice doesn't penalise four dependent checks at once.

Rating bands:

| Score | Rating | Meaning |
|---|---|---|
| 90–100 | excellent | Ready for AI citation; all critical surfaces present. |
| 70–89 | good | Discoverable, but a few extractability gaps. |
| 50–69 | fair | Partial coverage; multiple required surfaces missing. |
| 0–49 | needs improvement | Not yet AI-readable; start with llms.txt and AGENTS.md. |

## Why is the llms.txt sub-score weighted differently?

The llmstxt.org spec treats some properties as foundational and others as optional. We mirror that with weights: structural checks (file accessible, H1 present, valid markdown) count 3×, content checks count 1×, and the optional \`llms-full.txt\` presence check counts 0.5×. The overall score is unweighted because every check on the Vercel spec is equally normative; the llmstxt.org spec is explicitly layered.

## How are JavaScript-rendered pages handled?

P23 detects pages where the static HTML response lacks data that only appears after client-side rendering — missing H1, empty body text, JSON-LD that injects after hydration. When P23 fires, the runner marks dependent checks (P10, P11, P12, P14) as \`unreliable\` and the scorer excludes them from both numerator and denominator. Without this, a single SPA architecture choice would compound into a 4-point score drop across unrelated checks.

## Where is the source for each check?

Every check is implemented as a single function in \`src/lib/checks/{site,page,llmstxt,protocol}/\`. The naming convention is \`{id}-{slug}.ts\` (e.g. \`p11-json-ld-fields.ts\`). Each file exports a check definition; the registry collects them into a single array that the runner iterates. One check per file — read the source to see exactly what is being asserted.

Full guide: <https://agent-ready.dev/methodology>
`;

export const CHECKS_MD = `# Agent Ready check registry

> 59 checks total across four categories. IDs are stable and referenced in every scan result's \`details\` array. Each check is implemented as a single function in \`src/lib/checks/{category}/{id}-{slug}.ts\` in the agent-ready repository.

## Site checks (15)

Run once per scan against the root URL. Cover discovery files (\`llms.txt\`, \`robots.txt\`, \`sitemap.xml\`, \`AGENTS.md\`), HTTPS, and the OpenAPI spec probe.

| ID | Check |
|---|---|
| S1 | llms.txt exists |
| S2 | llms.txt Content-Type |
| S3 | llms.txt not empty |
| S4 | llms.txt URL format |
| S5 | robots.txt — AI bots allowed |
| S6 | robots.txt — /llms.txt not blocked |
| S7 | robots.txt exists |
| S8 | sitemap.xml valid |
| S9 | sitemap.xml has lastmod |
| S10 | sitemap.md exists |
| S11 | sitemap.md has headings + links |
| S12 | AGENTS.md exists |
| S13 | AGENTS.md has required sections |
| S14 | HTTPS |
| S15 | Root OpenAPI spec |

## Page checks (23)

Run against every URL fetched in the scan. Cover HTTP semantics, metadata, JSON-LD, markdown mirrors, content negotiation, code-block language tags, and JS-rendering dependency.

| ID | Check |
|---|---|
| P1 | HTTP 200 |
| P2 | Redirect chain |
| P3 | Content-Type header |
| P4 | x-robots-tag |
| P5 | Canonical link |
| P6 | Meta description |
| P7 | og:title |
| P8 | og:description |
| P9 | HTML lang attribute |
| P10 | JSON-LD present |
| P11 | JSON-LD has required fields |
| P12 | Section headings |
| P13 | Text-to-HTML ratio |
| P14 | Glossary link |
| P15 | Markdown mirror exists |
| P16 | Markdown frontmatter |
| P17 | Alternate link (markdown) |
| P18 | Link header in markdown |
| P19 | Content negotiation |
| P20 | Sitemap section in markdown |
| P21 | Code block language tags |
| P22 | API schema link |
| P23 | JS rendering dependency |

## llms.txt checks (10)

Run when the site has an \`llms.txt\` file. Validate against the [llmstxt.org](https://llmstxt.org) specification. Weighted in the llms.txt sub-score: structural 3×, content 1×, \`llms-full.txt\` 0.5×.

| ID | Check |
|---|---|
| L1 | File accessible |
| L2 | H1 present |
| L3 | Valid markdown |
| L4 | Blockquote summary |
| L5 | H2 file-list sections |
| L6 | Link format correct |
| L7 | Links are accessible |
| L8 | Optional section used correctly |
| L9 | Content-Type: text/plain |
| L10 | llms-full.txt available |

## Protocol checks (11)

Discover-then-validate: when the relevant well-known endpoint returns 404, the check drops rather than failing. A marketing site doesn't score itself against agent manifests it has no reason to ship.

| ID | Check |
|---|---|
| C1 | MCP Server Card exists |
| C2 | MCP Server Card fields |
| C3 | MCP OAuth Protected Resource metadata |
| C4 | A2A Agent Card exists |
| C5 | A2A Agent Card fields |
| C6 | Wildcard agents.json |
| C7 | agent-permissions.json |
| C8 | UCP profile (/.well-known/ucp) |
| C9 | UCP OAuth Authorization Server metadata |
| C10 | x402 Payment Required response |
| C11 | x402 accepts entries |
`;

export const LLMS_TXT = `# Agent Ready

> Agent Ready is a free tool that scores any website against the Vercel Agent Readability Spec, the llmstxt.org specification, and agent-protocol specs (MCP, A2A, agents.json). It runs 59 checks and provides actionable fix guidance for every failing check.

This resource mirrors agent-ready.dev's own /llms.txt so MCP clients can introspect the same surface that ChatGPT, Perplexity, and other AI agents see when discovering Agent Ready as a tool.

## Tools

- Home: <https://agent-ready.dev>
- Agent Readability Score: <https://agent-ready.dev/agent-readability-score>
- llms.txt Checker: <https://agent-ready.dev/llms-txt-checker>
- AGENTS.md Validator: <https://agent-ready.dev/agents-md-validator>
- MCP Server Card Validator: <https://agent-ready.dev/mcp-card-validator>
- A2A Agent Card Validator: <https://agent-ready.dev/agent-card-validator>
- agents.json Validator: <https://agent-ready.dev/agents-json-validator>
- agent-permissions.json Validator: <https://agent-ready.dev/agent-permissions-validator>
- UCP Validator: <https://agent-ready.dev/ucp-validator>
- x402 Checker: <https://agent-ready.dev/x402-checker>
- API & integrations: <https://agent-ready.dev/docs/api>
- MCP server install guide: <https://agent-ready.dev/mcp>

## Specs

- Vercel Agent Readability Spec: <https://vercel.com/kb/guide/agent-readability-spec>
- llmstxt.org: <https://llmstxt.org>
- Model Context Protocol: <https://modelcontextprotocol.io>
- A2A Protocol: <https://a2a-protocol.org>
- Wildcard agents.json: <https://github.com/wild-card-ai/agents-json>
`;

export const SPECS_MD = `# Specs Agent Ready validates against

Agent Ready's 59 checks map to seven specifications. Each entry below links to the canonical document and notes the check IDs that implement it.

## Vercel Agent Readability Spec

Canonical: <https://vercel.com/kb/guide/agent-readability-spec>

Maintained on the Vercel Knowledge Base. Drives the S- (site, 15 checks), P- (page, 23 checks), and most C- (protocol) check series.

## llmstxt.org

Canonical: <https://llmstxt.org>

The \`llms.txt\` file specification (and the optional \`llms-full.txt\` companion). Drives the L1–L10 check series. Structural checks (file accessible, H1 present, valid markdown) carry 3× weight in the llms.txt sub-score; content checks 1×; \`llms-full.txt\` presence 0.5×.

## Model Context Protocol — Server Cards (SEP-1649)

Canonical: <https://modelcontextprotocol.io>
SEP: <https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649> (ratified 2025-11-25)

The discovery card published at \`/.well-known/mcp.json\`. Drives C1 (exists), C2 (required fields), and C3 (OAuth Protected Resource metadata per [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728)).

## A2A Protocol — Agent Cards

Canonical: <https://a2a-protocol.org>
Schema: a2a.proto v1.0.0

The agent card published at \`/.well-known/agent-card.json\`. Drives C4 (exists with correct Content-Type) and C5 (required fields).

## Wildcard agents.json

Canonical: <https://github.com/wild-card-ai/agents-json>
Version: v0.1.0 (pre-standard)

OpenAPI extension declaring which existing REST endpoints agents should call. Published at \`/agents.json\` or \`/.well-known/agents.json\`. Drives C6.

## agent-permissions.json

Discovery path: \`/.well-known/agent-permissions.json\` (preferred) or \`/agent-permissions.json\`

A manifest declaring per-path agent access policies. Drives C7.

## UCP — Unified Capability Profile

Discovery path: \`/.well-known/ucp\`

A composite profile that bundles OAuth authorization server metadata ([RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414)) with capability declarations. Drives C8 (profile exists) and C9 (OAuth Authorization Server metadata, gated on C8).

## x402 — HTTP 402 Payment Required

Reference: <https://www.x402.org>

Behavioural rather than manifest-based. Agent Ready probes the scanned URL preserving its path; if the response is HTTP 402 with valid \`accepts\` entries, C10 and C11 pass. Otherwise both drop.
`;
