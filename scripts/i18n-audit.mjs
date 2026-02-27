#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, "scripts", "i18n-audit-baseline.json");
const UPDATE_BASELINE = process.argv.includes("--update-baseline");

const ALLOWLIST_PATTERNS = [
  /^Swasthya Sanchar$/,
  /^Aarohi$/,
  /^Dr\.\s?/,
  /^0x[a-fA-F0-9]{4,}$/,
  /^[A-Za-z0-9_-]{20,}$/,
  /^https?:\/\//,
  /^\/?[a-z0-9\-_/\[\]]+$/,
  /^[A-Z0-9_]+$/,
  /^#[0-9A-Fa-f]{3,8}$/,
  /^\d+(?:\.\d+)?(?:MB|KB|GB|%)?$/,
  /^\w+@\w+/,
];

const ATTR_REGEX = /(placeholder|title|aria-label|alt)=\"([^\"]+)\"/g;
const JSX_TEXT_REGEX = />\s*([^<>{}][^<>{}]{1,120}?)\s*</g;

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim();
}

function readFile(filePath) {
  return readFileSync(filePath, "utf8");
}

function listTsxFiles() {
  const out = sh("rg --files src/app src/components src/features -g '*.tsx'");
  return out ? out.split("\n").filter(Boolean) : [];
}

function isTranslatable(text) {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return false;
  if (t.length < 2) return false;
  if (!/[A-Za-z\u0900-\u097F]/.test(t)) return false;
  if (t.startsWith("{") || t.endsWith("}")) return false;
  if (t.includes("${") || t.includes("className") || t.includes("=>")) return false;
  if (t.includes("<") || t.includes(">")) return false;
  if (/\b(?:const|let|var|function|await|return|Promise|new|Map|Set|toLowerCase|filter|map)\b/.test(t)) return false;
  if (/[;{}]/.test(t)) return false;
  if (t.includes("||") || t.includes("&&") || t.includes("??")) return false;
  if (/\)\s*:\s*[A-Za-z]/.test(t)) return false;
  if (/^\(?[a-zA-Z_][a-zA-Z0-9_]*\s*[:=]/.test(t)) return false;
  if (ALLOWLIST_PATTERNS.some((rx) => rx.test(t))) return false;
  return true;
}

function lineForIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

function collectFindings(filePath) {
  const content = readFile(path.join(ROOT, filePath));
  const findings = [];

  for (const match of content.matchAll(ATTR_REGEX)) {
    const raw = match[2] || "";
    const text = raw.trim();
    if (!isTranslatable(text)) continue;
    findings.push({
      file: filePath,
      line: lineForIndex(content, match.index || 0),
      kind: `attr:${match[1]}`,
      text,
      fingerprint: `${filePath}|attr:${match[1]}|${text}`,
    });
  }

  for (const match of content.matchAll(JSX_TEXT_REGEX)) {
    const raw = match[1] || "";
    const text = raw.trim();
    if (!isTranslatable(text)) continue;
    findings.push({
      file: filePath,
      line: lineForIndex(content, match.index || 0),
      kind: "jsx-text",
      text,
      fingerprint: `${filePath}|jsx-text|${text}`,
    });
  }

  return findings;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function main() {
  const files = listTsxFiles();
  const allFindings = files.flatMap((filePath) => collectFindings(filePath));
  const dedupMap = new Map(allFindings.map((f) => [f.fingerprint, f]));
  const dedupFindings = Array.from(dedupMap.values()).sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));

  if (UPDATE_BASELINE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(dedupFindings, null, 2)}\n`, "utf8");
    console.log(`i18n audit baseline updated (${dedupFindings.length} entries).`);
    return;
  }

  const baseline = loadBaseline();
  const baselineSet = new Set(baseline.map((entry) => entry.fingerprint));
  const regressions = dedupFindings.filter((finding) => !baselineSet.has(finding.fingerprint));

  if (regressions.length > 0) {
    console.error("i18n audit failed: new hardcoded UI strings found.");
    regressions.slice(0, 200).forEach((f) => {
      console.error(`- ${f.file}:${f.line} [${f.kind}] ${JSON.stringify(f.text)}`);
    });
    if (regressions.length > 200) {
      console.error(`... ${regressions.length - 200} more`);
    }
    console.error("If intentional, run: npm run i18n:audit:update");
    process.exit(1);
  }

  console.log(`i18n audit passed (${dedupFindings.length} strings checked, no new regressions).`);
}

main();
