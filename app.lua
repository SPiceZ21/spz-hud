-- app.lua — for a resource that drives one or more spz-hud pages from its own
-- files (a resource that absorbed others: spz-races drives spz-raceUI, spz-poll
-- and spz-leaderboard; spz-core drives spz-spawn). Unlike shim.lua it replaces
-- nothing globally; each file binds its own page with locals, so the rest of
-- the resource is untouched:
--
--   client_script '@spz-hud/app.lua'        -- before the files that use it
--
--   -- top of a file that drives the "spz-poll" page:
--   local SendNUIMessage, SetNuiFocus, SetNuiFocusKeepInput = SpzHudApp('spz-poll')
--
-- The page's NUI callbacks post to its owner (apps.json `owner`), so
-- RegisterNUICallback in these files answers them.
--
-- spz-hud may not be running yet: spz-core starts before it (spz-hud depends
-- on spz-core, so spz-core cannot depend back). Until it starts, messages are
-- queued and the latest focus request is kept; both go out when it does.

local function hud()
    return GetResourceState('spz-hud') == 'started' and exports['spz-hud'] or nil
end

local MAX_QUEUE = 200
local pending   = {}   -- [app] = { msgs = {...}, focus = {kb, cursor, keep} | nil }

local function flush()
    local h = hud()
    if not h then return end
    for app, p in pairs(pending) do
        for _, msg in ipairs(p.msgs) do h:AppMessage(app, msg) end
        if p.focus then h:AppFocus(app, p.focus[1], p.focus[2], p.focus[3]) end
    end
    pending = {}
end

AddEventHandler('onClientResourceStart', function(res)
    if res == 'spz-hud' then flush() end
end)

function SpzHudApp(app)
    local keep = false
    local function queue()
        pending[app] = pending[app] or { msgs = {} }
        return pending[app]
    end
    local function send(msg)
        if msg == nil then return end
        local h = hud()
        if h then h:AppMessage(app, msg) return end
        local q = queue()
        if #q.msgs < MAX_QUEUE then q.msgs[#q.msgs + 1] = msg end
    end
    local function focus(keyboard, cursor)
        local h = hud()
        if h then h:AppFocus(app, keyboard == true, cursor == true, keep) return end
        queue().focus = { keyboard == true, cursor == true, keep }
    end
    local function keepInput(on)
        keep = on == true
        local h = hud()
        if h then h:AppKeepInput(app, keep) end
    end
    return send, focus, keepInput
end
