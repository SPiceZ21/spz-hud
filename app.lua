-- app.lua — for a resource that drives one or more spz-hud pages from its own
-- files (a resource that absorbed others: spz-races drives spz-raceUI, spz-poll
-- and spz-leaderboard). Unlike shim.lua it replaces nothing globally; each file
-- binds its own page with locals, so the rest of the resource is untouched:
--
--   client_script '@spz-hud/app.lua'        -- before the files that use it
--
--   -- top of a file that drives the "spz-poll" page:
--   local SendNUIMessage, SetNuiFocus, SetNuiFocusKeepInput = SpzHudApp('spz-poll')
--
-- The page's NUI callbacks post to its owner (apps.json `owner`), so
-- RegisterNUICallback in these files answers them.

local function hud()
    return GetResourceState('spz-hud') == 'started' and exports['spz-hud'] or nil
end

function SpzHudApp(app)
    local keep = false
    local function send(msg)
        local h = hud()
        if h then h:AppMessage(app, msg) end
    end
    local function focus(keyboard, cursor)
        local h = hud()
        if h then h:AppFocus(app, keyboard == true, cursor == true, keep) end
    end
    local function keepInput(on)
        keep = on == true
        local h = hud()
        if h then h:AppKeepInput(app, keep) end
    end
    return send, focus, keepInput
end
