#!/usr/bin/env node
/**
 * .env se DEPLOYER_PRIVATE_KEY load karke us key ka address dikhata hai.
 * Use: node scripts/check-deployer-address.mjs
 * (Project root se chalao taaki .env mil jaye.)
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env") });
config({ path: path.join(__dirname, "..", ".env.local") });

const key = process.env.DEPLOYER_PRIVATE_KEY;
if (!key || key === "0x0000000000000000000000000000000000000000000000000000000000000001") {
  console.log("DEPLOYER_PRIVATE_KEY .env mein set nahi hai ya default (0x...01) hai.");
  console.log("Default key ka address: 0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf");
  console.log("\nApni key use karne ke liye .env mein set karo:");
  console.log("  DEPLOYER_PRIVATE_KEY=0x<64 hex chars>");
  process.exit(0);
}

try {
  const { Wallet } = await import("ethers");
  const wallet = new Wallet(key.trim());
  console.log("Address (is key se deploy hoga):", wallet.address);
} catch (e) {
  console.error("Invalid private key (format check karo — 0x + 64 hex chars):", e.message);
  process.exit(1);
}
