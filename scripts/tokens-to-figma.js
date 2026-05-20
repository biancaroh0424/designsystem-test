#!/usr/bin/env node
/**
 * GitHub → Figma
 * tokens/ 폴더의 JSON을 읽어서 Figma 변수를 업데이트합니다.
 * GitHub Actions에서 자동 실행되거나 직접 실행할 수 있어요.
 *
 * 사용법:
 *   FIGMA_ACCESS_TOKEN=xxx FIGMA_FILE_KEY=xxx node scripts/tokens-to-figma.js
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const FIGMA_ACCESS_TOKEN = process.env.FIGMA_ACCESS_TOKEN;
const FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY || "lAXzAARFQVK4n2CsBcVxYk";

if (!FIGMA_ACCESS_TOKEN) {
  console.error("❌ FIGMA_ACCESS_TOKEN 환경변수가 없어요.");
  process.exit(1);
}

// ── 색상 변환 유틸 ──────────────────────────────────────────────────────────

function hexToRgba(hex) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const a = clean.length === 8 ? parseInt(clean.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

// ── JSON 플랫 변환 ──────────────────────────────────────────────────────────

function flattenTokens(obj, prefix = "") {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}/${key}` : key;
    if (val && typeof val === "object" && "value" in val) {
      result[path] = val;
    } else if (val && typeof val === "object") {
      Object.assign(result, flattenTokens(val, path));
    }
  }
  return result;
}

// ── tokens/ 폴더의 모든 JSON 읽기 ─────────────────────────────────────────

function readAllTokens(dir = "tokens") {
  const collections = {};
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (entry.startsWith("$")) continue;
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      const subTokens = readAllTokens(fullPath);
      const subName = entry;
      for (const [k, v] of Object.entries(subTokens)) {
        collections[`${subName}/${k}`] = v;
      }
    } else if (entry.endsWith(".json")) {
      const collectionName = entry.replace(".json", "");
      const raw = JSON.parse(readFileSync(fullPath, "utf-8"));
      collections[collectionName] = raw;
    }
  }
  return collections;
}

// ── 레퍼런스 변수 ID 조회 ──────────────────────────────────────────────────

function findVariableIdByName(name, existingVars) {
  const normalizedName = name.replaceAll(".", "/");
  return Object.values(existingVars).find((v) => v.name === normalizedName)?.id;
}

// ── 메인 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("📡 현재 Figma 변수 조회 중...");

  const res = await fetch(
    `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}/variables/local`,
    { headers: { "X-Figma-Token": FIGMA_ACCESS_TOKEN } }
  );

  if (!res.ok) {
    console.error(`❌ Figma API 오류 (${res.status})`);
    process.exit(1);
  }

  const { meta } = await res.json();
  const existingVars = meta.variables ?? {};
  const existingCollections = meta.variableCollections ?? {};

  const allCollections = readAllTokens("tokens");

  const variableCollections = [];
  const variableModes = [];
  const variables = [];
  const variableModeValues = [];

  for (const [collectionName, tokenData] of Object.entries(allCollections)) {
    const flatTokens = flattenTokens(tokenData);
    if (Object.keys(flatTokens).length === 0) continue;

    // 기존 컬렉션 찾기 또는 새로 생성
    const existingCollection = Object.values(existingCollections).find(
      (c) => c.name.toLowerCase().replace(/\s+/g, "-") === collectionName
    );

    const collectionId = existingCollection?.id ?? `NEW_COLLECTION_${collectionName}`;
    const modeId = existingCollection?.defaultModeId ?? `NEW_MODE_${collectionName}`;

    if (!existingCollection) {
      variableCollections.push({
        action: "CREATE",
        id: collectionId,
        name: collectionName,
        initialModeId: modeId,
      });
    }

    for (const [tokenPath, token] of Object.entries(flatTokens)) {
      const existingVar = Object.values(existingVars).find(
        (v) => v.name === tokenPath && v.variableCollectionId === existingCollection?.id
      );

      const varId = existingVar?.id ?? `NEW_VAR_${collectionName}_${tokenPath}`;

      // 타입 매핑
      const resolvedType = (() => {
        switch (token.type) {
          case "color": return "COLOR";
          case "spacing":
          case "borderRadius":
          case "fontSizes":
          case "fontWeights":
          case "lineHeights":
          case "number": return "FLOAT";
          default: return "STRING";
        }
      })();

      if (!existingVar) {
        variables.push({
          action: "CREATE",
          id: varId,
          name: tokenPath,
          variableCollectionId: collectionId,
          resolvedType,
        });
      }

      // 값 변환
      let value;
      const rawValue = String(token.value);

      if (rawValue.startsWith("{") && rawValue.endsWith("}")) {
        const refName = rawValue.slice(1, -1);
        const refId = findVariableIdByName(refName, existingVars);
        if (refId) {
          value = { type: "VARIABLE_ALIAS", id: refId };
        } else {
          console.warn(`⚠️  레퍼런스를 찾을 수 없음: ${refName}`);
          continue;
        }
      } else if (resolvedType === "COLOR") {
        value = hexToRgba(rawValue);
      } else if (resolvedType === "FLOAT") {
        value = parseFloat(rawValue);
      } else {
        value = rawValue;
      }

      variableModeValues.push({
        variableId: varId,
        modeId,
        value,
      });
    }
  }

  const payload = { variableCollections, variableModes, variables, variableModeValues };

  console.log(
    `📤 Figma에 전송 중... (변수 ${variables.length}개, 컬렉션 ${variableCollections.length}개)`
  );

  const postRes = await fetch(
    `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}/variables`,
    {
      method: "POST",
      headers: {
        "X-Figma-Token": FIGMA_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!postRes.ok) {
    const text = await postRes.text();
    console.error(`❌ Figma 업데이트 오류 (${postRes.status}): ${text}`);
    process.exit(1);
  }

  console.log("✅ Figma 변수 업데이트 완료!");
}

main();
