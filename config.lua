Config = {}

-- Layout edit mode: /hudedit (drag widgets, Save / Reset / Cancel).
Config.EditCommand = 'hudedit'

-- Saved layouts carry this version. Bump it when default positions change
-- enough that old saves should be dropped instead of reused.
Config.LayoutVersion = 1

-- Snap step while dragging, in percent of the screen.
Config.Snap = 0.5

-- Widgets the HUD knows. Other resources may register more at runtime with
-- exports['spz-hud']:Register(id, def).
--
--   x, y     default position, percent of the screen (0-100) of the anchor
--   anchor   which corner/edge of the widget sits on (x, y):
--            'tl' 'tc' 'tr' 'ml' 'mc' 'mr' 'bl' 'bc' 'br'
--   scale    default size multiplier (players can change it in edit mode)
--   states   game states it shows in: freeroam, race, minigame, spectate
--   enabled  false = not drawn at all (and not offered in edit mode)
Config.Widgets = {}
