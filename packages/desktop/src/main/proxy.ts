import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// Applies the `proxy` value from the global opencode config to the process
// environment so Node runtimes (which snapshot HTTP(S)_PROXY when the global
// dispatcher is created) route through it. Bun applies the configured proxy
// per request instead and does not need this.
//
// Precedence for a model request is: model options -> provider options ->
// global `proxy` config -> environment. Per-model `proxy: false` bypasses the
// proxy per request and is handled in the server fetch wrapper.

const CONFIG_FILES = ["config.json", "opencode.json", "opencode.jsonc"]

export function globalConfigDir() {
  if (process.env.OPENCODE_CONFIG_DIR) return process.env.OPENCODE_CONFIG_DIR
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
  return join(base, "opencode")
}

// Minimal JSONC reader: strips // and /* */ comments plus trailing commas
// outside of strings, then parses. Only used to extract the top-level proxy
// value at startup; anything unparseable falls back to environment behavior.
function parseJsonc(text: string): unknown {
  let result = ""
  let inString = false
  let escaped = false
  let lineComment = false
  let blockComment = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]
    if (lineComment) {
      if (char === "\n") {
        lineComment = false
        result += char
      }
      continue
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false
        i++
      }
      continue
    }
    if (inString) {
      result += char
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      result += char
      continue
    }
    if (char === "/" && next === "/") {
      lineComment = true
      i++
      continue
    }
    if (char === "/" && next === "*") {
      blockComment = true
      i++
      continue
    }
    // Drop trailing commas before } or ] (only outside strings).
    if (char === ",") {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j]!)) j++
      if (text[j] === "}" || text[j] === "]") continue
    }
    result += char
  }
  return JSON.parse(result)
}

export function readGlobalProxy(): string | undefined {
  const dir = globalConfigDir()
  let proxy: string | undefined
  for (const file of CONFIG_FILES) {
    let text: string
    try {
      text = readFileSync(join(dir, file), "utf8")
    } catch {
      continue
    }
    try {
      const parsed = parseJsonc(text)
      if (typeof parsed === "object" && parsed !== null && typeof (parsed as Record<string, unknown>).proxy === "string") {
        const value = ((parsed as Record<string, unknown>).proxy as string).trim()
        if (value) proxy = value
      }
    } catch {
      continue
    }
  }
  return proxy
}

export function applyGlobalProxyToEnv(log?: (message: string, meta?: Record<string, unknown>) => void) {
  const proxy = readGlobalProxy()
  if (!proxy) return
  process.env.HTTP_PROXY = proxy
  process.env.HTTPS_PROXY = proxy
  process.env.http_proxy = proxy
  process.env.https_proxy = proxy
  log?.("applied proxy from global config", { proxy: redact(proxy) })
}

function redact(proxy: string) {
  try {
    const url = new URL(proxy.includes("://") ? proxy : `http://${proxy}`)
    if (url.password) url.password = "***"
    return url.toString()
  } catch {
    return "[unparseable]"
  }
}
