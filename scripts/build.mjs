#!/usr/bin/env node
import { renameSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "true";
const apiDir = path.join(ROOT, "src", "app", "api");
const hiddenApiDir = path.join(ROOT, "src", "app", "__api_disabled_for_static_export__");

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
    cwd: ROOT,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? 1}): ${cmd} ${args.join(" ")}`);
  }
}

let movedApiDir = false;
let exitCode = 0;

try {
  if (isStaticExport && existsSync(apiDir)) {
    if (existsSync(hiddenApiDir)) {
      throw new Error(`Temporary API backup dir already exists: ${hiddenApiDir}`);
    }
    renameSync(apiDir, hiddenApiDir);
    movedApiDir = true;
    console.log("Static export mode: temporarily disabled src/app/api for build.");
  }

  run("node", ["scripts/i18n-audit.mjs"]);
  run("npx", ["next", "build"]);
} catch (error) {
  exitCode = 1;
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
} finally {
  if (movedApiDir && existsSync(hiddenApiDir) && !existsSync(apiDir)) {
    renameSync(hiddenApiDir, apiDir);
    console.log("Restored src/app/api after build.");
  }
}

if (exitCode !== 0) {
  process.exit(exitCode);
}
