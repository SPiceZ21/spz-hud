// Widget id → component. A widget registered from Lua without a component here
// is skipped: the Lua side can declare it before the UI ships it.
import type { FunctionComponent } from 'preact'
import { Speedo, speedoSample } from './Speedo'

export interface WidgetComponent {
  view: FunctionComponent<{ id: string }>
  /** Data to show while placing it in edit mode if nothing live has arrived. */
  sample?: unknown
}

export const WIDGETS: Record<string, WidgetComponent> = {
  speedo: { view: Speedo, sample: speedoSample },
}
