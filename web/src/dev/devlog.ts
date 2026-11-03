// Browser preview only: what the apps post back (NUI callbacks) and what the
// panel sent, plus the stub answers callbacks get. Nothing here runs in game.
export interface LogEntry {
  id: number
  at: number
  dir: 'out' | 'in'            // out = panel → app, in = app → "Lua" (callback)
  res: string
  name: string
  data: unknown
}

let seq = 0
const entries: LogEntry[] = []
const subs = new Set<() => void>()
const MAX = 300

export function log(dir: LogEntry['dir'], res: string, name: string, data: unknown) {
  entries.push({ id: ++seq, at: Date.now(), dir, res, name, data })
  if (entries.length > MAX) entries.splice(0, entries.length - MAX)
  subs.forEach(fn => fn())
}
export const getLog = () => entries
export const clearLog = () => { entries.length = 0; subs.forEach(fn => fn()) }
export function onLog(fn: () => void) { subs.add(fn); return () => { subs.delete(fn) } }

// Stub answers: "<resource>/<callback>" → JSON value. Default {}.
const STUB_KEY = 'spz-hud:dev:stubs'
let stubs: Record<string, unknown> = {}
try { stubs = JSON.parse(localStorage.getItem(STUB_KEY) || '{}') } catch { stubs = {} }
export const getStubs = () => stubs
export function setStub(key: string, value: unknown | undefined) {
  if (value === undefined) delete stubs[key]; else stubs[key] = value
  try { localStorage.setItem(STUB_KEY, JSON.stringify(stubs)) } catch { /* private mode */ }
}

/**
 * Point an app frame's fetch at the log: https://<resource>/<callback> is a
 * NUI callback in game; here it is logged and answered from the stubs.
 * Any other URL (GIPHY, images, …) goes out as normal.
 */
export function patchFrame(res: string, w: Window) {
  const real = w.fetch.bind(w)
  w.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    const m = url.match(/^https:\/\/([\w-]+)\/(.+)$/)        // no dot in the host = a resource name
    if (!m) return real(input as RequestInfo, init)
    let body: unknown = init?.body
    try { if (typeof body === 'string') body = JSON.parse(body) } catch { /* leave as text */ }
    const [, host, name] = m
    log('in', host, name, body)
    const answer = stubs[`${host}/${name}`] ?? {}
    return Promise.resolve(new Response(JSON.stringify(answer), { headers: { 'Content-Type': 'application/json' } }))
  }) as typeof fetch
  void res
}
