// NUI plumbing. Outside the game (vite dev) there is no resource to post to:
// calls are logged for the dev panel and the few the page relies on are
// answered the way the Lua side would.
import { log } from '../dev/devlog'

declare function GetParentResourceName(): string

export const inGame = typeof (window as any).GetParentResourceName === 'function'

/** POST to a NUI callback: this resource's by default, or another resource's
 *  (any page can call any resource's callbacks by its name). */
export async function post<T = unknown>(name: string, data: unknown = {}, res?: string): Promise<T | null> {
  if (!inGame) {
    log('in', res || 'spz-hud', name, data)
    // client/main.lua closes edit mode after these.
    if (name === 'saveLayout' || name === 'cancelEdit') window.postMessage({ type: 'edit', on: false }, '*')
    return null
  }
  try {
    const r = await fetch(`https://${res || GetParentResourceName()}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data),
    })
    return (await r.json()) as T
  } catch {
    return null
  }
}
