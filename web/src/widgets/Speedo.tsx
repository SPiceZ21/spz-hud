import { useWidgetData } from '../core/bus'

interface SpeedoData { kmh: number; gear: number | string; rpm: number }

export function Speedo({ id }: { id: string }) {
  const d = useWidgetData<SpeedoData | false>(id)
  if (!d) return null
  return (
    <div class="speedo">
      <div class="speedo-num">{d.kmh}</div>
      <div class="speedo-meta">
        <span class="speedo-unit">KM/H</span>
        <span class="speedo-gear">{d.gear}</span>
      </div>
      <div class="speedo-rpm">
        <div class="speedo-rpm-fill" data-red={d.rpm >= 90} style={{ width: `${d.rpm}%` }} />
      </div>
    </div>
  )
}

/** Shown in edit mode when the widget has no live data (e.g. on foot). */
export const speedoSample: SpeedoData = { kmh: 184, gear: 4, rpm: 72 }
