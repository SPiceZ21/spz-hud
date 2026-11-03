export type Anchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br'
export type GameState = 'freeroam' | 'race' | 'minigame' | 'spectate'

/** A widget as the Lua side registers it (defaults). */
export interface WidgetDef {
  id: string
  label: string
  x: number           // % of screen width
  y: number           // % of screen height
  anchor: Anchor
  scale: number
  states: Partial<Record<GameState, boolean>>
}

/** What the player changed: stored per widget in client KVP. */
export interface Placement {
  x: number
  y: number
  scale: number
  hidden?: boolean
}

export type Layout = Record<string, Placement>

/** Which point of the widget sits on (x, y), as a CSS translate. */
export const ANCHOR_SHIFT: Record<Anchor, [number, number]> = {
  tl: [0, 0], tc: [-50, 0], tr: [-100, 0],
  ml: [0, -50], mc: [-50, -50], mr: [-100, -50],
  bl: [0, -100], bc: [-50, -100], br: [-100, -100],
}
