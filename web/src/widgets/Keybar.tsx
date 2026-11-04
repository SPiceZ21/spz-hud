// Key-hint strip: what the player can press right now (client/keybar.lua
// picks the keys per state and reads the live bindings).
//
//   [ F5 GARAGE │ F6 RESULTS │ F EXIT ]   one panel, hairline cells
import { useWidgetData } from '../core/bus'

export interface KeyHint { key: string; label: string }

export function Keybar({ id }: { id: string }) {
  const list = useWidgetData<KeyHint[] | false>(id)
  if (!list || !list.length) return null
  return (
    <div class="kbar">
      {list.map(h => (
        <span class="kbar-item" key={h.label}>
          <kbd class="kbar-key" data-wide={h.key.length > 2}>{h.key}</kbd>
          <span class="kbar-label">{h.label}</span>
        </span>
      ))}
    </div>
  )
}

export const keybarSample: KeyHint[] = [
  { key: 'F5', label: 'Garage' }, { key: 'O', label: 'Emotes' },
  { key: 'F6', label: 'Results' }, { key: 'F', label: 'Exit' },
]
