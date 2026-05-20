figma.showUI(__html__, { width: 380, height: 520, title: "Token Sync" });

// ── 색상 변환 ────────────────────────────────────────────────────────────────

function rgbaToHex(rgba) {
  var r = rgba.r, g = rgba.g, b = rgba.b, a = rgba.a === undefined ? 1 : rgba.a;
  var hex = function(v) { return Math.round(v * 255).toString(16).padStart(2, "0"); };
  return a < 0.999
    ? "#" + hex(r) + hex(g) + hex(b) + hex(a)
    : "#" + hex(r) + hex(g) + hex(b);
}

function hexToRgba(hex) {
  var c = hex.replace("#", "");
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255,
    a: c.length === 8 ? parseInt(c.slice(6, 8), 16) / 255 : 1,
  };
}

// ── 중첩 객체 유틸 ────────────────────────────────────────────────────────────

function setNested(obj, path, value) {
  var parts = path.split("/");
  var cur = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined || cur[parts[i]] === null) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function flattenTokens(obj, prefix) {
  var out = {};
  var p = prefix || "";
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = obj[k];
    var path = p ? p + "/" + k : k;
    if (v && typeof v === "object" && "value" in v) {
      out[path] = v;
    } else if (v && typeof v === "object") {
      var sub = flattenTokens(v, path);
      var subKeys = Object.keys(sub);
      for (var j = 0; j < subKeys.length; j++) {
        out[subKeys[j]] = sub[subKeys[j]];
      }
    }
  }
  return out;
}

function replaceAll(str, search, replace) {
  return str.split(search).join(replace);
}

// ── Figma 변수 → 토큰 JSON ────────────────────────────────────────────────────

async function readVariables() {
  var collections = await figma.variables.getLocalVariableCollectionsAsync();
  var allVars = await figma.variables.getLocalVariablesAsync();
  var varById = {};
  for (var i = 0; i < allVars.length; i++) {
    varById[allVars[i].id] = allVars[i];
  }

  var result = {};

  for (var ci = 0; ci < collections.length; ci++) {
    var col = collections[ci];
    var key = col.name.toLowerCase().replace(/\s+/g, "-");
    var modeId = col.defaultModeId;
    var tokens = {};

    for (var vi = 0; vi < allVars.length; vi++) {
      var v = allVars[vi];
      if (v.variableCollectionId !== col.id) continue;

      var raw = v.valuesByMode[modeId];
      if (raw === undefined) continue;

      var value, type;

      if (raw && raw.type === "VARIABLE_ALIAS") {
        var ref = varById[raw.id];
        value = ref ? "{" + replaceAll(ref.name, "/", ".") + "}" : raw.id;
        type = "alias";
      } else if (v.resolvedType === "COLOR") {
        value = rgbaToHex(raw);
        type = "color";
      } else if (v.resolvedType === "FLOAT") {
        value = String(raw);
        type = /spacing|padding|gap|margin/i.test(v.name) ? "spacing"
             : /radius/i.test(v.name) ? "borderRadius"
             : /font.?size/i.test(v.name) ? "fontSizes"
             : /font.?weight/i.test(v.name) ? "fontWeights"
             : "number";
      } else {
        value = String(raw);
        type = "string";
      }

      setNested(tokens, v.name, { value: value, type: type });
    }

    result[key] = tokens;
  }

  return result;
}

// ── 토큰 JSON → Figma 변수 ────────────────────────────────────────────────────

async function writeVariables(tokensByCollection) {
  var existingCols = await figma.variables.getLocalVariableCollectionsAsync();
  var existingVars = await figma.variables.getLocalVariablesAsync();

  var colMap = {};
  for (var i = 0; i < existingCols.length; i++) {
    var c = existingCols[i];
    colMap[c.name.toLowerCase().replace(/\s+/g, "-")] = c;
  }

  var varMap = {};
  for (var i = 0; i < existingVars.length; i++) {
    var v = existingVars[i];
    varMap[v.name + "::" + v.variableCollectionId] = v;
  }

  var created = 0, updated = 0;

  // 1패스: alias가 아닌 값 먼저
  var colKeys = Object.keys(tokensByCollection);
  for (var ci = 0; ci < colKeys.length; ci++) {
    var colKey = colKeys[ci];
    var tokenData = tokensByCollection[colKey];
    var flat = flattenTokens(tokenData);

    var col = colMap[colKey];
    if (!col) {
      col = figma.variables.createVariableCollection(colKey);
      colMap[colKey] = col;
    }
    var modeId = col.defaultModeId;

    var tokenPaths = Object.keys(flat);
    for (var ti = 0; ti < tokenPaths.length; ti++) {
      var path = tokenPaths[ti];
      var token = flat[path];
      if (String(token.value).charAt(0) === "{") continue;

      var resolvedType = token.type === "color" ? "COLOR"
        : (token.type === "spacing" || token.type === "borderRadius" || token.type === "fontSizes" || token.type === "fontWeights" || token.type === "number") ? "FLOAT"
        : "STRING";

      var mapKey = path + "::" + col.id;
      var variable = varMap[mapKey];
      if (!variable) {
        variable = figma.variables.createVariable(path, col, resolvedType);
        varMap[mapKey] = variable;
        created++;
      } else {
        updated++;
      }

      if (resolvedType === "COLOR") variable.setValueForMode(modeId, hexToRgba(token.value));
      else if (resolvedType === "FLOAT") variable.setValueForMode(modeId, parseFloat(token.value));
      else variable.setValueForMode(modeId, String(token.value));
    }
  }

  // 2패스: alias 설정
  var refreshedVars = await figma.variables.getLocalVariablesAsync();
  var varByName = {};
  for (var i = 0; i < refreshedVars.length; i++) {
    varByName[refreshedVars[i].name] = refreshedVars[i];
  }

  for (var ci = 0; ci < colKeys.length; ci++) {
    var colKey = colKeys[ci];
    var tokenData = tokensByCollection[colKey];
    var flat = flattenTokens(tokenData);
    var col = colMap[colKey];
    if (!col) continue;
    var modeId = col.defaultModeId;

    var tokenPaths = Object.keys(flat);
    for (var ti = 0; ti < tokenPaths.length; ti++) {
      var path = tokenPaths[ti];
      var token = flat[path];
      var rawVal = String(token.value);
      if (rawVal.charAt(0) !== "{") continue;

      var refName = replaceAll(rawVal.slice(1, -1), ".", "/");
      var refVar = varByName[refName];
      if (!refVar) continue;

      var mapKey = path + "::" + col.id;
      var variable = varMap[mapKey];
      if (!variable) continue;

      variable.setValueForMode(modeId, { type: "VARIABLE_ALIAS", id: refVar.id });
    }
  }

  return { created: created, updated: updated };
}

// ── 메시지 핸들러 ──────────────────────────────────────────────────────────────

figma.ui.onmessage = async function(msg) {
  switch (msg.type) {
    case "LOAD_SETTINGS": {
      var s = await figma.clientStorage.getAsync("token-sync-settings");
      figma.ui.postMessage({ type: "SETTINGS", data: s || {} });
      break;
    }
    case "SAVE_SETTINGS": {
      await figma.clientStorage.setAsync("token-sync-settings", msg.data);
      figma.ui.postMessage({ type: "SETTINGS_SAVED" });
      break;
    }
    case "READ_VARIABLES": {
      try {
        var tokens = await readVariables();
        figma.ui.postMessage({ type: "VARIABLES_DATA", tokens: tokens });
      } catch (e) {
        figma.ui.postMessage({ type: "ERROR", message: e.message });
      }
      break;
    }
    case "WRITE_VARIABLES": {
      try {
        var result = await writeVariables(msg.tokens);
        figma.ui.postMessage({ type: "WRITE_DONE", created: result.created, updated: result.updated });
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
