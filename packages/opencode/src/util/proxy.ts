// Per-model proxy resolution and enforcement.
//
// Precedence for a model request: model options -> provider options -> global
// `proxy` config -> process environment. `false` forces a direct connection, a
// non-empty string selects that proxy URL, and unset/empty inherits.
//
// Enforcement differs by runtime: Bun supports a per-request `proxy` fetch
// option, while Node (undici) snapshots `http_proxy`/`https_proxy` when the
// global dispatcher is created but re-reads `no_proxy` on demand. Per-request
// routing on Node is therefore only possible for the bypass direction, via a
// temporary `NO_PROXY=*` guarded by a process-wide mutex so concurrent
// requests never observe the swapped value.

export type Setting = string | false | undefined

export function normalize(value: unknown): Setting {
  if (value === false) return false
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export function resolveProxy(model: unknown, provider: unknown, global: unknown): Setting {
  return normalize(model) ?? normalize(provider) ?? normalize(global)
}

export function isBunRuntime() {
  return typeof Bun !== "undefined"
}

export function hasBypass(value: { options?: { proxy?: unknown }; models?: Record<string, { options?: { proxy?: unknown } }> }) {
  if (value.options?.proxy === false) return true
  if (!value.models) return false
  return Object.values(value.models).some((model) => model.options?.proxy === false)
}

let tail: Promise<void> = Promise.resolve()

function acquire() {
  const previous = tail
  let release!: () => void
  const next = new Promise<void>((resolve) => {
    release = resolve
  })
  tail = previous.then(() => next)
  return previous.then(() => release)
}

// Serializes proxy-sensitive fetches on Node. The lock is held only until the
// response headers arrive; streaming continues after release.
export async function withProxyLock<T>(fn: () => Promise<T>): Promise<T> {
  const release = await acquire()
  try {
    return await fn()
  } finally {
    release()
  }
}

// Forces a direct connection on Node by temporarily excluding every host via
// `NO_PROXY`, which undici re-reads for each request.
export async function withDirectConnection<T>(fn: () => Promise<T>): Promise<T> {
  const release = await acquire()
  const previous = process.env.NO_PROXY
  const previousLower = process.env.no_proxy
  process.env.NO_PROXY = "*"
  process.env.no_proxy = "*"
  try {
    return await fn()
  } finally {
    if (previous === undefined) delete process.env.NO_PROXY
    else process.env.NO_PROXY = previous
    if (previousLower === undefined) delete process.env.no_proxy
    else process.env.no_proxy = previousLower
    release()
  }
}

export * as ModelProxy from "./proxy"
