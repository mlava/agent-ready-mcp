import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createConfig } from "./client.js";
import { createMcpServer } from "./server.js";

async function main(): Promise<void> {
  const config = createConfig();

  if (!config.apiKey) {
    process.stderr.write(
      "agent-ready-mcp started without AGENT_READY_API_KEY — tools will return a configuration message until a key is set. " +
        "Issue a Pro API key at https://agent-ready.dev/dashboard/api-keys.\n",
    );
  }

  const server = createMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    `agent-ready-mcp server started (target: ${config.baseUrl})\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
