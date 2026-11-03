-- shim.lua — loaded INTO another resource (client_script '@spz-hud/shim.lua',
-- first in its list). Its UI now lives in spz-hud (apps/<name>/), so the NUI
-- natives it calls are pointed there. The resource's own code is unchanged:
--
--   SendNUIMessage(msg)          → spz-hud draws it in that app's layer
--   SetNuiFocus(kb, cursor)      → spz-hud's focus stack, keyed by this resource
--   SetNuiFocusKeepInput(on)     → same entry
--
-- NUI callbacks need nothing: the page still posts to https://<this resource>/,
-- so RegisterNUICallback here keeps answering.

local APP = GetCurrentResourceName()

local function hud()
    return GetResourceState('spz-hud') == 'started' and exports['spz-hud'] or nil
end

local keepInput = false

SendNUIMessage = function(msg)
    local h = hud()
    if h then h:AppMessage(APP, msg) end
end

SendNuiMessage = function(raw)
    local ok, msg = pcall(json.decode, raw)
    if ok and msg then SendNUIMessage(msg) end
end

SetNuiFocus = function(keyboard, cursor)
    local h = hud()
    if h then h:AppFocus(APP, keyboard == true, cursor == true, keepInput) end
end

SetNuiFocusKeepInput = function(on)
    keepInput = on == true
    local h = hud()
    if h then h:AppKeepInput(APP, keepInput) end
end
