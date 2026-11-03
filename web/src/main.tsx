import { render } from 'preact'
import { App } from './App'
import { inGame } from './core/nui'
import { patchFrame } from './dev/devlog'
import './styles.css'

// Browser preview: each hosted app's index.html calls this before its own
// scripts run, so its NUI callbacks are caught from the first one.
if (!inGame) (window as any).__spzDev = patchFrame

render(<App />, document.getElementById('root')!)
