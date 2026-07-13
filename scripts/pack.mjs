import { spawn } from "node:child_process";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const outputName = "agent-ready-mcp.mcpb";
const outputPath = path.join(root, outputName);

const stagedPaths = [
  "manifest.json",
  "package.json",
  "server.json",
  "README.md",
  "LICENSE",
  "icon.png",
  "icon-400.png",
  "dist/mcp-server.mjs",
];

async function readJson(relativePath) {
  const raw = await fs.readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(raw);
}

async function assertFileExists(relativePath, message) {
  try {
    await fs.access(path.join(root, relativePath), constants.R_OK);
  } catch {
    throw new Error(message ?? `Missing required file: ${relativePath}`);
  }
}

function conformManifestForMcpb(manifest) {
  const conformed = structuredClone(manifest);

  if (Array.isArray(conformed.prompts)) {
    conformed.prompts = conformed.prompts.map((prompt) => {
      const nextPrompt = {
        name: prompt.name,
        description: prompt.description,
        arguments: Array.isArray(prompt.arguments)
          ? prompt.arguments.map((argument) =>
              typeof argument === "string" ? argument : argument?.name,
            )
          : prompt.arguments,
        text: prompt.text,
      };

      return Object.fromEntries(
        Object.entries(nextPrompt).filter(([, value]) => value !== undefined),
      );
    });
  }

  if (Array.isArray(conformed.tools)) {
    conformed.tools = conformed.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  delete conformed.resources;
  delete conformed.resources_generated;

  return conformed;
}

async function moveExistingOutputAside() {
  const backupPath = path.join(
    os.tmpdir(),
    `agent-ready-mcp-${process.pid}-${Date.now()}.mcpb`,
  );

  try {
    await fs.rename(outputPath, backupPath);
    return backupPath;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function restoreExistingOutput(backupPath) {
  if (!backupPath) {
    return;
  }

  await fs.rm(outputPath, { force: true });
  await fs.rename(backupPath, outputPath);
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `${command} exited after signal ${signal}`
            : `${command} exited with code ${code}`,
        ),
      );
    });
  });
}

async function main() {
  const packageJson = await readJson("package.json");
  const manifest = await readJson("manifest.json");
  const packageVersion = packageJson.version;
  const manifestVersion = manifest.version;

  if (packageVersion !== manifestVersion) {
    throw new Error(
      `Refusing to build stale bundle: package.json version is ${packageVersion}, but manifest.json version is ${manifestVersion}.`,
    );
  }

  await assertFileExists(
    "dist/mcp-server.mjs",
    "Missing dist/mcp-server.mjs. Run npm run build first.",
  );

  for (const relativePath of stagedPaths) {
    await assertFileExists(relativePath);
  }

  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-mcpb-"));
  let outputBackupPath;

  try {
    for (const relativePath of stagedPaths) {
      const source = path.join(root, relativePath);
      const destination = path.join(stageDir, relativePath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(source, destination);
    }

    const conformedManifest = conformManifestForMcpb(manifest);
    await fs.writeFile(
      path.join(stageDir, "manifest.json"),
      `${JSON.stringify(conformedManifest, null, 2)}\n`,
      "utf8",
    );

    outputBackupPath = await moveExistingOutputAside();

    try {
      await run("npx", [
        "--yes",
        "@anthropic-ai/mcpb@2",
        "pack",
        stageDir,
        outputName,
      ], {
        cwd: root,
      });
    } catch (error) {
      await restoreExistingOutput(outputBackupPath);
      outputBackupPath = undefined;
      throw error;
    }

    console.log(`Packed ${outputPath}`);
    console.log(`Bundled version ${packageVersion}`);
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
    if (outputBackupPath) {
      await fs.rm(outputBackupPath, { force: true });
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
