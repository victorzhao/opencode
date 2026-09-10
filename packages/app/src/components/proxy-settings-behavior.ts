// Pure helpers for the proxy settings UI. Runtime resolution order is:
// model options -> provider options -> global `proxy` config -> environment.
// `false` forces a direct connection, a non-empty string selects that proxy,
// and unset/empty inherits. Kept free of Solid contexts so it stays unit
// testable; the context-bound controller lives in `./proxy-settings`.

export type ProxyMode = "follow" | "direct"

export function proxyModeOf(value: unknown): ProxyMode {
  return value === false ? "direct" : "follow"
}

// Encodes a mode back to config. "follow" is stored as "" so the server merge
// deletes the key (see `stripEmptyProxy` in the opencode config service)
// instead of persisting a meaningless empty value.
export function proxyModeValue(mode: ProxyMode): string | false {
  return mode === "direct" ? false : ""
}

const PROXY_SCHEMES = new Set(["http:", "https:", "socks5:", "socks5h:", "socks:"])

export function isValidProxyUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  let url: URL
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`)
  } catch {
    return false
  }
  if (!PROXY_SCHEMES.has(url.protocol)) return false
  return url.hostname.length > 0
}
