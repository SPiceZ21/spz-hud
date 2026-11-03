// Digital speedometer: the analogue gauge's data (spz-speedometer's `update`
// messages, relayed here by App) on one panel in the shared look.
//
//   ┌──────────────────────┐
//   │ 184           4      │   speed · gear
//   │ KM/H          GEAR   │
//   │ ▮▮▮▮▮▮▮▮▮▮▯▯▯▯▯▯     │   revs: 16 segments, the last 3 are the redline
//   │ LIMITER  LAUNCH      │   only when one is active
//   └──────────────────────┘
import { useWidgetData } from '../core/bus'

export interface SpeedoData {
  speed: number
  gear: number | string
  pct: number            // revs, 0-100
  inRedline?: boolean
  limiter?: boolean
  launch?: boolean
  tcsCut?: boolean
}

const SEGMENTS = 16
const RED_FROM = 13      // segments 14-16 are the redline

export function SpeedoDigital({ id }: { id: string }) {
  const d = useWidgetData<SpeedoData | false>(id)
  if (!d) return null
  const lit = Math.round((Math.max(0, Math.min(100, d.pct || 0)) / 100) * SEGMENTS)
  const flags = [d.limiter && 'Limiter', d.launch && 'Launch', d.tcsCut && 'TCS'].filter(Boolean) as string[]
  return (
    <div class="dspd" data-red={d.inRedline === true}>
      <div class="dspd-main">
        <div class="dspd-cell">
          <span class="dspd-speed">{Math.max(0, Math.round(d.speed || 0))}</span>
          <span class="dspd-label">km/h</span>
        </div>
        <div class="dspd-cell dspd-gearcell">
          <span class="dspd-gear">{d.gear === 0 ? 'R' : d.gear}</span>
          <span class="dspd-label">Gear</span>
        </div>
      </div>
      <div class="dspd-revs">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <i key={i} data-on={i < lit} data-red={i >= RED_FROM} />
        ))}
      </div>
      {flags.length > 0 && (
        <div class="dspd-flags">{flags.map(f => <span key={f}>{f}</span>)}</div>
      )}
    </div>
  )
}

/** Shown while placing it in /hudedit with nothing live (on foot). */
export const speedoDigitalSample: SpeedoData = { speed: 184, gear: 4, pct: 72, inRedline: false }
