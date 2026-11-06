-- config_nametag.lua — nametags.
-- Moved from spz-nametag/config.lua when it was merged into spz-hud. Read as Config.Nametag.<option>.

Config.Nametag = {}
local Config = Config.Nametag
Config.RenderDistance = 150.0  -- Max distance to see nametags
Config.FadeDistance = 100.0    -- Distance where nametags start to fade out
Config.ScaleMin = 0.5          -- Minimum scale at max distance
Config.ScaleMax = 1.0          -- Maximum scale when close

Config.UpdateInterval = 0      -- Tick wait (0 = every frame for movement smoothness)
Config.DataRefreshInterval = 2000 -- How often to refresh player data from state bags (ms)

Config.DefaultAvatar = 'https://raw.githubusercontent.com/SPiceZ21/spz-core-media-kit/main/Extra/nametag_profile.png' -- Generic racing helmet/avatar
Config.DefaultBanner = 'https://raw.githubusercontent.com/SPiceZ21/spz-core-media-kit/main/Extra/nametag.png'

-- Registry: Docs/keybinds.md
Config.Keybind = {
    enabled = true,
    key = 'F10',
    command = 'togglenametags',
    description = 'Toggle Player Nametags'
}

-- Revamp Telemetry and Performance Configs
Config.ShowVehicleName = true   -- Show driving vehicle under name
Config.ShowDistance = true      -- Show distance to player in meters
Config.RaycastThrottle = 200    -- Throttle raycast checks (ms) to optimize performance

