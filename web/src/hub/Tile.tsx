// One plate in a hub tab's grid: a small label, a big value, a title, a line
// of detail and an optional footer. Styles: hx-tile* in hub.css.
import type { ComponentChildren } from 'preact'

export function Tile({ k, v, t, s, foot, sign, accent, me, children }: {
  k?: string; v?: ComponentChildren; t?: ComponentChildren; s?: ComponentChildren
  foot?: [string, ComponentChildren][]; sign?: 'up' | 'down' | ''; accent?: boolean; me?: boolean
  children?: ComponentChildren
}) {
  return (
    <div class="hx-tile" data-me={!!me}>
      {k && <div class="hx-tile-k">{k}</div>}
      {v != null && <div class="hx-tile-v" data-sign={sign || ''} data-accent={!!accent}>{v}</div>}
      {t != null && <div class="hx-tile-t">{t}</div>}
      {s != null && <div class="hx-tile-s">{s}</div>}
      {children}
      {foot && foot.length > 0 && (
        <div class="hx-tile-foot">{foot.map(([l, val]) => <div key={l}><span>{l}</span> {val}</div>)}</div>
      )}
    </div>
  )
}
