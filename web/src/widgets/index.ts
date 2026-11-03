// Widget id → component, for widgets drawn by spz-hud itself. A widget
// registered from Lua without a component here is skipped: the Lua side can
// declare it before the UI ships it.
import type { FunctionComponent } from 'preact'
import { SpeedoDigital, speedoDigitalSample } from './SpeedoDigital'

export interface WidgetComponent {
  view: FunctionComponent<{ id: string }>
  /** Data to show while placing it in edit mode if nothing live has arrived. */
  sample?: unknown
}

export const WIDGETS: Record<string, WidgetComponent> = {
  speedo_digital: { view: SpeedoDigital, sample: speedoDigitalSample },
}
