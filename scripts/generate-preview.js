#!/usr/bin/env node
/**
 * tokens/ 폴더를 읽어서 디자인 시스템 프리뷰 HTML을 생성합니다.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

function readTokensDir(dir) {
  const result = {};
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith("$")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const sub = readTokensDir(full);
      for (const [k, v] of Object.entries(sub)) result[`${entry}/${k}`] = v;
    } else if (entry.endsWith(".json")) {
      result[entry.replace(".json", "")] = JSON.parse(readFileSync(full, "utf-8"));
    }
  }
  return result;
}

function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && "value" in v) out[path] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v, path));
  }
  return out;
}

const allCollections = readTokensDir("tokens");
const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

// 컬렉션별 플랫 토큰
const byCollection = {};
for (const [name, data] of Object.entries(allCollections)) {
  byCollection[name] = flatten(data);
}

// 타입별로 분류
function getByType(collections, types) {
  const items = [];
  for (const [col, tokens] of Object.entries(collections)) {
    for (const [path, token] of Object.entries(tokens)) {
      if (types.includes(token.type)) items.push({ col, path, ...token });
    }
  }
  return items;
}

const colors   = getByType(byCollection, ["color"]);
const spacings = getByType(byCollection, ["spacing", "number", "borderRadius"]);

// 색상 카드 HTML
function colorCards(items) {
  return items.map(item => {
    const val = String(item.value).startsWith("{") ? "#ccc" : item.value;
    const isLight = isLightColor(val);
    return `<div class="color-card">
      <div class="color-swatch" style="background:${val};"></div>
      <div class="color-info">
        <span class="color-name">${item.path.split(".").pop()}</span>
        <span class="color-path">${item.path}</span>
        <span class="color-value">${item.value}</span>
      </div>
    </div>`;
  }).join("");
}

function isLightColor(hex) {
  try {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0,2),16);
    const g = parseInt(c.slice(2,4),16);
    const b = parseInt(c.slice(4,6),16);
    return (r*299 + g*587 + b*114) / 1000 > 155;
  } catch { return true; }
}

// 컬렉션 섹션 HTML
function collectionSection(name, tokens) {
  const colorItems = Object.entries(tokens).filter(([,t]) => t.type === "color");
  const otherItems = Object.entries(tokens).filter(([,t]) => t.type !== "color");

  let html = `<section class="collection">
    <h2 class="collection-title">${name}</h2>`;

  if (colorItems.length) {
    html += `<div class="color-grid">`;
    for (const [path, token] of colorItems) {
      const val = String(token.value).startsWith("{") ? "#e5e5e5" : token.value;
      html += `<div class="color-card">
        <div class="color-swatch" style="background:${val}"></div>
        <div class="color-info">
          <span class="token-name">${path.split(".").pop()}</span>
          <span class="token-path">${path}</span>
          <span class="token-value">${token.value}</span>
        </div>
      </div>`;
    }
    html += `</div>`;
  }

  if (otherItems.length) {
    html += `<table class="token-table">
      <thead><tr><th>Token</th><th>Value</th><th>Type</th></tr></thead>
      <tbody>`;
    for (const [path, token] of otherItems) {
      let preview = "";
      if (token.type === "borderRadius") {
        preview = `<span class="radius-preview" style="border-radius:${token.value}px"></span>`;
      } else if (token.type === "spacing" || token.type === "number") {
        const px = Math.min(parseFloat(token.value) || 0, 96);
        preview = `<span class="spacing-bar" style="width:${px}px"></span>`;
      }
      html += `<tr>
        <td><code>${path}</code></td>
        <td>${preview}<span class="val-text">${token.value}</span></td>
        <td><span class="type-badge type-${token.type}">${token.type}</span></td>
      </tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `</section>`;
  return html;
}

// ── 컴포넌트 스펙 읽기 ────────────────────────────────────────────────────────

let componentsByGroup = {};
let totalComponents = 0;
try {
  componentsByGroup = JSON.parse(readFileSync("components/specs/components.json", "utf-8"));
  totalComponents = Object.values(componentsByGroup).reduce((s, a) => s + a.length, 0);
} catch (_) {}

function componentSection(components) {
  if (totalComponents === 0) return "";

  let html = `<section class="collection">
    <h2 class="collection-title" style="--dot:#f59e0b">Components</h2>
    <div class="comp-grid">`;

  for (const [group, comps] of Object.entries(components)) {
    for (const comp of comps) {
      const variantTags = comp.variants.map(v =>
        `<span class="variant-tag">${v.name}: ${v.values.join(", ")}</span>`
      ).join("");

      const propTags = comp.props.slice(0, 4).map(p =>
        `<span class="prop-tag">${p.name} <em>${p.type.toLowerCase()}</em></span>`
      ).join("");

      html += `<div class="comp-card">
        <div class="comp-header">
          <span class="comp-name">${comp.name}</span>
          <span class="comp-group">${group}</span>
        </div>
        ${comp.description ? `<p class="comp-desc">${comp.description}</p>` : ""}
        ${variantTags ? `<div class="tag-row">${variantTags}</div>` : ""}
        ${propTags ? `<div class="tag-row">${propTags}</div>` : ""}
        <div class="comp-meta">${comp.width} × ${comp.height}px</div>
      </div>`;
    }
  }

  html += `</div></section>`;
  return html;
}

// ── 섹션 조합 ─────────────────────────────────────────────────────────────────

const sectionsHtml = Object.entries(byCollection)
  .map(([name, tokens]) => collectionSection(name, tokens))
  .join("\n");

const componentsHtml = componentSection(componentsByGroup);

const totalTokens = Object.values(byCollection).reduce((s, t) => s + Object.keys(t).length, 0);

const FIGMA_FILE_KEY = "lAXzAARFQVK4n2CsBcVxYk";
const FIGMA_PROTO_URL = `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/proto/${FIGMA_FILE_KEY}/relevance-ai-clone?type=design%26scaling=scale-down-width%26page-id=0%3A1`;

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design System Preview</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f9fafb;
    --surface: #ffffff;
    --border: #e5e7eb;
    --text: #111827;
    --text-2: #6b7280;
    --text-3: #9ca3af;
    --brand: #6366f1;
    --radius: 10px;
  }

  body {
    font-family: Inter, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
    line-height: 1.5;
  }

  /* ── 헤더 ── */
  .header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 20px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky; top: 0; z-index: 10;
  }
  .header-left h1 { font-size: 16px; font-weight: 700; }
  .header-left p  { font-size: 12px; color: var(--text-2); margin-top: 2px; }
  .stats { display: flex; gap: 20px; }
  .stat { text-align: center; }
  .stat .num { font-size: 20px; font-weight: 700; color: var(--brand); }
  .stat .label { font-size: 11px; color: var(--text-3); }

  /* ── 본문 ── */
  .main { max-width: 1100px; margin: 0 auto; padding: 32px; }

  /* ── 섹션 ── */
  .collection {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    margin-bottom: 20px;
  }
  .collection-title {
    font-size: 14px; font-weight: 600; margin-bottom: 16px;
    padding-bottom: 12px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
  }
  .collection-title::before {
    content: ""; display: block;
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--brand);
  }

  /* ── 컬러 그리드 ── */
  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }
  .color-card { border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
  .color-swatch { height: 60px; }
  .color-info { padding: 8px; }
  .token-name  { display: block; font-weight: 600; font-size: 11px; }
  .token-path  { display: block; font-size: 10px; color: var(--text-3); margin: 2px 0; }
  .token-value { display: block; font-size: 10px; color: var(--text-2); font-family: monospace; }

  /* ── 테이블 ── */
  .token-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .token-table th {
    text-align: left; padding: 8px 12px;
    background: var(--bg); color: var(--text-2);
    font-size: 11px; font-weight: 500;
    border-bottom: 1px solid var(--border);
  }
  .token-table td {
    padding: 8px 12px; border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
  }
  .token-table tr:last-child td { border-bottom: none; }
  code { font-size: 11px; color: var(--brand); background: #eef2ff; padding: 2px 5px; border-radius: 4px; }

  .radius-preview {
    display: inline-block; width: 28px; height: 28px;
    background: var(--brand); opacity: .25;
    margin-right: 8px; vertical-align: middle;
  }
  .spacing-bar {
    display: inline-block; height: 10px; max-width: 200px;
    background: #c7d2fe; border-radius: 2px;
    margin-right: 8px; vertical-align: middle;
  }
  .val-text { vertical-align: middle; }

  /* ── 배지 ── */
  .type-badge {
    display: inline-block; padding: 2px 7px; border-radius: 99px;
    font-size: 10px; font-weight: 500;
  }
  .type-color       { background: #fce7f3; color: #9d174d; }
  .type-spacing     { background: #dcfce7; color: #166534; }
  .type-borderRadius{ background: #fef9c3; color: #854d0e; }
  .type-fontSizes   { background: #e0f2fe; color: #075985; }
  .type-fontWeights { background: #ede9fe; color: #4c1d95; }
  .type-number      { background: #f3f4f6; color: #374151; }
  .type-string      { background: #fff7ed; color: #9a3412; }
  .type-alias       { background: #f0fdf4; color: #14532d; }

  /* ── 탭 네비 ── */
  .nav {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 0 32px;
    display: flex; gap: 0;
  }
  .nav-tab {
    padding: 12px 18px;
    font-size: 13px; font-weight: 500; cursor: pointer;
    border-bottom: 2px solid transparent;
    color: var(--text-2);
    transition: all .15s;
    background: none; border-top: none; border-left: none; border-right: none;
  }
  .nav-tab.active { color: var(--text); border-bottom-color: var(--brand); }

  .tab-panel { display: none; }
  .tab-panel.active { display: block; }

  /* ── 컴포넌트 ── */
  .comp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }
  .comp-card {
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px; background: var(--surface);
  }
  .comp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .comp-name   { font-weight: 600; font-size: 13px; }
  .comp-group  { font-size: 10px; color: var(--text-3); background: var(--bg); padding: 2px 7px; border-radius: 99px; }
  .comp-desc   { font-size: 11px; color: var(--text-2); margin-bottom: 8px; line-height: 1.4; }
  .tag-row     { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
  .variant-tag { font-size: 10px; background: #ede9fe; color: #4c1d95; padding: 2px 6px; border-radius: 4px; }
  .prop-tag    { font-size: 10px; background: #f0f9ff; color: #0369a1; padding: 2px 6px; border-radius: 4px; }
  .prop-tag em { font-style: normal; color: var(--text-3); }
  .comp-meta   { font-size: 10px; color: var(--text-3); margin-top: 4px; }

  /* ── 프로토타입 ── */
  .proto-wrap {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden;
    aspect-ratio: 16/10; width: 100%;
  }
  .proto-wrap iframe { width: 100%; height: 100%; border: none; }
  .proto-hint { text-align: center; padding: 12px; font-size: 11px; color: var(--text-3); }

  /* ── 빈 상태 ── */
  .empty-state {
    text-align: center; padding: 48px 24px;
    color: var(--text-3); font-size: 13px;
  }
  .empty-state .icon { font-size: 32px; margin-bottom: 8px; }

  /* ── 푸터 ── */
  .footer {
    text-align: center; padding: 24px;
    color: var(--text-3); font-size: 11px;
  }
</style>
</head>
<body>

<header class="header">
  <div class="header-left">
    <h1>Design System Preview</h1>
    <p>biancaroh0424/designsystem-test · design/tokens · ${now} 기준</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="num">${totalTokens}</div><div class="label">Tokens</div></div>
    <div class="stat"><div class="num">${totalComponents}</div><div class="label">Components</div></div>
    <div class="stat"><div class="num">${colors.length}</div><div class="label">Colors</div></div>
  </div>
</header>

<nav class="nav">
  <button class="nav-tab active" onclick="showTab('tokens', this)">🎨 Tokens</button>
  <button class="nav-tab" onclick="showTab('components', this)">🧩 Components</button>
  <button class="nav-tab" onclick="showTab('prototype', this)">📱 Prototype</button>
</nav>

<main class="main">

  <div id="tab-tokens" class="tab-panel active">
    ${sectionsHtml}
  </div>

  <div id="tab-components" class="tab-panel">
    ${componentsHtml || `<div class="empty-state"><div class="icon">🧩</div><p>아직 컴포넌트가 없어요.<br>Figma 플러그인에서 Push하면 여기에 나타나요.</p></div>`}
  </div>

  <div id="tab-prototype" class="tab-panel">
    <section class="collection">
      <h2 class="collection-title">Prototype</h2>
      <div class="proto-wrap">
        <iframe
          src="${FIGMA_PROTO_URL}"
          allowfullscreen
        ></iframe>
      </div>
      <p class="proto-hint">Figma 계정으로 로그인되어 있어야 보여요 · <a href="https://www.figma.com/design/${FIGMA_FILE_KEY}" target="_blank">Figma에서 열기 →</a></p>
    </section>
  </div>

</main>

<footer class="footer">
  Generated by Token Sync · ${now}
</footer>

<script>
function showTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
}
</script>

</body>
</html>`;

mkdirSync("preview", { recursive: true });
writeFileSync("preview/index.html", html);
console.log(`✅ preview/index.html 생성 완료 (토큰 ${totalTokens}개, 컬렉션 ${Object.keys(byCollection).length}개)`);
