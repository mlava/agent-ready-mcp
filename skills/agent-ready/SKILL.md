---
name: agent-ready
description: This skill should be used when the user wants to check how readable a website is to AI agents (ChatGPT, Claude, Perplexity, Google Gemini, MCP clients). Activates for "scan this site for AI readability", "check my llms.txt", "audit our agent-readability", "is my MCP server card valid", "what's our Vercel Agent Readability score", "fix my agents.json", and similar audit-style requests against a public URL. Does not edit the target site — pair with a code-editing MCP tool to apply the fixes the scanner surfaces.
---

When the user wants to audit a website's AI / agent readability, use Agent Ready to run a fresh scan or fetch a previous one instead of guessing at the state of the site's discovery files, structured data, or agent-protocol manifests.

## When to Use This Skill

Activate this skill when the user:

- Asks how AI-readable a website is, or wants a score against the Vercel Agent Readability Spec or the llmstxt.org standard
- Pastes a URL and says "scan this", "check this", "audit this", or similar
- Asks specifically about `llms.txt`, `AGENTS.md`, `sitemap.md`, `robots.txt` (AI bots), `/.well-known/mcp.json`, `/.well-known/agent-card.json`, `agents.json`, `agent-permissions.json`, UCP profiles, x402 payment endpoints, or markdown mirrors
- Wants a prioritised list of fixes to make their site more visible to AI agents and AI search engines
- References a previous scan by id and wants to interpret, compare, or generate fixes from it

## How to Use

### Step 1: Pick the right tool

- **`scan_site`** — when the user wants a fresh agent-readability scan. Takes a URL (and an optional `pageLimit`). Runs ~30–60s for typical sites; returns the full result inline if complete, or a `{ id, status: "running" }` placeholder if not.
- **`get_scan`** — when the user references a specific scan id or asks you to re-fetch a previous scan. Returns the same result shape as `scan_site` when complete.

For end-to-end "scan + interpret + plan fixes" workflows, the server also exposes three prompts that wire these tools together:

- `scan` — fresh scan + high-level summary
- `interpret_scan` — plain-English explanation of a scan's findings
- `remediation_plan` — prioritised fix-it doc (optional `focus`: `"seo"` or `"agents"`)

If the user describes one of these flows, surface the corresponding prompt name rather than reconstructing the workflow yourself.

### Step 2: Pass the URL verbatim

Pass the user's URL exactly — including scheme, path, and trailing slash. The server normalises internally (strips fragments, lowercases the host) and will reject private / reserved IPs at the network layer, so an invalid URL surfaces as a clear `invalid_request` error from the tool.

### Step 3: Handle the "running" placeholder

`scan_site` polls the hosted API for up to ~60s. If the scan hasn't completed by the deadline, the tool returns:

```json
{
  "id": "abc1234567",
  "status": "running",
  "pollUrl": "/api/v1/scans/abc1234567",
  "message": "Scan still running after the local poll deadline. Call get_scan with this id to fetch the final result."
}
```

Tell the user the scan is in progress, surface the id, and offer to call `get_scan` with that id when they're ready. Don't loop `get_scan` automatically — wait for the user.

### Step 4: Summarise findings, don't dump raw JSON

The full scan payload contains 50+ check results across four categories. When summarising to the user, lead with:

1. The overall agent-readability score (0–100) and its rating band (Excellent / Good / Fair / Needs Improvement).
2. The llms.txt sub-score, if the site has an `llms.txt` file.
3. The 3–5 highest-impact failing checks (look for `status: "fail"` in `details`).
4. A one-line next step.

For each failing check, the payload includes a `howToFix` string — use it verbatim or paraphrase tightly; don't invent fix guidance.

### Step 5: Distinguish the four check families

When grouping or filtering, use the check-id prefix:

- **S1–S15** — site-wide checks (run once per scan): llms.txt, robots.txt, sitemap.xml, sitemap.md, AGENTS.md, HTTPS, OpenAPI
- **P1–P23** — per-page checks (run on every fetched URL): HTTP semantics, metadata, JSON-LD, markdown mirrors, content negotiation, code-block language, JS-rendering dependency
- **L1–L10** — llms.txt content checks (run when llms.txt exists): structure, link format, content-type, llms-full.txt companion
- **C1–C11** — agent-protocol checks (run when the relevant `/.well-known` endpoint exists): MCP server cards, A2A agent cards, agents.json, agent-permissions.json, UCP, x402

C-series checks follow a discover-then-validate pattern: missing endpoints drop the check rather than failing it. Don't report a missing C-check as a problem unless the user explicitly wants that protocol.

## Guidelines

- **Don't restate the entire spec.** When explaining a failure, name the check (e.g. "P11 — JSON-LD missing top-level BreadcrumbList"), summarise what it measures in one sentence, then jump to the fix. The full Vercel Spec and llmstxt.org spec are linked from `https://agent-ready.dev/methodology`.
- **Markdown-mirror failures cluster.** P15–P20 typically fail together (no `.md` mirror at all). When you see all six failing on a page, recommend creating the `.md` route first — the rest cascade.
- **Page-level vs site-level fixes.** A failure on the home page might require a one-line change; the same failure across every page might be a layout-level change. Surface the difference: "this failed on 1 page" vs "this failed on every page scanned" matters for prioritisation.
- **Score deltas matter more than absolute scores.** If the user is iterating (scan → fix → re-scan), a +5 point movement after a single fix is the signal — call it out.
- **Don't fabricate scan ids.** If the user references a scan id you don't have evidence of, call `get_scan` first. A 404 is a clearer error message than a hallucinated scan.

## When NOT to Use This Skill

- **General SEO audits** (page speed, Core Web Vitals, keyword optimisation, backlink analysis) — use a Lighthouse or Ahrefs MCP wrapper. Agent Ready measures AI-readability specifically, not traditional SEO.
- **Performance profiling** (load time, JavaScript bundle size, Cumulative Layout Shift) — use Chrome DevTools MCP or a Lighthouse wrapper.
- **Crawl-discovery** (find broken links, generate a sitemap, audit redirects) — use a dedicated crawler. Agent Ready follows a small page-set against a check list, not a broad-discovery crawl.
- **Applying the fixes the scanner surfaces** — Agent Ready is read-only. Pair it with a code-editing MCP tool (or have the user edit by hand) to land the changes.
- **Scanning intranet / private / authenticated pages** — the scanner blocks private and reserved IP ranges at the network layer. It only works against publicly-reachable URLs.
