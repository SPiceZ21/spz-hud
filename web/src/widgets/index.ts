// Widget id → component, for widgets drawn by spz-hud itself. A widget
// registered from Lua without a component here is skipped: the Lua side can
// declare it before the UI ships it.
//
// None yet: the speedometer is spz-speedometer's own page (an app), placed
// through the app layer instead (see core/apps.tsx, "movable").
import type { FunctionComponent } from 'preact'

export interface WidgetComponent {
  view: FunctionComponent<{ id: string }>
  /** Data to show while placing it in edit mode if nothing live has arrived. */
  sample?: unknown
}

export const WIDGETS: Record<string, WidgetComponent> = {}
