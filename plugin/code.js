figma.showUI(__html__, { width: 380, height: 520, title: "Token Sync" });

// ── 색상 변환 ────────────────────────────────────────────────────────────────

function rgbaToHex({ r, g, b, a = 1 }) {
  const hex = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return a < 0.999
    ? `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`
    : `#${hex(r)}${hex(g)}${hex(b)}`;
}

function hexToRgba(hex) {
  const c = hex.replace("#", "");
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255,
    a: c.length === 8 ? parseInt(c.slice(6, 8), 16) / 255 : 1,
  };
}

// ── 중첩 객체 유틸 ────────────────────────────────────────────────────────────

function setNested(obj, path, value) {
  const parts = path.split("/");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] ?? {};
    cur = cur[parts[i]];
  }
  cur[parts.at(-1)] = value;
}

function flattenTokens(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}/${k}` : k;
    if (v && typeof v === "object" && "value" in v) out[path] = v;
    else if (v && typeof v === "object") Object.assign(out, flattenTokens(v, path));
  }
  return out;
}

// ── Figma 변수 → 토큰 JSON ────────────────────────────────────────────────────

async function readVariables() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const allVars = await figma.variables.getLocalVariablesAsync();
  const varById = Object.fromEntries(allVars.map((v) => [v.id, v]));

  const result = {};

  for (const col of collections) {
    const key = col.name.toLowerCase().replace(/\s+/g, "-");
    const modeId = col.defaultModeId;
    const tokens = {};

    for (const v of allVars.filter((v) => v.variableCollectionId === col.id)) {
      const raw = v.valuesByMode[modeId];
      if (raw === undefined) continue;

      let value, type;

      if (raw?.type === "VARIABLE_ALIAS") {
        const ref = varById[raw.id];
        value = ref ? `{${ref.name.replaceAll("/", ".")}}` : raw.id;
        type = "alias";
      } else if (v.resolvedType === "COLOR") {
        value = rgbaToHex(raw);
        type = "color";
      } else if (v.resolvedType === "FLOAT") {
        value = String(raw);
        type = /spacing|padding|gap|margin/i.test(v.name)
          ? "spacing"
          : /radius/i.test(v.name)
          ? "borderRadius"
          : /font.?size/i.test(v.name)
          ? "fontSizes"
          : /font.?weight/i.test(v.name)
          ? "fontWeights"
          : "number";
      } else {
        value = String(raw);
        type = "string";
      }

      setNested(tokens, v.name, { value, type });
    }

    result[key] = tokens;
  }

  return result;
}

// ── 토큰 JSON → Figma 변수 ────────────────────────────────────────────────────

async function writeVariables(tokensByCollection) {
  const existingCols = await figma.variables.getLocalVariableCollectionsAsync();
  const existingVars = await figma.variables.getLocalVariablesAsync();

  const colMap = Object.fromEntries(
    existingCols.map((c) => [c.name.toLowerCase().replace(/\s+/g, "-"), c])
  );
  // key: "varName::colId"
  const varMap = Object.fromEntries(
    existingVars.map((v) => [`${v.name}::${v.variableCollectionId}`, v])
  );

  let created = 0, updated = 0;

  // 1패스: alias가 아닌 값 먼저
  for (const [colKey, tokenData] of Object.entries(tokensByCollection)) {
    const flat = flattenTokens(tokenData);
    let col = colMap[colKey];
    if (!col) {
      col = figma.variables.createVariableCollection(colKey);
      colMap[colKey] = col;
    }
    const modeId = col.defaultModeId;

    for (const [path, token] of Object.entries(flat)) {
      if (String(token.value).startsWith("{")) continue; // alias는 2패스에서

      const resolvedType =
        token.type === "color" ? "COLOR"
        : ["spacing","borderRadius","fontSizes","fontWeights","number"].includes(token.type) ? "FLOAT"
        : "STRING";

      const mapKey = `${path}::${col.id}`;
      let variable = varMap[mapKey];
      if (!variable) {
        variable = figma.variables.createVariable(path, col, resolvedType);
        varMap[mapKey] = variable;
        created++;
      } else {
        updated++;
      }

      const val = token.value;
      if (resolvedType === "COLOR") variable.setValueForMode(modeId, hexToRgba(val));
      else if (resolvedType === "FLOAT") variable.setValueForMode(modeId, parseFloat(val));
      else variable.setValueForMode(modeId, String(val));
    }
  }

  // 2패스: alias 설정
  const refreshedVars = await figma.variables.getLocalVariablesAsync();
  const varByName = Object.fromEntries(refreshedVars.map((v) => [v.name, v]));

  for (const [colKey, tokenData] of Object.entries(tokensByCollection)) {
    const flat = flattenTokens(tokenData);
    const col = colMap[colKey];
    if (!col) continue;
    const modeId = col.defaultModeId;

    for (const [path, token] of Object.entries(flat)) {
      const rawVal = String(token.value);
      if (!rawVal.startsWith("{")) continue;

      const refName = rawVal.slice(1, -1).replaceAll(".", "/");
      const refVar = varByName[refName];
      if (!refVar) continue;

      const mapKey = `${path}::${col.id}`;
      const variable = varMap[mapKey];
      if (!variable) continue;

      variable.setValueForMode(modeId, { type: "VARIABLE_ALIAS", id: refVar.id });
    }
  }

  return { created, updated };
}

// ── 메시지 핸들러 ──────────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case "LOAD_SETTINGS": {
      const s = await figma.clientStorage.getAsync("token-sync-settings");
      figma.ui.postMessage({ type: "SETTINGS", data: s ?? {} });
      break;
    }
    case "SAVE_SETTINGS": {
      await figma.clientStorage.setAsync("token-sync-settings", msg.data);
      figma.ui.postMessage({ type: "SETTINGS_SAVED" });
      break;
    }
    case "READ_VARIABLES": {
      try {
        const tokens = await readVariables();
        figma.ui.postMessage({ type: "VARIABLES_DATA", tokens });
      } catch (e) {
        figma.ui.postMessage({ type: "ERROR", message: e.message });
      }
      break;
    }
    case "WRITE_VARIABLES": {
      try {
        const { created, updated } = await writeVariables(msg.tokens);
        figma.ui.postMessage({ type: "WRITE_DONE", created, updated });
      } catch (e) {
        figma.ui.postMessage({ type: "ERROR", message: e.message });
      }
      break;
    }
    case "CLOSE":
      figma.closePlugin();
      break;
  }
};
