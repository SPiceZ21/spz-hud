# spz-hud

One NUI page for every always-on HUD widget. Players can move and resize the widgets, and widgets show only in the game states they belong to.

**Status:** groundwork. The existing HUD resources (spz-speedometer, spz-raceUI, …) are untouched and still draw their own UI. Widgets move over to this host one at a time.

## What it gives you

- **Layout editor:** `/hudedit`. Drag a widget to move it, scroll to resize it (50–200%), and use *hide* to switch one off. Then Save, Reset or Cancel (Esc cancels too). The layout is stored per player in client KVP.
- **Game states:** `freeroam`, `race`, `minigame` and `spectate`, worked out from the player's statebags. Each widget lists the states it shows in. The whole HUD hides behind the pause menu and fades.
- **Focus manager:** one owner for NUI focus, kept as a stack. A UI that closes hands focus back to whatever is underneath, and a resource that stops can't leave the cursor stuck.
- **Fast updates:** each widget re-renders only when its own data changes.

## Using it from another resource

```lua
-- declare a widget (or add it to Config.Widgets)
exports['spz-hud']:Register('lapTimer', {
    label = 'Lap timer', x = 50, y = 4, anchor = 'tc', scale = 1.0,
    states = { race = true },
})

exports['spz-hud']:Push('lapTimer', { ms = 61234 })   -- data for the widget
exports['spz-hud']:Push('lapTimer', false)            -- nothing to show
exports['spz-hud']:SetVisible('lapTimer', false)      -- force it off

-- focus
exports['spz-hud']:RequestFocus('leaderboard', { cursor = true, keyboard = true })
exports['spz-hud']:ReleaseFocus('leaderboard')
```

The widget also needs a component in `ui/src/widgets/index.ts`. Lua can register a widget before the UI ships its component; until then nothing is drawn for it.

### Exports

| Export | Purpose |
|---|---|
| `Register(id, def)` | Add a widget at runtime |
| `Push(id, data)` | Send data to one widget |
| `SetVisible(id, bool)` | Force a widget off or back on |
| `GetState()` | `freeroam` / `race` / `minigame` / `spectate` |
| `IsEditing()` | True while `/hudedit` is open |
| `RequestFocus(owner, opts)` / `ReleaseFocus(owner)` / `FocusOwner()` | Focus stack |

Event: `spz-hud:state` (client) fires with the new state.

## Test widget

`speedo` is off by default, so it doesn't double up with spz-speedometer. To try the host, add this to server.cfg:

```
setr spz_hud_speedo 1
```

or set `enabled = true` in `config.lua`.

## Build

```
cd ui
npm install
npm run build
```

`ui/dist/` is what the server loads. Upload that folder with the Lua files. Outside the game (`npm run dev`), the page runs on a fake speedometer so you can design in a browser.
