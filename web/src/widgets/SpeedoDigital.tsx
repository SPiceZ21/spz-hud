// Digital speedometer: the analogue gauge's data (spz-speedometer's `update`
// messages, relayed here by App), as a slim racing readout with no panel.
//
//    (2)  051  KM/H         gear ring · speed (leading zeros dim) · unit
//    [=========>      ▒▒]   rev bar like the race HUD's checkpoint bar: a glowing
//                            gradient fill; the tinted end is the redline
//    REWIND 3.2s  BOOST 64  one row in two pieces, each only while it applies:
//    [=====   ]   [====   ]  rewind (seconds left) and boost (0-100)
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
  rewindMax?: number     // ms of rewind this race allows (0 = no rewind)
  rewindLeft?: number    // ms still available
  sideBoost?: number     // 0-100, or -1 when there is no boost
}

const RED_FROM = 86      // % of the bar where the redline zone starts

export function SpeedoDigital({ id }: { id: string }) {
  const d = useWidgetData<SpeedoData | false>(id)
  if (!d) return null
  const speed = String(Math.max(0, Math.min(999, Math.round(d.speed || 0))))
  const lead = '000'.slice(speed.length)          // the dimmed zeros in front
  const pct = Math.max(0, Math.min(100, d.pct || 0))
  const gear = d.gear === 0 ? 'R' : String(d.gear)
  const rwMax = d.rewindMax || 0
  const rwLeft = Math.max(0, d.rewindLeft || 0)
  const rwPct = rwMax > 0 ? Math.min(100, (rwLeft / rwMax) * 100) : 0
  const boost = typeof d.sideBoost === 'number' && d.sideBoost >= 0 ? Math.min(100, d.sideBoost) : null
  return (
    <div class="dsp" data-red={d.inRedline === true}>
      <div class="dsp-top">
        <div class="dsp-gear" data-r={gear === 'R'}>{gear}</div>
        <div class="dsp-speed"><span class="dsp-lead">{lead}</span>{speed}</div>
        <div class="dsp-side">
          <span class="dsp-unit">km/h</span>
        </div>
      </div>
      <div class="dsp-bar" style={{ '--red-from': `${RED_FROM}%` } as any}>
        <i class="dsp-bar-zone" />
        <i class="dsp-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {(rwMax > 0 || boost !== null) && (
        <div class="dsp-mini">
          {rwMax > 0 && (
            <div class="dsp-mini-row" data-kind="rewind" data-low={rwPct <= 25} data-out={rwLeft <= 0}>
              <span class="dsp-mini-l">Rewind</span>
              <span class="dsp-mini-v">{rwLeft <= 0 ? 'Spent' : `${(rwLeft / 1000).toFixed(1)}s`}</span>
              <span class="dsp-mini-bar"><i style={{ width: `${rwPct}%` }} /></span>
            </div>
          )}
          {boost !== null && (
            <div class="dsp-mini-row" data-kind="boost">
              <span class="dsp-mini-l">Boost</span>
              <span class="dsp-mini-v">{Math.round(boost)}</span>
              <span class="dsp-mini-bar"><i style={{ width: `${boost}%` }} /></span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Shown while placing it in /hudedit with nothing live (on foot). */
export const speedoDigitalSample: SpeedoData = {
  speed: 51, gear: 2, pct: 62, inRedline: false, rewindMax: 5000, rewindLeft: 3200, sideBoost: 64,
}
