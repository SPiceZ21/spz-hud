-- config_emotes.lua — emote menu.
-- Moved from spz-emotes/config.lua when it was merged into spz-hud. Read as Config.Emotes.<option>.

-- config.lua — spz-emotes
Config.Emotes = {}
local Config = Config.Emotes
Config.MenuKey    = "O"      -- opens the menu (rebindable: Settings > Key Bindings > FiveM)
Config.CancelKey  = "X"      -- stops the current emote
Config.Command    = "emotes" -- /emotes opens the menu; /e <name> plays one directly

-- Shared emotes (handshake, hug, ...): how close the other player must be,
-- and how long they have to accept.
Config.SharedRange   = 3.0
Config.SharedTimeout = 12     -- seconds
