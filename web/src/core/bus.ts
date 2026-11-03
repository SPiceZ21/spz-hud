// Per-widget data channels. A Push for one widget re-renders only that widget:
// the speedometer updates 20 times a second and must not redraw the whole HUD.
import { useEffect, useState } from 'preact/hooks'

type Fn = (v: unknown) => void
const values = new Map<string, unknown>()
const subs = new Map<string, Set<Fn>>()

export function publish(id: string, v: unknown) {
  values.set(id, v)
  subs.get(id)?.forEach(fn => fn(v))
}

export function useWidgetData<T>(id: string): T | undefined {
  const [v, setV] = useState(values.get(id) as T | undefined)
  useEffect(() => {
    let set = subs.get(id)
    if (!set) subs.set(id, (set = new Set()))
    const fn: Fn = x => setV(x as T)
    set.add(fn)
    return () => { set!.delete(fn) }
  }, [id])
  return v
}

export const peek = (id: string) => values.get(id)
