import { describe, expect, test } from "bun:test"
import {
  hasBypass,
  isBunRuntime,
  normalize,
  resolveProxy,
  withDirectConnection,
  withProxyLock,
} from "../../src/util/proxy"

describe("model proxy", () => {
  test("normalizes settings with empty inheriting", () => {
    expect(normalize(false)).toBe(false)
    expect(normalize("http://127.0.0.1:7890")).toBe("http://127.0.0.1:7890")
    expect(normalize("  https://proxy.example.com  ")).toBe("https://proxy.example.com")
    expect(normalize(undefined)).toBeUndefined()
    expect(normalize("")).toBeUndefined()
    expect(normalize("   ")).toBeUndefined()
    expect(normalize(true)).toBeUndefined()
    expect(normalize(0)).toBeUndefined()
  })

  test("resolves model -> provider -> global precedence", () => {
    expect(resolveProxy(false, "http://a", "http://b")).toBe(false)
    expect(resolveProxy("http://m", "http://a", "http://b")).toBe("http://m")
    expect(resolveProxy(undefined, false, "http://b")).toBe(false)
    expect(resolveProxy(undefined, "http://a", "http://b")).toBe("http://a")
    expect(resolveProxy(undefined, undefined, "http://b")).toBe("http://b")
    expect(resolveProxy("", "", "")).toBeUndefined()
    expect(resolveProxy(undefined, undefined, undefined)).toBeUndefined()
  })

  test("detects configured bypasses", () => {
    expect(hasBypass({})).toBe(false)
    expect(hasBypass({ options: {} })).toBe(false)
    expect(hasBypass({ options: { proxy: "http://a" } })).toBe(false)
    expect(hasBypass({ options: { proxy: false } })).toBe(true)
    expect(hasBypass({ models: { m: { options: { proxy: false } } } })).toBe(true)
    expect(hasBypass({ models: { m: { options: {} } } })).toBe(false)
  })

  test("reports the bun runtime", () => {
    expect(isBunRuntime()).toBe(typeof Bun !== "undefined")
  })

  test("serializes lock holders in order", async () => {
    const order: number[] = []
    await Promise.all(
      [1, 2, 3].map((n) =>
        withProxyLock(async () => {
          await Bun.sleep(5)
          order.push(n)
        }),
      ),
    )
    expect(order).toEqual([1, 2, 3])
  })

  test("swaps NO_PROXY=* and restores it afterwards", async () => {
    const previous = process.env.NO_PROXY
    const previousLower = process.env.no_proxy
    let observed: string | undefined
    let observedLower: string | undefined
    await withDirectConnection(async () => {
      observed = process.env.NO_PROXY
      observedLower = process.env.no_proxy
    })
    expect(observed).toBe("*")
    expect(observedLower).toBe("*")
    expect(process.env.NO_PROXY).toBe(previous)
    expect(process.env.no_proxy).toBe(previousLower)
  })

  test("restores NO_PROXY even when the fetch fails", async () => {
    const previous = process.env.NO_PROXY
    await expect(
      withDirectConnection(async () => {
        throw new Error("boom")
      }),
    ).rejects.toThrow("boom")
    expect(process.env.NO_PROXY).toBe(previous)
  })
})
