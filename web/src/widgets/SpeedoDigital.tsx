// Digital speedometer: the analogue gauge's data (spz-speedometer's `update`
// messages, relayed here by App), as a street-racing readout with no panel.
//
//                        ▁▂▃▄▅▆▇█    revs: slanted steps that rise toward
//                                   the redline (last 4 = red)
//        184 ╱ 4                     speed · gear
//        KM/H  GEAR
//        LIMITER                     only while one is active
//
// No background: it sits on the game like the race timer, kept legible by a
// tight shadow on the type.
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

const STEPS = 20
const RED_FROM = 16      // the last 4 steps are the redline

export function SpeedoDigital({ id }: { id: string }) {
  const d = useWidgetData<SpeedoData | false>(id)
  if (!d) return null
  const lit = Math.round((Math.max(0, Math.min(100, d.pct || 0)) / 100) * STEPS)
  const flags = [d.limiter && 'Limiter', d.launch && 'Launch', d.tcsCut && 'TCS'].filter(Boolean) as string[]
  return (
    <div class="nfs" data-red={d.inRedline === true}>
      <div class="nfs-revs">
        {Array.from({ length: STEPS }, (_, i) => (
          <i key={i} data-on={i < lit} data-red={i >= RED_FROM}
             style={{ height: `${6 + (i / (STEPS - 1)) * 16}px` }} />
        ))}
      </div>
      <div class="nfs-main">
        <div class="nfs-speedcol">
          <span class="nfs-speed">{Math.max(0, Math.round(d.speed || 0))}</span>
          <span class="nfs-label">km/h</span>
        </div>
        <i class="nfs-slash" />
        <div class="nfs-gearcol">
          <span class="nfs-gear">{d.gear === 0 ? 'R' : d.gear}</span>
          <span class="nfs-label">Gear</span>
        </div>
      </div>
      {flags.length > 0 && <div class="nfs-flags">{flags.map(f => <span key={f}>{f}</span>)}</div>}
    </div>
  )
}

/** Shown while placing it in /hudedit with nothing live (on foot). */
export const speedoDigitalSample: SpeedoData = { speed: 184, gear: 4, pct: 72, inRedline: false }
