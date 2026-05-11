# agent-ready-mcp

MCP server for [Agent Ready](https://agent-ready.dev) — scan any URL for AI agent readability against the [Vercel Agent Readability Spec](https://vercel.com/kb/guide/agent-readability-spec), the [llmstxt.org](https://llmstxt.org) standard, and agent-protocol manifests (MCP server cards, A2A, agents.json, agent-permissions.json, UCP, x402). 59 checks with per-check fix guidance.

Hosted at `https://agent-ready.dev/api/v1/mcp` (Streamable HTTP); this package is a thin stdio wrapper around the same REST endpoints, distributed via npm for local MCP clients (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf).

## Features

- **`scan_site`** — fresh agent-readability scan on any URL. Polls the hosted API up to 60s; returns the full scan or a `running` placeholder.
- **`get_scan`** — fetch a previously-run scan by id.
- **Three discovery prompts** — `scan`, `interpret_scan`, `remediation_plan`. End-to-end workflows from URL → score → fix-it plan.
- **`SKILL.md`** — Claude Skill descriptor included under `skills/agent-ready/` for activation routing.

## Setup

You'll need an Agent Ready Pro API key. Sign up at [agent-ready.dev](https://agent-ready.dev), upgrade to Pro, then issue a key from the [dashboard](https://agent-ready.dev/dashboard/api-keys).

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "agent-ready": {
      "command": "npx",
      "args": ["-y", "agent-ready-mcp@latest"],
      "env": {
        "AGENT_READY_API_KEY": "ar_live_..."
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add agent-ready \
  -e AGENT_READY_API_KEY=ar_live_... \
  -- npx -y agent-ready-mcp@latest
```

### Cursor / VS Code / Windsurf

`.cursor/mcp.json`, `.vscode/mcp.json`, or `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "agent-ready": {
      "command": "npx",
      "args": ["-y", "agent-ready-mcp@latest"],
      "env": {
        "AGENT_READY_API_KEY": "ar_live_..."
      }
    }
  }
}
```

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `AGENT_READY_API_KEY` | Yes | — | Bearer token issued from the Agent Ready dashboard. |
| `AGENT_READY_API_URL` | No | `https://agent-ready.dev` | Override for self-hosted or staging deployments. |
| `AGENT_READY_SCAN_TIMEOUT_MS` | No | `60000` | How long `scan_site` polls before returning a `running` placeholder. |
| `AGENT_READY_GET_TIMEOUT_MS` | No | `5000` | Timeout for `get_scan` and per-poll fetches. |

## Tools

| Tool | Inputs | Returns |
|---|---|---|
| `scan_site` | `url` (string, required), `pageLimit` (number, optional, max 2000 — capped by your plan) | Scan object: Vercel score 0–100, llms.txt sub-score 0–100, per-check findings with `howToFix` strings. Returns `{ id, status: "running" }` placeholder if the scan exceeds the poll deadline. |
| `get_scan` | `id` (string, scan id from a prior `scan_site` call) | Same scan object as `scan_site`, or `not_found` if the id is unknown or doesn't belong to the authenticated user. |

## Prompts

| Prompt | Args | What it does |
|---|---|---|
| `scan` | `url` | Fresh scan + high-level summary (score, rating, top 3–5 failures, next step). |
| `interpret_scan` | `id` | Plain-English explanation of a previous scan's findings, grouped by category. |
| `remediation_plan` | `id`, optional `focus` (`"seo"` or `"agents"`) | Prioritised fix-it doc with Now/Next/Later buckets and per-fix check ids. |

## Example workflow

```
You: Use agent-ready to scan https://my-saas.com
Claude: [calls scan_site] Your site scored 78/100 (Good) on the Vercel Agent
        Readability Spec. The top 3 fixes: …
You: Can you build me a remediation plan?
Claude: [calls remediation_plan with the scan id] Here's the prioritised list…
```

## Skill (Anthropic Claude Skills)

A `SKILL.md` lives at `skills/agent-ready/SKILL.md` inside the package. To use it in Claude Desktop / Claude Code, copy the `skills/agent-ready/` directory into `~/.claude/skills/`.

The skill describes when to activate (URL + readability-audit intent), which tool to pick, how to surface scan results without dumping raw JSON, and when to defer to other tools (general SEO, performance profiling, code editing).

## How it works

This package is a thin stdio→HTTPS wrapper:

```
MCP client (stdio) ↔ agent-ready-mcp ↔ HTTPS ↔ agent-ready.dev/api/v1/scans
```

All scan execution, persistence, and Pro-tier quota enforcement happen on the hosted server. The npm package only translates between MCP JSON-RPC over stdio and the REST API.

If you'd rather use the hosted MCP server directly (Streamable HTTP transport, no local install), point your MCP client at `https://agent-ready.dev/api/v1/mcp` with `Authorization: Bearer ar_live_...`.

## Methodology

The 59 checks, their weights, and the score formula are documented at [agent-ready.dev/methodology](https://agent-ready.dev/methodology). Both `manifest.json` and `server.json` in this repo conform to the relevant registry schemas (Glama Marketplace v0.3 and MCP registry 2025-12-11 respectively).

## Development

```bash
npm install
npm run build       # → dist/mcp-server.mjs
npm test
npm run typecheck
```

## License

MIT — see [LICENSE](LICENSE).
