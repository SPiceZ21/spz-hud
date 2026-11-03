// The other resources' UIs, each in its own full-screen layer.
//
// Every app is the resource's own page, copied to apps/<resource>/ by
// tools/sync-apps.mjs and loaded unchanged in an iframe. Lua messages for it
// arrive here as { type: 'app', app, msg } and are posted into its frame, so
// the app's own `window.addEventListener('message')` sees exactly what it saw
// before. Its NUI callbacks go straight to its resource (the copied index.html
// knows its resource name), not through here.
//
// Movable apps: an app whose entry has `move` (its main element) can be placed
// by the player in /hudedit like any widget. The offset and scale are applied
// with a style rule injected into the app's page, so the app's code is
// untouched and an element it re-creates (hide → show) keeps the placement.
//
// Work is done imperatively on the iframes: an app message never re-renders
// the HUD.
import { useEffect, useRef, useState } from 'preact/hooks'
import type { Placement } from './types'

export interface Movable {
  sel: string            // the app's main element (must not set its own transform)
  label: string
  origin: string         // transform-origin: the corner it is pinned by
  /** Sent into the app while placing it if it isn't on screen (e.g. on foot). */
  demo?: { on: unknown[]; off: unknown[] }
}

export interface AppEntry { res: string; z: number; move?: Movable }

interface Slot {
  frame: HTMLIFrameElement | null
  ready: boolean
  queue: unknown[]
}

const slots = new Map<string, Slot>()
const slot = (res: string) => {
  let s = slots.get(res)
  if (!s) slots.set(res, (s = { frame: null, ready: false, queue: [] }))
  return s
}

/** Called from the page's message handler. */
export function toApp(res: string, msg: unknown) {
  const s = slot(res)
  if (s.ready && s.frame?.contentWindow) s.frame.contentWindow.postMessage(msg, '*')
  else s.queue.push(msg)
}

let reloadHook: (res: string) => void = () => {}
export const reloadApp = (res: string) => reloadHook(res)

// ── Placement of movable apps ───────────────────────────────────────────────

export const appKey = (res: string) => `app:${res}`
export const APP_HOME: Placement = { x: 0, y: 0, scale: 1 }

const placed = new Map<string, { move: Movable; p: Placement }>()

function docOf(res: string): Document | null {
  try { return slots.get(res)?.frame?.contentDocument ?? null } catch { return null }
}

/** Write (or rewrite) the placement rule inside the app's page. */
function applyPlacement(res: string) {
  const entry = placed.get(res)
  const doc = docOf(res)
  if (!entry || !doc?.head) return
  const { move, p } = entry
  let tag = doc.getElementById('spz-hud-place') as HTMLStyleElement | null
  if (!tag) {
    tag = doc.createElement('style')
    tag.id = 'spz-hud-place'
    doc.head.appendChild(tag)
  }
  const home = p.x === 0 && p.y === 0 && p.scale === 1
  tag.textContent = home ? '' :
    `${move.sel}{transform:translate(${p.x}vw,${p.y}vh) scale(${p.scale}) !important;` +
    `transform-origin:${move.origin} !important}` +
    (p.hidden ? `${move.sel}{visibility:hidden !important}` : '')
}

export function placeApp(res: string, move: Movable, p: Placement) {
  placed.set(res, { move, p })
  applyPlacement(res)
}

/** Screen rect of a movable app's element, or null while it isn't drawn. */
export function appRect(res: string, sel: string): DOMRect | null {
  const el = docOf(res)?.querySelector(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? r : null
}

// ── Layers ──────────────────────────────────────────────────────────────────

// Frames finish `load` before a Preact/React app has run its effects (where
// the message listener is added), so queued messages wait a moment longer.
const SETTLE_MS = 150

export function AppHost({ focus, onApps }: { focus: string | null; onApps?: (a: AppEntry[]) => void }) {
  const [apps, setApps] = useState<AppEntry[]>([])
  const [gen, setGen] = useState<Record<string, number>>({})
  const focusRef = useRef(focus)

  useEffect(() => {
    fetch('./apps/apps.json')
      .then(r => r.json())
      .then((list: AppEntry[]) => { setApps(list); onApps?.(list) })
      .catch(() => setApps([]))
    reloadHook = res => {
      const s = slot(res)
      s.ready = false
      s.queue = []
      setGen(g => ({ ...g, [res]: (g[res] || 0) + 1 }))
    }
  }, [])

  // The focused app gets the keyboard; give it back to nobody on release so
  // a key press doesn't land in a frame that no longer has focus.
  useEffect(() => {
    focusRef.current = focus
    const f = focus ? slots.get(focus)?.frame : null
    if (f) { f.focus(); f.contentWindow?.focus() }
    else if (document.activeElement instanceof HTMLIFrameElement) document.activeElement.blur()
  }, [focus])

  const onLoad = (res: string) => {
    const s = slot(res)
    applyPlacement(res)                    // a reloaded page starts without the rule
    setTimeout(() => {
      s.ready = true
      const w = s.frame?.contentWindow
      if (w) for (const m of s.queue) w.postMessage(m, '*')
      s.queue = []
      if (focusRef.current === res) { s.frame?.focus(); w?.focus() }
    }, SETTLE_MS)
  }

  return (
    <>
      {apps.map(a => (
        <iframe
          key={`${a.res}:${gen[a.res] || 0}`}
          class="app"
          data-app={a.res}
          data-focus={focus === a.res}
          style={{ zIndex: focus === a.res ? 1000 : a.z }}
          src={`./apps/${a.res}/index.html`}
          ref={el => { slot(a.res).frame = el }}
          onLoad={() => onLoad(a.res)}
          allow="autoplay"
          tabIndex={-1}
        />
      ))}
    </>
  )
}

// ── Edit mode: drag handles over movable apps ───────────────────────────────

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function AppMovers({ apps, layout, snap, onMove }: {
  apps: AppEntry[]
  layout: Record<string, Placement>
  snap: number
  onMove: (key: string, p: Placement) => void
}) {
  const movable = apps.filter(a => a.move)
  const [, tick] = useState(0)
  const drag = useRef<{ key: string; sx: number; sy: number; o: Placement } | null>(null)

  // Not on screen (on foot, not in a race…): show the demo state while placing.
  useEffect(() => {
    const demoed: AppEntry[] = []
    for (const a of movable) {
      if (!appRect(a.res, a.move!.sel) && a.move!.demo) {
        for (const m of a.move!.demo.on) toApp(a.res, m)
        demoed.push(a)
      }
    }
    // The element moves while dragging and re-lays out on its own: re-measure.
    let raf = 0
    const loop = () => { tick(n => n + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      for (const a of demoed) for (const m of a.move!.demo!.off) toApp(a.res, m)
    }
  }, [])

  return (
    <>
      {movable.map(a => {
        const key = appKey(a.res)
        const p = layout[key] ?? APP_HOME
        const r = appRect(a.res, a.move!.sel)
        if (!r) return null
        const down = (e: PointerEvent) => {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          drag.current = { key, sx: e.clientX, sy: e.clientY, o: p }
        }
        const move = (e: PointerEvent) => {
          const d = drag.current
          if (!d || d.key !== key) return
          const step = snap > 0 ? snap : 0.1
          const nx = d.o.x + ((e.clientX - d.sx) / window.innerWidth) * 100
          const ny = d.o.y + ((e.clientY - d.sy) / window.innerHeight) * 100
          onMove(key, { ...p, x: clamp(Math.round(nx / step) * step, -100, 100), y: clamp(Math.round(ny / step) * step, -100, 100) })
        }
        const wheel = (e: WheelEvent) => {
          e.preventDefault()
          onMove(key, { ...p, scale: clamp(Math.round((p.scale - Math.sign(e.deltaY) * 0.05) * 100) / 100, 0.5, 2) })
        }
        return (
          <div
            key={key}
            class="frame mover"
            data-edit="true"
            data-off={p.hidden === true}
            style={{ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={() => { drag.current = null }}
            onWheel={wheel}
          >
            <div class="frame-tag">
              <span>{a.move!.label}</span>
              <span class="frame-scale">{Math.round(p.scale * 100)}%</span>
              <button class="frame-eye" onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onMove(key, { ...p, hidden: !p.hidden }) }}>
                {p.hidden ? 'show' : 'hide'}
              </button>
              <button class="frame-eye" onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onMove(key, APP_HOME) }}>
                reset
              </button>
            </div>
          </div>
        )
      })}
    </>
  )
}
