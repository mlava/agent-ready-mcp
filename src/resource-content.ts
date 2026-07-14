// Static markdown bodies served as MCP resources. Mirrored from
// agent-ready/src/lib/mcp/resource-content.ts. The checks table is a
// pre-rendered snapshot (the hosted side generates it dynamically from the
// CheckDefinition registry; this side embeds it as a constant string).
// Keep both sides in sync by review when content here changes.

export const METHODOLOGY_MD = `# How Agent Ready scores a site

> 69 checks across four categories, mapped to the Vercel Agent Readability Spec and the llmstxt.org standard. Every check is open and reproducible.

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

> 69 checks total across four categories. IDs are stable and referenced in every scan result's \`details\` array. Each check is implemented as a single function in \`src/lib/checks/{category}/{id}-{slug}.ts\` in the agent-ready repository.

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

## Protocol checks (21)

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
| C12 | NLWeb endpoint |
| C13 | API Catalog (RFC 9727) |
| C14 | Web Bot Auth directory |
| C15 | Agent Skills Discovery |
| C16 | Content parity (no cloaking) |
| C17 | Agent-driven UI (A2UI) |
| C18 | MPP Payment challenge |
| C19 | MPP challenge params |
| C20 | AP2 payment protocol support |
| C21 | ACP profile (/.well-known/acp.json) |
`;

export const LLMS_TXT = `# Agent Ready

> Agent Ready is a free tool that scores any website against the Vercel Agent Readability Spec, the llmstxt.org specification, and agent-protocol specs (MCP, A2A, agents.json). It runs 69 checks and provides actionable fix guidance for every failing check.

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

// Mirror of the main repo's generated \`agent-ready://specs\` resource
// (src/lib/mcp/resource-content.ts → buildSpecsMarkdown(), sourced from
// src/lib/specs.ts). This standalone package can't import the main repo's
// modules, so it holds a frozen snapshot — regenerate and paste when the
// upstream spec registry changes.
export const SPECS_MD = `# Specs Agent Ready validates against

Agent Ready's checks map to the specifications below. Each entry links to the canonical document (where one exists) and notes the check IDs that implement it. Entries marked \`pre-standard\` are drafts or emerging conventions; \`behavioural\` entries have no published document. Protocol (C) checks are reported but unscored.

## Readability

- **Vercel Agent Readability Spec** — The core spec for exposing a site to AI agents — discovery files, structured data, clean HTML, and markdown mirrors. Drives most site (S) and every page (P) check. Canonical: <https://vercel.com/kb/guide/agent-readability-spec> Checks: S5–S15, P1–P23.
- **llmstxt.org** — The /llms.txt curated-context file (and optional llms-full.txt companion). Structural checks carry 3× weight in the llms.txt sub-score. Canonical: <https://llmstxt.org> Checks: S1–S4, L1–L10.

## Agent protocols

- **MCP Server Cards (SEP-1649)** — The Model Context Protocol discovery card at /.well-known/mcp.json — its presence (C1) and required fields (C2). Canonical: <https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649> Checks: C1, C2.
- **OAuth Protected Resource Metadata (RFC 9728)** — Protected-resource metadata an MCP server advertises so agents can locate its authorization server. Canonical: <https://datatracker.ietf.org/doc/html/rfc9728> Checks: C3.
- **A2A Protocol — Agent Cards** — The agent card at /.well-known/agent-card.json that lets agents discover and call other agents — existence with correct Content-Type (C4) and required fields (C5). Canonical: <https://a2a-protocol.org/v1.0.0/specification> Checks: C4, C5.
- **Wildcard agents.json** _(pre-standard)_ — An OpenAPI extension declaring which existing REST endpoints agents should call. Pre-standard (v0.1.0). Canonical: <https://github.com/wild-card-ai/agents-json> Checks: C6.
- **agent-permissions.json** _(pre-standard)_ — A manifest declaring per-path agent access policies, served at /.well-known/agent-permissions.json. No canonical spec document yet — defined by the discovery path. Canonical: <https://github.com/las-wg/agent-permissions.json/blob/main/README.md> Checks: C7.
- **UCP — Unified Capability Profile** — A composite profile at /.well-known/ucp bundling OAuth authorization-server metadata with capability declarations. Canonical: <https://ucp.dev/2026-04-08/specification/overview/> Checks: C8.
- **OAuth Authorization Server Metadata (RFC 8414)** — The authorization-server metadata a UCP profile references so agents can complete an OAuth flow. Gated on C8. Canonical: <https://datatracker.ietf.org/doc/html/rfc8414> Checks: C9.
- **ACP — Agentic Commerce Protocol** _(pre-standard)_ — OpenAI and Stripe's agentic-commerce standard. Sellers advertise support via a discovery document at /.well-known/acp.json declaring protocol version, transports, and capabilities (C21). Pre-standard — the discovery RFC is a Proposal. Canonical: <https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/rfcs/rfc.discovery.md> Checks: C21.

## Payments

- **x402 — HTTP 402 Payment Required** — A behavioural payments scheme: a paid endpoint answers with HTTP 402 and a JSON body carrying an accepts array — the 402 response (C10) and valid accepts entries (C11). Canonical: <https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md> Checks: C10, C11.
- **MPP — Machine Payments Protocol** _(pre-standard)_ — The Stripe- and Tempo-authored "Payment" HTTP auth scheme on the IETF standards track — the WWW-Authenticate: Payment challenge (C18) and its required params (C19). Canonical: <https://paymentauth.org/draft-httpauth-payment-00.html> Checks: C18, C19.
- **AP2 — Agent Payments Protocol** _(pre-standard)_ — Google's trust/authorization layer for agent-led payments, built on A2A: a participant advertises support via the AP2 extension URI in its A2A Agent Card. Detection only — mandate verifiable credentials are runtime SD-JWTs with no static artifact. Pre-standard (v0.2.0). Canonical: <https://github.com/google-agentic-commerce/AP2> Checks: C20.

## Discovery & integrity

- **NLWeb** — An open natural-language query protocol: a site exposes POST /ask returning Schema.org-typed JSON. Detection is heuristic and informational. Canonical: <https://nlweb.ai/docs/specification> Checks: C12.
- **API Catalog (RFC 9727)** — A /.well-known/api-catalog linkset advertising a site's APIs so agents can enumerate them from one well-known entry point. Canonical: <https://www.rfc-editor.org/info/rfc9727> Checks: C13.
- **Web Bot Auth** _(pre-standard)_ — An HTTP message-signatures directory at /.well-known/http-message-signatures-directory letting well-behaved bots prove their identity. IETF draft. Canonical: <https://datatracker.ietf.org/doc/html/draft-meunier-web-bot-auth-architecture-05> Checks: C14.
- **Agent Skills Discovery** _(pre-standard)_ — A /.well-known/agent-skills/index.json manifest advertising installable agent skills. Pre-standard (Cloudflare RFC v0.2.0). Canonical: <https://github.com/cloudflare/agent-skills-discovery-rfc/blob/main/README.md> Checks: C15.
- **Content parity (anti-cloaking)** _(behavioural)_ — Not a published spec — a behavioural check comparing the AI-bot response to the baseline to detect cloaking (serving agents different content than humans). Canonical: _none published_ Checks: C16.
- **Agent-driven UI (A2UI)** _(pre-standard)_ — MCP-Apps / OpenAI Apps SDK UI surfaces declared on an MCP Server Card, letting agents render interactive widgets inline. Emerging. Canonical: <https://modelcontextprotocol.io> Checks: C17.
`;
