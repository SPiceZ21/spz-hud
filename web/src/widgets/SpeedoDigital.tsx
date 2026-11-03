// Digital speedometer: the analogue gauge's data (spz-speedometer's `update`
// messages, relayed here by App), as a slim racing readout with no panel.
//
//    (2)  051  KM/H         gear ring · speed (leading zeros dim) · unit
//              TCS          assists, lit only while active
//              LCH
//              LIM
//    |||||||||||||||░░░░░▇▇   rev ticks; the red block at the end is the redline
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

const TICKS = 44
const RED_FROM = 38      // the last 6 ticks are the redline block

export function SpeedoDigital({ id }: { id: string }) {
  const d = useWidgetData<SpeedoData | false>(id)
  if (!d) return null
  const speed = String(Math.max(0, Math.min(999, Math.round(d.speed || 0))))
  const lead = '000'.slice(speed.length)          // the dimmed zeros in front
  const lit = Math.round((Math.max(0, Math.min(100, d.pct || 0)) / 100) * TICKS)
  const gear = d.gear === 0 ? 'R' : String(d.gear)
  return (
    <div class="dsp" data-red={d.inRedline === true}>
      <div class="dsp-top">
        <div class="dsp-gear" data-r={gear === 'R'}>{gear}</div>
        <div class="dsp-speed"><span class="dsp-lead">{lead}</span>{speed}</div>
        <div class="dsp-side">
          <span class="dsp-unit">km/h</span>
          <span data-on={d.tcsCut === true}>TCS</span>
          <span data-on={d.launch === true}>LCH</span>
          <span data-on={d.limiter === true}>LIM</span>
        </div>
      </div>
      <div class="dsp-revs">
        {Array.from({ length: TICKS }, (_, i) => (
          <i key={i} data-on={i < lit} data-red={i >= RED_FROM} />
        ))}
      </div>
    </div>
  )
}

/** Shown while placing it in /hudedit with nothing live (on foot). */
export const speedoDigitalSample: SpeedoData = { speed: 51, gear: 2, pct: 62, inRedline: false }
