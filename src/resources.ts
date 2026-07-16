import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CHECKS_MD,
  LLMS_TXT,
  METHODOLOGY_MD,
  SPECS_MD,
} from "./resource-content.js";

// Four discovery resources mirroring the hosted agent-ready MCP server.
// MCP clients can fetch these on demand via resources/read without spending
// a tool call. Content sourced from src/resource-content.ts; keep in sync
// with the hosted side by review.

export function registerResources(server: McpServer): void {
  server.registerResource(
    "methodology",
    "agent-ready://methodology",
    {
      title: "Scoring methodology",
      description:
        "How Agent Ready computes the 0–100 readability score and the llms.txt sub-score. Covers the 69 checks across four categories, rating bands, weighting, and JS-rendering handling.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "agent-ready://methodology",
          mimeType: "text/markdown",
          text: METHODOLOGY_MD,
        },
      ],
    }),
  );

  server.registerResource(
    "checks",
    "agent-ready://checks",
    {
      title: "Check registry",
      description:
        "Reference table of all 69 checks Agent Ready runs, grouped by category (site, page, llms.txt, protocol), plus the 9-check accessibility suite scored as a separate accessibility sub-score. Each row pairs the stable check ID (e.g. P11, S15, L9, C3, A7) with its human-readable name. Use this to identify a check by id when interpreting scan results.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "agent-ready://checks",
          mimeType: "text/markdown",
          text: CHECKS_MD,
        },
      ],
    }),
  );

  server.registerResource(
    "llms-txt",
    "agent-ready://llms.txt",
    {
      title: "Agent Ready's own llms.txt",
      description:
        "The /llms.txt file agent-ready.dev publishes for AI agents discovering it as a tool. Mirrors the live document at https://agent-ready.dev/llms.txt. Useful as a worked example for the llms.txt validator and for clients introspecting Agent Ready's surface.",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "agent-ready://llms.txt",
          mimeType: "text/markdown",
          text: LLMS_TXT,
        },
      ],
    }),
  );

  server.registerResource(
    "specs",
    "agent-ready://specs",
    {
      title: "Specifications Agent Ready validates against",
      description:
        "Canonical URLs and check-ID mappings for the specifications Agent Ready implements: Vercel Agent Readability Spec, llmstxt.org, MCP Server Cards (SEP-1649 / RFC 9728), A2A Agent Cards (a2a.proto v1.0.0), Wildcard agents.json, agent-permissions.json, UCP (RFC 8414), x402 and MPP payments, NLWeb, API Catalog (RFC 9727), Web Bot Auth, Agent Skills Discovery, content parity, and Agent-driven UI (A2UI).",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [
        {
          uri: "agent-ready://specs",
          mimeType: "text/markdown",
          text: SPECS_MD,
        },
      ],
    }),
  );
}
