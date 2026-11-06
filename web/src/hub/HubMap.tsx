// The hub's Map tab: Los Santos itself (client/hub_map.lua puts a camera high
// over the city), with the pins drawn here at the screen positions Lua sends
// every frame. Drag to pan, wheel to zoom, click a pin for its card.
import { useEffect, useRef, useState } from 'preact/hooks'
import { post, inGame } from '../core/nui'

type Kind = 'track' | 'speedcam' | 'minigame' | 'garage' | 'player' | 'me'
interface Pin { id: string; kind: Kind; label: string; sub?: string; accent?: string; info?: [string, string][]; x?: number; y?: number; z?: number }

const FILTERS: [string, string, Kind[]][] = [
  ['all', 'All', ['track', 'speedcam', 'minigame', 'garage', 'player', 'me']],
  ['tracks', 'Tracks', ['track', 'me']],
  ['cams', 'Cameras', ['speedcam', 'me']],
  ['games', 'Minigames', ['minigame', 'me']],
  ['garages', 'Garages', ['garage', 'me']],
  ['players', 'Players', ['player', 'me']],
]
const KIND_LABEL: Record<Kind, string> = { track: 'Race track', speedcam: 'Speed camera', minigame: 'Minigame', garage: 'Garage', player: 'Driver', me: 'You' }

function Glyph({ kind }: { kind: Kind }) {
  const p = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'currentColor' }
  switch (kind) {
    case 'track': return <svg {...p}><path d="M5 3h2v18H5zM8 4h11l-2 4 2 4H8z" /></svg>
    case 'speedcam': return <svg {...p}><path d="M3 7h13l5-3v12l-5-3H3zM6 16h4v4H6z" /></svg>
    case 'minigame': return <svg {...p}><path d="M7 7h10a5 5 0 0 1 0 10l-2-2H9l-2 2A5 5 0 0 1 7 7zm1 3v2H6v1h2v2h1v-2h2v-1H9v-2zm8 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" /></svg>
    case 'garage': return <svg {...p}><path d="M12 3 2 10v11h20V10zm-6 9h12v2H6zm0 4h12v2H6z" /></svg>
    default: return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0z" /></svg>
  }
}

// Browser preview: no camera, no Lua; a believable spread of pins.
const SAMPLE: Pin[] = [
  { id: 't1', kind: 'track', label: 'Downtown Grand Prix', sub: 'Circuit', info: [['Type', 'Circuit'], ['Laps', '3'], ['Gates', '18']], x: 0.46, y: 0.42 },
  { id: 't2', kind: 'track', label: 'Vinewood Loop', sub: 'Circuit', info: [['Type', 'Circuit'], ['Laps', '3'], ['Gates', '22']], x: 0.38, y: 0.28 },
  { id: 't3', kind: 'track', label: 'Port Sprint', sub: 'Sprint', info: [['Type', 'Sprint'], ['Laps', '—'], ['Gates', '31']], x: 0.62, y: 0.71 },
  { id: 'c1', kind: 'speedcam', label: 'Vespucci Blvd', sub: 'Speed camera', info: [['Trigger', '104 km/h']], x: 0.30, y: 0.55 },
  { id: 'c2', kind: 'speedcam', label: 'Route 68', sub: 'Speed camera', info: [['Trigger', '112 km/h']], x: 0.72, y: 0.22 },
  { id: 'm1', kind: 'minigame', label: 'Color Rush', sub: 'Minigame', accent: '#a855f7', info: [['About', 'Rush to the called colour before the floor drops.']], x: 0.52, y: 0.50 },
  { id: 'g1', kind: 'garage', label: 'Legion Square', sub: 'Garage · spawn point', info: [['Use', 'Spawn here from the play menu']], x: 0.49, y: 0.47 },
  { id: 'p1', kind: 'player', label: 'DRIFT_KING', sub: 'Driver', x: 0.57, y: 0.36 },
  { id: 'me', kind: 'me', label: 'SPiceZ', sub: 'You', x: 0.45, y: 0.52 },
]

export function HubMap() {
  const [meta, setMeta] = useState<Record<string, Pin>>(() => inGame ? {} : Object.fromEntries(SAMPLE.map(p => [p.id, p])))
  const [pos, setPos] = useState<{ id: string; x: number; y: number }[]>(() => inGame ? [] : SAMPLE.map(p => ({ id: p.id, x: p.x!, y: p.y! })))
  const [height, setHeight] = useState(1700)
  const [filter, setFilter] = useState('all')
  const [sel, setSel] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean; rot: boolean } | null>(null)
  const pend = useRef({ dx: 0, dy: 0, rx: 0, ry: 0, raf: 0 })

  useEffect(() => {
    if (inGame) post('hubMap', { on: true })
    const onMsg = (e: MessageEvent) => {
      const m = e.data
      if (m?.type === 'hubMapPins') setMeta(o => ({ ...o, ...Object.fromEntries((m.pins || []).map((p: Pin) => [p.id, p])) }))
      else if (m?.type === 'hubMap') {
        if (m.live?.length) setMeta(o => ({ ...o, ...Object.fromEntries(m.live.map((p: Pin) => [p.id, p])) }))
        setPos(m.pins || [])
        if (typeof m.h === 'number') setHeight(m.h)
      }
    }
    window.addEventListener('message', onMsg)
    return () => { window.removeEventListener('message', onMsg); if (inGame) post('hubMap', { on: false }) }
  }, [])

  const kinds = FILTERS.find(f => f[0] === filter)![2]
  // The game draws the pins (client/hub_map.lua), so it needs the filter too.
  useEffect(() => { if (inGame) post('hubMapFilter', { kinds }) }, [filter])
  const shown = pos.filter(p => meta[p.id] && kinds.includes(meta[p.id].kind))
  const selected = sel ? meta[sel] : null
  const labelsOn = height < 1100

  // Pan: accumulate pointer movement and send it once per frame.
  const flush = () => {
    const p = pend.current
    p.raf = 0
    if (p.dx || p.dy) { if (inGame) post('hubMapPan', { dx: p.dx, dy: p.dy }); p.dx = 0; p.dy = 0 }
    if (p.rx || p.ry) { if (inGame) post('hubMapRotate', { dx: p.rx, dy: p.ry }); p.rx = 0; p.ry = 0 }
  }
  // Left drag pans, right drag turns / tilts the camera.
  const onDown = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, moved: false, rot: e.button === 2 } }
  const onMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true
    d.x = e.clientX; d.y = e.clientY
    if (d.rot) { pend.current.rx += dx; pend.current.ry += dy } else { pend.current.dx += dx; pend.current.dy += dy }
    if (!pend.current.raf) pend.current.raf = requestAnimationFrame(flush)
  }
  const onUp = () => { drag.current = null }
  const onWheel = (e: WheelEvent) => { e.preventDefault(); if (inGame) post('hubMapZoom', { d: Math.sign(e.deltaY) }) }
  const pick = (id: string) => { setSel(id); if (inGame) post('hubMapFocus', { id }) }
  const waypoint = () => { if (sel && inGame) post('hubMapWaypoint', { id: sel }) }

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Enter' && sel) waypoint() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [sel])

  return (
    <div class="hm" data-game={inGame} onContextMenu={e => e.preventDefault()} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onWheel={onWheel}>
      {shown.map(p => {
        const m = meta[p.id]
        return (
          <button
            key={p.id}
            class="hm-pin"
            data-kind={m.kind}
            data-sel={sel === p.id}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, ...(m.accent ? { '--pin': m.accent } : {}) } as any}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => pick(p.id)}
          >
            <span class="hm-ico"><Glyph kind={m.kind} /></span>
            {(labelsOn || sel === p.id || m.kind === 'me') && <span class="hm-label">{m.label}</span>}
          </button>
        )
      })}

      <div class="hm-filters" onPointerDown={e => e.stopPropagation()}>
        {FILTERS.map(([id, label]) => (
          <button key={id} data-on={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {selected && (
        <aside class="hm-card" onPointerDown={e => e.stopPropagation()}>
          <div class="hm-card-kind" data-kind={selected.kind}><Glyph kind={selected.kind} />{KIND_LABEL[selected.kind]}</div>
          <h2 class="hm-card-title">{selected.label}</h2>
          {selected.sub && <div class="hm-card-sub">{selected.sub}</div>}
          {selected.info && (
            <dl class="hm-card-info">
              {selected.info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          )}
          {selected.kind !== 'me' && <button class="hm-card-btn" onClick={waypoint}><kbd>ENTER</kbd> Set waypoint</button>}
          <button class="hm-card-close" onClick={() => setSel(null)} aria-label="Close">×</button>
        </aside>
      )}
    </div>
  )
}

export const MAP_KEYS: [string, string][] = [['DRAG', 'Pan'], ['R-DRAG', 'Angle'], ['WHEEL', 'Zoom'], ['CLICK', 'Select'], ['ENTER', 'Waypoint']]
