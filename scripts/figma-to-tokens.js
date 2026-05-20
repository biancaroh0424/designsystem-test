#!/usr/bin/env node
/**
 * Figma → GitHub
 * Figma 변수를 읽어서 tokens/ 폴더에 JSON으로 저장하고 design/tokens 브랜치에 커밋합니다.
 *
 * 사용법:
 *   FIGMA_ACCESS_TOKEN=xxx FIGMA_FILE_KEY=xxx node scripts/figma-to-tokens.js
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const FIGMA_ACCESS_TOKEN = process.env.FIGMA_ACCESS_TOKEN;
const FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY || "lAXzAARFQVK4n2CsBcVxYk";

if (!FIGMA_ACCESS_TOKEN) {
  console.error("❌ FIGMA_ACCESS_TOKEN 환경변수가 없어요.");
  console.error("   export FIGMA_ACCESS_TOKEN=your_token_here");
  process.exit(1);
}

// ── 색상 변환 유틸 ──────────────────────────────────────────────────────────

function rgbaToHex({ r, g, b, a = 1 }) {
  const hex = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return a < 0.999
    ? `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`
    : `#${hex(r)}${hex(g)}${hex(b)}`;
}

// ── 중첩 객체 변환 ──────────────────────────────────────────────────────────

function setNestedValue(obj, path, value) {
  const parts = path.split("/");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    cur[key] = cur[key] ?? {};
    cur = cur[key];
  }
  cur[parts.at(-1)] = value;
}

// ── Figma 변수값 → 토큰값 변환 ──────────────────────────────────────────────

function resolveValue(rawValue, resolvedType, variables) {
  if (rawValue?.type === "VARIABLE_ALIAS") {
    const ref = variables[rawValue.id];
    return ref ? `{${ref.name.replaceAll("/", ".")}}` : String(rawValue.id);
  }
  if (resolvedType === "COLOR" && rawValue?.r !== undefined) {
    return rgbaToHex(rawValue);
  }
  if (resolvedType === "FLOAT") return String(rawValue);
  if (resolvedType === "STRING") return String(rawValue);
  if (resolvedType === "BOOLEAN") return String(rawValue);
  return String(rawValue);
}

function resolvedTypeToTokenType(resolvedType, name) {
  if (resolvedType === "COLOR") return "color";
  if (resolvedType === "FLOAT") {
    if (/spacing|padding|gap|margin/.test(name)) return "spacing";
    if (/radius/.test(name)) return "borderRadius";
    if (/font.?size|fontSize/.test(name)) return "fontSizes";
    if (/font.?weight|fontWeight/.test(name)) return "fontWeights";
    if (/line.?height|lineHeight/.test(name)) return "lineHeights";
    return "number";
  }
  if (resolvedType === "STRING") return "string";
  if (resolvedType === "BOOLEAN") return "boolean";
  return "other";
}

// ── 메인 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("📡 Figma에서 변수를 가져오는 중...");

  const res = await fetch(
    `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}/variables/local`,
    { headers: { "X-Figma-Token": FIGMA_ACCESS_TOKEN } }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ Figma API 오류 (${res.status}): ${text}`);
    process.exit(1);
  }

  const { meta } = await res.json();
  const { variables = {}, variableCollections = {} } = meta;

  if (Object.keys(variables).length === 0) {
    console.log("⚠️  Figma 파일에 변수가 없어요. 먼저 Figma에서 변수를 만들어주세요.");
    process.exit(0);
  }

  // collection별로 토큰 JSON 생성
  const collectionTokens = {};

  for (const [id, collection] of Object.entries(variableCollections)) {
    const defaultModeId = collection.defaultModeId;
    const safeCollectionName = collection.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-/]/g, "");

    collectionTokens[safeCollectionName] = {};

    const collectionVars = Object.values(variables).filter(
      (v) => v.variableCollectionId === id
    );

    for (const variable of collectionVars) {
      const rawValue = variable.valuesByMode?.[defaultModeId];
      if (rawValue === undefined) continue;

      const value = resolveValue(rawValue, variable.resolvedType, variables);
      const type = resolvedTypeToTokenType(variable.resolvedType, variable.name);

      setNestedValue(collectionTokens[safeCollectionName], variable.name, {
        value,
        type,
      });
    }
  }

  // tokens/ 폴더에 파일 저장
  for (const [collectionName, tokens] of Object.entries(collectionTokens)) {
    const filePath = `tokens/${collectionName}.json`;
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(tokens, null, 2) + "\n");
    console.log(`✅ 저장: ${filePath}`);
  }

  // $metadata.json 업데이트
  const tokenSetOrder = Object.keys(collectionTokens);
  writeFileSync(
    "tokens/$metadata.json",
    JSON.stringify({ tokenSetOrder }, null, 2) + "\n"
  );

  // git 커밋 & 푸시
  try {
    execSync("git add tokens/", { stdio: "inherit" });
    const status = execSync("git status --porcelain tokens/").toString().trim();
    if (!status) {
      console.log("✨ 변경사항 없음 — Figma와 GitHub가 이미 동일해요.");
      return;
    }
    execSync(
      `git commit -m "chore: sync tokens from Figma [skip-figma-sync] [$(date '+%Y-%m-%d %H:%M')]"`,
      { stdio: "inherit", shell: true }
    );
    execSync("git push origin design/tokens", { stdio: "inherit" });
    console.log("🚀 design/tokens 브랜치에 푸시 완료!");
  } catch (e) {
    console.error("❌ git 오류:", e.message);
  }
}

main();
