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
  id: string             // layout key part: app:<resource>:<id>
  sel: string            // the element in the app's page
  label: string
  origin: string         // the corner it scales from
}

export interface AppEntry {
  res: string
  z: number
  moves?: Movable[]
  /** Sent while placing if some of the app's elements aren't drawn, then undone. */
  demo?: { on: unknown[]; off: unknown[] }
}

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

let reloadHook: (res: string, mock?: boolean) => void = () => {}
/** Reload an app's layer. mock = browser preview only: load it as a plain page
 *  so it runs its own mock mode (see NAME_SHIM in tools/sync-apps.mjs). */
export const reloadApp = (res: string, mock?: boolean) => reloadHook(res, mock)

// ── Placement of movable apps ───────────────────────────────────────────────

export const moveKey = (res: string, id: string) => `app:${res}:${id}`
export const APP_HOME: Placement = { x: 0, y: 0, scale: 1 }

// `translate` / `scale` ADD to an element's own transform, so an app's
// animations keep working. An engine without them gets `transform`, which
// replaces the element's own (fine for the ones that have none).
const individual = typeof CSS !== 'undefined' && CSS.supports?.('translate', '1px 1px') === true

const placed = new Map<string, { moves: Movable[]; layout: Record<string, Placement> }>()

function docOf(res: string): Document | null {
  try { return slots.get(res)?.frame?.contentDocument ?? null } catch { return null }
}

function rule(m: Movable, p: Placement) {
  const moved = p.x !== 0 || p.y !== 0
  const scaled = p.scale !== 1
  let css = ''
  if (moved || scaled) {
    css += individual
      ? `${m.sel}{` +
        (moved ? `translate:${p.x}vw ${p.y}vh !important;` : '') +
        (scaled ? `scale:${p.scale} !important;transform-origin:${m.origin} !important;` : '') + '}'
      : `${m.sel}{transform:translate(${p.x}vw,${p.y}vh) scale(${p.scale}) !important;transform-origin:${m.origin} !important}`
  }
  if (p.hidden) css += `${m.sel}{visibility:hidden !important}`
  return css
}

/** Write (or rewrite) the placement rules inside the app's page. */
function applyPlacement(res: string) {
  const entry = placed.get(res)
  const doc = docOf(res)
  if (!entry || !doc?.head) return
  let tag = doc.getElementById('spz-hud-place') as HTMLStyleElement | null
  if (!tag) {
    tag = doc.createElement('style')
    tag.id = 'spz-hud-place'
    doc.head.appendChild(tag)
  }
  tag.textContent = entry.moves.map(m => rule(m, entry.layout[moveKey(res, m.id)] ?? APP_HOME)).join('\n')
}

export function placeApp(res: string, moves: Movable[], layout: Record<string, Placement>) {
  placed.set(res, { moves, layout })
  applyPlacement(res)
}

/** Screen rect of a movable element, or null while it isn't drawn. */
export function appRect(res: string, sel: string): DOMRect | null {
  const doc = docOf(res)
  const el = doc?.querySelector(sel)
  if (!el || !doc?.defaultView) return null
  const r = el.getBoundingClientRect()
  if (!(r.width > 0 && r.height > 0)) return null
  // Present but faded out or hidden (a card between showings) is not drawn.
  const win = doc.defaultView
  for (let n: Element | null = el; n; n = n.parentElement) {
    const cs = win.getComputedStyle(n)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) {
      // Our own "hide" rule is visibility: hidden — that element still counts.
      if (n === el && cs.visibility === 'hidden' && cs.display !== 'none' && Number(cs.opacity) >= 0.05) break
      return null
    }
  }
  return r
}

// ── Layers ──────────────────────────────────────────────────────────────────

// Frames finish `load` before a Preact/React app has run its effects (where
// the message listener is added), so queued messages wait a moment longer.
const SETTLE_MS = 150

export function AppHost({ focus, onApps, hidden = {} }: {
  focus: string | null
  onApps?: (a: AppEntry[]) => void
  /** Layers switched off by a HUD setting (e.g. the analogue speedometer in digital mode). */
  hidden?: Record<string, boolean>
}) {
  const [apps, setApps] = useState<AppEntry[]>([])
  const [gen, setGen] = useState<Record<string, number>>({})
  const [mocked, setMocked] = useState<Record<string, boolean>>({})
  const focusRef = useRef(focus)

  useEffect(() => {
    fetch('./apps/apps.json')
      .then(r => r.json())
      .then((list: AppEntry[]) => { setApps(list); onApps?.(list) })
      .catch(() => setApps([]))
    reloadHook = (res, mock) => {
      const s = slot(res)
      s.ready = false
      s.queue = []
      setMocked(m => ({ ...m, [res]: !!mock }))
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
          style={{ zIndex: focus === a.res ? 1000 : a.z, display: hidden[a.res] ? 'none' : undefined }}
          src={`./apps/${a.res}/index.html${mocked[a.res] ? '?spzmock=1' : ''}`}
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
  const [, tick] = useState(0)
  const drag = useRef<{ key: string; sx: number; sy: number; o: Placement } | null>(null)

  // Apps with elements not on screen (on foot, not racing…) show their demo
  // while placing, and take it down afterwards.
  useEffect(() => {
    const demoed = apps.filter(a => a.demo && a.moves?.some(m => !appRect(a.res, m.sel)))
    for (const a of demoed) for (const m of a.demo!.on) toApp(a.res, m)
    // Elements move while dragging and re-lay out on their own: re-measure.
    let raf = 0
    const loop = () => { tick(n => n + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      for (const a of demoed) for (const m of a.demo!.off) toApp(a.res, m)
    }
  }, [])

  const handles: preact.JSX.Element[] = []
  for (const a of apps) for (const mv of a.moves ?? []) {
    const key = moveKey(a.res, mv.id)
    const p = layout[key] ?? APP_HOME
    const r = appRect(a.res, mv.sel)
    if (!r) continue
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
    handles.push(
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
        <div class="frame-tag" data-below={r.top < 34}>
          <span>{mv.label}</span>
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
      </div>,
    )
  }
  return <>{handles}</>
}

// ── Hub mode ─────────────────────────────────────────────────────────────────
// The hub draws some apps inside its frame. `data-hub` on the app's <html>
// switches its design rules (design/apps/<resource>.css) to the hub layout.
/** sub: the section has sub-tabs above it, so the content starts lower. */
export function setHubMode(res: string, on: boolean, sub = false) {
  const el = docOf(res)?.documentElement
  if (!el) return
  if (on) el.setAttribute('data-hub', sub ? 'sub' : '1'); else el.removeAttribute('data-hub')
}

/** The app's window (same origin), e.g. to catch the hub's keys inside it. */
export function appWindow(res: string): Window | null {
  try { return slots.get(res)?.frame?.contentWindow ?? null } catch { return null }
}
