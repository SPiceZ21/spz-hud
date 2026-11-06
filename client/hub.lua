-- client/hub.lua — the SPiceZ hub: one full-screen place for everything about
-- you and the server (profile, standings, rivals, replays, speed records,
-- crew, achievements). TAB opens and closes it.
--
-- The sections are the existing screens (spz-leaderboard, spz-crew,
-- spz-speedcam), opened through their own commands so their Lua loads the data
-- as it always did, and drawn inside the hub's frame (the page puts them in
-- "hub mode"). Achievements are the hub's own, worked out from your stats.

local hubOpen = false
local OWNER = 'spz-hud-hub'

local function profileSummary()
    local st = LocalPlayer.state
    local p = type(st.profile) == 'table' and st.profile or {}
    return {
        name    = p.username or GetPlayerName(PlayerId()),
        avatar  = st['spz:avatar'] or st.avatarUrl or p.avatar_url,
        rank    = st.rank or p.rank,
        level   = tonumber(p.level),
        credits = tonumber(p.credits),
        crew    = st.crewTag or p.crew_tag,
        rating  = tonumber(st.iRating or p.i_rating),
    }
end

local function setHub(on)
    if on == hubOpen then return end
    hubOpen = on
    if on then
        Focus.Request(OWNER, { cursor = true, keyboard = true })
        HudSend({ type = 'hub', on = true, profile = profileSummary() })
    else
        -- The page closes whatever section app is open (through that app's own
        -- close callback, which releases its focus), then the hub lets go.
        if HubMapStop then HubMapStop() end   -- client/hub_map.lua
        HudSend({ type = 'hub', on = false })
        Focus.Release(OWNER)
    end
end

local function canOpen()
    local st = LocalPlayer.state
    return not IsPauseMenuActive() and not st.spawnMenuOpen
end

RegisterCommand('spzhub', function()
    if hubOpen then setHub(false) elseif canOpen() then setHub(true) end
end, false)
RegisterKeyMapping('spzhub', 'Open the SPiceZ hub (profile, standings, crew…)', 'keyboard', 'TAB')

-- The page asks for a section's screen: run that resource's own command.
local COMMANDS = { leaderboard = true, crew = true, speedrecords = true }
RegisterNUICallback('hubCommand', function(data, cb)
    local cmd = data and data.cmd
    if hubOpen and COMMANDS[cmd] then ExecuteCommand(cmd) end
    cb(true)
end)

RegisterNUICallback('hubClose', function(_, cb)
    setHub(false)
    cb(true)
end)

exports('IsHubOpen', function() return hubOpen end)
