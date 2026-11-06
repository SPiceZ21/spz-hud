import { useEffect, useRef, useState } from 'preact/hooks'
import { publish, peek } from './core/bus'
import { post, inGame } from './core/nui'
import { ANCHOR_SHIFT, type GameState, type Layout, type Placement, type WidgetDef } from './core/types'
import { WIDGETS } from './widgets'
import { AppHost, AppMovers, demoOff, placeApp, toApp, reloadApp, type AppEntry } from './core/apps'
import { Cover } from './core/Cover'
import type { FunctionComponent } from 'preact'
import { Hub, type HubProfile } from './hub/Hub'

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

// Handshake with client/main.lua. Until 'ready' lands, Lua queues every
// message (layout, widgets, edit mode, the hub, every app), so a lost 'ready'
// left the page blank with only the cursor. It used to be posted once: on a
// resource restart the cached page could post it before the Lua callback
// existed, and nothing ever retried. Now it is retried until Lua answers, and
// sent again whenever Lua pings.
let helloRunning = false
async function hello() {
  if (!inGame || helloRunning) return
  helloRunning = true
  try {
    for (let i = 0; i < 600; i++) {
      const r = await Promise.race([
        post<boolean>('ready'),
        new Promise<null>(res => setTimeout(() => res(null), 1500)),   // a post to a missing callback may never answer
      ])
      if (r === true) return
      await new Promise(res => setTimeout(res, 500))
    }
  } finally {
    helloRunning = false
  }
}

export function App() {
  const [defs, setDefs] = useState<WidgetDef[]>([])
  const [layout, setLayout] = useState<Layout>({})
  const [state, setState] = useState<GameState>('freeroam')
  const [forcedOff, setForcedOff] = useState<Record<string, true>>({})
  const [hidden, setHidden] = useState(false)
  // Transition cover: closed while any source wants it (Lua fades / race join,
  // the spawn page, the race page's grid reset). Last status wins.
  const [cover, setCover] = useState<{ by: Record<string, true>; status?: string }>({ by: {} })
  const coverOn = (src: string, on: boolean, status?: string) => setCover(c => {
    const by = { ...c.by }
    if (on) by[src] = true; else delete by[src]
    return { by, status: on && status ? status : c.status }
  })
  const coverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editing, setEditing] = useState(false)
  const [snap, setSnap] = useState(0.5)
  const [focus, setFocus] = useState<string | null>(null)
  // The SPiceZ hub (TAB): client/hub.lua opens and closes it.
  const [hub, setHub] = useState<{ open: boolean; profile: HubProfile }>({ open: false, profile: {} })
  // HUD settings: the switches in /hudedit, stored with the layout (client/main.lua).
  const [settings, setSettings] = useState<Record<string, string>>({})
  const digital = settings.speedo === 'digital'
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
      demoOff()
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
          setSettings(m.settings || {})
          if (typeof m.snap === 'number') setSnap(m.snap)
          break
        case 'app':
          toApp(m.app, m.msg)
          // The digital speedometer reads the same feed as the analogue gauge.
          if (m.app === 'spz-speedometer' && m.msg) {
            if (m.msg.type === 'update') publish('speedo_digital', m.msg)
            else if (m.msg.type === 'hide') publish('speedo_digital', false)
          }
          // The spawn and race pages' covers are drawn here (their own are off).
          if (m.app === 'spz-spawn' && m.msg) {
            if (m.msg.type === 'showCover') coverOn('spawn', true, 'Preparing your session')
            else if (m.msg.type === 'hideCover') coverOn('spawn', false)
          }
          if (m.app === 'spz-raceUI' && m.msg?.action === 'raceIntro') {
            const phase = m.msg.data?.phase ?? m.msg.phase
            if (coverTimer.current) { clearTimeout(coverTimer.current); coverTimer.current = null }
            if (phase === 'cover') coverOn('race', true, 'Staging the grid')
            // The race page starts its briefing card as the sweep opens.
            else if (phase === 'reveal') coverTimer.current = setTimeout(() => coverOn('race', false), 180)
            else coverOn('race', false)
          }
          break
        case 'cover': coverOn(m.src || 'lua', !!m.on, m.status); break
        // client/main.lua pings until the handshake below has landed.
        case 'ping':  hello(); break
        case 'appReload': reloadApp(m.app, !inGame && m.mock === true); break
        case 'focus':     setFocus(m.owner ?? null); break
        case 'hub':       setHub(h => ({ open: !!m.on, profile: m.profile || h.profile })); break
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
    hello()

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
    for (const a of apps) if (a.moves) placeApp(a.res, a.moves, layout)
  }, [apps, layout])

  // Exactly one speedometer: the analogue gauge (spz-speedometer's own page) or
  // the digital widget, by the player's setting.
  const visibleDefs = defs.filter(d =>
    (d.id !== 'speedo_digital' || digital) &&
    (editing || (d.states[state] && !forcedOff[d.id])))
  const hiddenApps = { 'spz-speedometer': digital }
  const movableApps = digital ? apps.filter(a => a.res !== 'spz-speedometer') : apps

  return (
    <>
    <AppHost focus={focus} onApps={setApps} hidden={hiddenApps} />
    {Dev && <Dev />}
    <Hub open={hub.open} profile={hub.profile} />
    <Cover on={Object.keys(cover.by).length > 0} status={cover.status} />
    <div class="hud" data-hidden={(hidden || hub.open) && !editing} data-edit={editing}>
      {editing && <div class="grid" />}
      {editing && <AppMovers apps={movableApps} layout={layout} snap={snap} onMove={move} />}
      {visibleDefs.map(d => (
        <Frame key={d.id} def={d} place={placementOf(d, layout)} editing={editing} snap={snap} onMove={move} />
      ))}
      {editing && (
        <div class="toolbar">
          <div class="toolbar-title">HUD layout</div>
          <div class="toolbar-hint">Drag to move · scroll to resize · Esc to cancel</div>
          <div class="toolbar-settings">
            <span class="toolbar-label">Speedometer</span>
            <div class="seg">
              <button data-on={!digital} onClick={() => setSettings(x => ({ ...x, speedo: 'analogue' }))}>Analogue</button>
              <button data-on={digital} onClick={() => setSettings(x => ({ ...x, speedo: 'digital' }))}>Digital</button>
            </div>
          </div>
          <div class="toolbar-btns">
            <button class="btn ghost" onClick={() => post('resetLayout')}>Reset</button>
            <button class="btn ghost" onClick={() => post('cancelEdit')}>Cancel</button>
            <button class="btn primary" onClick={() => post('saveLayout', { layout, settings })}>Save</button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
