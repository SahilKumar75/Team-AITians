#!/usr/bin/env node
/**
 * Upload the static export folder (out/) to Pinata as a CAR file and print the CID.
 * Uses: ipfs-car (pack out/ → .car) then Pinata V3 (upload CAR).
 * Use after: npm run build
 *
 * Requires: PINATA_JWT in env ya .env.
 * Optional: npx will install ipfs-car on first run.
 *
 * Usage: node scripts/pin-to-pinata.mjs
 */

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
config({ path: path.join(ROOT, ".env") });
config({ path: path.join(ROOT, ".env.local") });

const OUT_DIR = path.join(ROOT, "out");
const CAR_PATH = path.join(ROOT, "out.car");
const LOG_FILE = path.join(__dirname, "pinata-run.log");
const JWT = process.env.PINATA_JWT;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line, "utf8");
  } catch (_) {}
  console.log(msg);
}

if (!JWT) {
  console.error("Missing PINATA_JWT. Get it from https://app.pinata.cloud → API Keys.");
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) {
  console.error("out/ folder not found. Run 'npm run build' first.");
  process.exit(1);
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
    p.on("error", reject);
  });
}

async function main() {
  fs.writeFileSync(LOG_FILE, "", "utf8");
  log("Step 1: Packing out/ into CAR (ipfs-car)...");
  await run("npx", ["ipfs-car", "pack", "out", "--output", "out.car"], ROOT);
  if (!fs.existsSync(CAR_PATH)) {
    throw new Error("ipfs-car did not create out.car");
  }
  const carSize = fs.statSync(CAR_PATH).size;
  log(`Step 2: CAR created (${(carSize / 1024 / 1024).toFixed(2)} MB). Uploading to Pinata V3...`);

  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("file", fs.createReadStream(CAR_PATH), { filename: "out.car" });
  form.append("network", "public");
  form.append("car", "true");

  const { statusCode, text } = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "uploads.pinata.cloud",
        path: "/v3/files",
        method: "POST",
        headers: { Authorization: `Bearer ${JWT}`, ...form.getHeaders() },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode,
            text: Buffer.concat(chunks).toString("utf8"),
          })
        );
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    form.pipe(req);
  });

  try {
    fs.unlinkSync(CAR_PATH);
  } catch (_) {}

  if (statusCode !== 200 && statusCode !== 201) {
    let errData;
    try {
      errData = JSON.parse(text);
    } catch (_) {}
    if (statusCode === 403 && errData?.error?.message?.toLowerCase().includes("car")) {
      console.error("\n❌ CAR uploads are not available on the Pinata free plan.\n");
      console.error("Use manual upload instead:");
      console.error("  1. Open https://app.pinata.cloud → Upload → Folder");
      console.error("  2. Select the 'out' folder from this project (path: " + OUT_DIR + ")");
      console.error("  3. After upload, copy the CID and use:");
      console.error("     https://gateway.pinata.cloud/ipfs/<CID>/");
      console.error("\n(To use this script for CAR upload, upgrade your Pinata plan.)\n");
      process.exit(1);
    }
    fs.writeFileSync(path.join(ROOT, "pinata-response-debug.json"), text, "utf8");
    throw new Error(`Pinata V3 ${statusCode}: ${text.slice(0, 500)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    fs.writeFileSync(path.join(ROOT, "pinata-response-debug.txt"), text.slice(0, 2000), "utf8");
    throw new Error("Pinata response is not JSON. Wrote pinata-response-debug.txt");
  }
  const cid = data.cid ?? data.data?.cid ?? data.IpfsHash;
  if (!cid) {
    fs.writeFileSync(path.join(ROOT, "pinata-response-debug.json"), text, "utf8");
    throw new Error("Response has no CID. Keys: " + Object.keys(data).join(", "));
  }

  const msg = [
    "",
    "✅ Pinned successfully (CAR upload).",
    "CID: " + cid,
    "",
    "App URL (Pinata gateway):",
    "  https://gateway.pinata.cloud/ipfs/" + cid + "/",
    "",
    "App URL (public gateway):",
    "  https://ipfs.io/ipfs/" + cid + "/",
    "",
  ].join("\n");
  log("SUCCESS - CID: " + cid);
  try {
    fs.appendFileSync(LOG_FILE, "\n" + msg, "utf8");
  } catch (_) {}
  console.log(msg);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    const errMsg = String(err?.stack || err);
    try {
      fs.appendFileSync(LOG_FILE, `\nERROR: ${errMsg}\n`, "utf8");
    } catch (_) {}
    console.error(err);
    process.exit(1);
  });
