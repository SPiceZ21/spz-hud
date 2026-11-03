import { useEffect, useRef, useState } from 'preact/hooks'
import { publish, peek } from './core/bus'
import { post, inGame } from './core/nui'
import { ANCHOR_SHIFT, type GameState, type Layout, type Placement, type WidgetDef } from './core/types'
import { WIDGETS } from './widgets'
import { AppHost, AppMovers, APP_HOME, appKey, placeApp, toApp, reloadApp, type AppEntry } from './core/apps'
import type { FunctionComponent } from 'preact'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function placementOf(def: WidgetDef, layout: Layout): Placement {
  return layout[def.id] ?? { x: def.x, y: def.y, scale: def.scale }
}

// ── One widget on screen ─────────────────────────────────────────────────────

interface FrameProps {
  def: WidgetDef
  place: Placement
  editing: boolean
  snap: number
  onMove: (id: string, p: Placement) => void
}

function Frame({ def, place, editing, snap, onMove }: FrameProps) {
  const W = WIDGETS[def.id]
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  if (!W) return null
  if (place.hidden && !editing) return null

  const [ax, ay] = ANCHOR_SHIFT[def.anchor] ?? ANCHOR_SHIFT.tl
  const origin = `${-ax}% ${-ay}%`

  const down = (e: PointerEvent) => {
    if (!editing) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { sx: e.clientX, sy: e.clientY, ox: place.x, oy: place.y }
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const step = snap > 0 ? snap : 0.1
    const nx = d.ox + ((e.clientX - d.sx) / window.innerWidth) * 100
    const ny = d.oy + ((e.clientY - d.sy) / window.innerHeight) * 100
    onMove(def.id, {
      ...place,
      x: clamp(Math.round(nx / step) * step, 0, 100),
      y: clamp(Math.round(ny / step) * step, 0, 100),
    })
  }
  const up = () => { drag.current = null }
  const wheel = (e: WheelEvent) => {
    if (!editing) return
    e.preventDefault()
    const s = clamp(Math.round((place.scale - Math.sign(e.deltaY) * 0.05) * 100) / 100, 0.5, 2)
    onMove(def.id, { ...place, scale: s })
  }
  const toggle = (e: MouseEvent) => {
    e.stopPropagation()
    onMove(def.id, { ...place, hidden: !place.hidden })
  }

  const View = W.view
  return (
    <div
      class="frame"
      data-edit={editing}
      data-off={place.hidden === true}
      style={{
        left: `${place.x}%`,
        top: `${place.y}%`,
        transform: `translate(${ax}%, ${ay}%) scale(${place.scale})`,
        transformOrigin: origin,
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onWheel={wheel}
    >
      <View id={def.id} />
      {editing && (
        <div class="frame-tag">
          <span>{def.label}</span>
          <span class="frame-scale">{Math.round(place.scale * 100)}%</span>
          <button class="frame-eye" onPointerDown={e => e.stopPropagation()} onClick={toggle}>
            {place.hidden ? 'show' : 'hide'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── The page ─────────────────────────────────────────────────────────────────

export function App() {
  const [defs, setDefs] = useState<WidgetDef[]>([])
  const [layout, setLayout] = useState<Layout>({})
  const [state, setState] = useState<GameState>('freeroam')
  const [forcedOff, setForcedOff] = useState<Record<string, true>>({})
  const [hidden, setHidden] = useState(false)
  const [editing, setEditing] = useState(false)
  const [snap, setSnap] = useState(0.5)
  const [focus, setFocus] = useState<string | null>(null)
  // Browser preview: the dev panel, loaded as its own chunk (never in game).
  const [Dev, setDev] = useState<FunctionComponent | null>(null)
  useEffect(() => { if (!inGame) import('./dev/DevPanel').then(m => setDev(() => m.DevPanel)) }, [])
  const sampled = useRef<string[]>([])
  const defsRef = useRef(defs)
  defsRef.current = defs

  // Edit mode shows sample data in widgets that have nothing live, so an empty
  // speedometer (on foot) can still be placed. Cleared again on exit.
  const setEdit = (on: boolean) => {
    if (on) {
      sampled.current = []
      for (const d of defsRef.current) {
        const s = WIDGETS[d.id]?.sample
        if (s !== undefined && !peek(d.id)) { publish(d.id, s); sampled.current.push(d.id) }
      }
    } else {
      for (const id of sampled.current) if (peek(id) === WIDGETS[id]?.sample) publish(id, false)
      sampled.current = []
    }
    setEditing(on)
  }

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data
      if (!m || typeof m.type !== 'string') return
      switch (m.type) {
        case 'registry':
          setDefs(m.widgets || [])
          setLayout(m.layout || {})
          if (typeof m.snap === 'number') setSnap(m.snap)
          break
        case 'app':       toApp(m.app, m.msg); break
        case 'appReload': reloadApp(m.app); break
        case 'focus':     setFocus(m.owner ?? null); break
        case 'data':    publish(m.id, m.data); break
        case 'state':   setState(m.state); break
        case 'hidden':  setHidden(!!m.hidden); break
        case 'edit':    setEdit(!!m.on); break
        case 'visible':
          setForcedOff(f => {
            const n = { ...f }
            if (m.visible) delete n[m.id]; else n[m.id] = true
            return n
          })
          break
      }
    }
    window.addEventListener('message', onMsg)
    post('ready')

    return () => window.removeEventListener('message', onMsg)
  }, [])

  useEffect(() => {
    if (!editing) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') post('cancelEdit') }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [editing])

  const move = (id: string, p: Placement) => setLayout(l => ({ ...l, [id]: p }))

  // Movable apps follow the layout live (while dragging, and when a saved or
  // reset layout arrives from Lua).
  const [apps, setApps] = useState<AppEntry[]>([])
  useEffect(() => {
    for (const a of apps) if (a.move) placeApp(a.res, a.move, layout[appKey(a.res)] ?? APP_HOME)
  }, [apps, layout])

  const visibleDefs = defs.filter(d => editing || (d.states[state] && !forcedOff[d.id]))

  return (
    <>
    <AppHost focus={focus} onApps={setApps} />
    {Dev && <Dev />}
    <div class="hud" data-hidden={hidden && !editing} data-edit={editing}>
      {editing && <div class="grid" />}
      {editing && <AppMovers apps={apps} layout={layout} snap={snap} onMove={move} />}
      {visibleDefs.map(d => (
        <Frame key={d.id} def={d} place={placementOf(d, layout)} editing={editing} snap={snap} onMove={move} />
      ))}
      {editing && (
        <div class="toolbar">
          <div class="toolbar-title">HUD layout</div>
          <div class="toolbar-hint">Drag to move · scroll to resize · Esc to cancel</div>
          <div class="toolbar-btns">
            <button class="btn ghost" onClick={() => post('resetLayout')}>Reset</button>
            <button class="btn ghost" onClick={() => post('cancelEdit')}>Cancel</button>
            <button class="btn primary" onClick={() => post('saveLayout', { layout })}>Save</button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
