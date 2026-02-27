#!/usr/bin/env node
/**
 * Deploy ke baad: .env.production mein IdentityRegistry + HealthRegistry addresses set karo, phir build chalao.
 *
 * Usage:
 *   node scripts/set-contracts-and-build.mjs 0x<IdentityRegistry> 0x<HealthRegistry>
 *
 * Example (replace with your deployed addresses):
 *   node scripts/set-contracts-and-build.mjs 0x1234... 0x5678...
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.production");

const identity = process.argv[2];
const health = process.argv[3];

if (!identity || !health || !identity.startsWith("0x") || !health.startsWith("0x")) {
  console.error("Usage: node scripts/set-contracts-and-build.mjs <IdentityRegistry> <HealthRegistry>");
  console.error("Example: node scripts/set-contracts-and-build.mjs 0x... 0x...");
  process.exit(1);
}

const envContent = `# Static build (IPFS) — addresses from chain:deploy
NEXT_PUBLIC_USE_CLIENT_DATA=true
NEXT_PUBLIC_POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
NEXT_PUBLIC_POLYGON_CHAIN_ID=80002
NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS=${identity}
NEXT_PUBLIC_HEALTH_REGISTRY_ADDRESS=${health}
`;

fs.writeFileSync(ENV_PATH, envContent, "utf8");
console.log("Updated .env.production with contract addresses.");
console.log("Running: npm run build");

const { spawn } = await import("child_process");
const child = spawn("npm", ["run", "build"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 0));
