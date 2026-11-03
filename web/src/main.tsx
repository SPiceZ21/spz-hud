import { render } from 'preact'
import { App } from './App'
import { inGame } from './core/nui'
import { patchFrame } from './dev/devlog'
import './styles.css'

// Browser preview: each hosted app's index.html calls this before its own
// scripts run, so its NUI callbacks are caught from the first one.
if (!inGame) {
  (window as any).__spzDev = patchFrame
  // Apps borrow invokeNative from this page to know they are "in game"
  // (see sync-apps.mjs). A no-op here keeps them on their game code path,
  // driven by the dev panel, instead of their own browser mock mode.
  if (!(window as any).invokeNative) (window as any).invokeNative = () => {}
}

render(<App />, document.getElementById('root')!)
