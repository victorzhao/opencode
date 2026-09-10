import { describe, expect, test } from "bun:test"
import { isValidProxyUrl, proxyModeOf, proxyModeValue } from "./proxy-settings-behavior"

describe("proxy settings behavior", () => {
  test("maps config values to follow/direct modes", () => {
    expect(proxyModeOf(false)).toBe("direct")
    expect(proxyModeOf(undefined)).toBe("follow")
    expect(proxyModeOf("")).toBe("follow")
    expect(proxyModeOf("http://127.0.0.1:7890")).toBe("follow")
  })

  test("encodes follow as empty so the server merge deletes the key", () => {
    expect(proxyModeValue("direct")).toBe(false)
    expect(proxyModeValue("follow")).toBe("")
  })

  test("accepts http/https/socks URLs with optional credentials", () => {
    expect(isValidProxyUrl("http://127.0.0.1:7890")).toBe(true)
    expect(isValidProxyUrl("https://user:pass@proxy.example.com:8080")).toBe(true)
    expect(isValidProxyUrl("socks5://127.0.0.1:1080")).toBe(true)
    expect(isValidProxyUrl("socks5h://127.0.0.1:1080")).toBe(true)
    expect(isValidProxyUrl("127.0.0.1:7890")).toBe(true)
  })

  test("rejects blank or unsupported values", () => {
    expect(isValidProxyUrl("")).toBe(false)
    expect(isValidProxyUrl("   ")).toBe(false)
    expect(isValidProxyUrl("ftp://proxy.example.com")).toBe(false)
    expect(isValidProxyUrl("http://")).toBe(false)
    expect(isValidProxyUrl("not a url at all !!!")).toBe(false)
  })
})
