-- client/apps.lua — the other resources' UIs, hosted here.
--
-- Each one is copied into apps/<resource>/ (tools/sync-apps.mjs) and drawn in
-- its own layer of this page. The resource keeps its Lua and its NUI
-- callbacks; shim.lua routes its SendNUIMessage / SetNuiFocus to the exports
-- below.

exports('AppMessage', function(app, msg)
    if type(app) ~= 'string' or msg == nil then return end
    HudSend({ type = 'app', app = app, msg = msg })
end)

exports('AppFocus', function(app, keyboard, cursor, keepInput)
    if keyboard or cursor then
        Focus.Request(app, { keyboard = keyboard, cursor = cursor, keepInput = keepInput }, app)
    else
        Focus.Release(app)
    end
end)

exports('AppKeepInput', function(app, on) Focus.SetKeepInput(app, on) end)

-- A restarted resource expects a freshly loaded page, as it had with its own
-- ui_page. Reload its layer so no state from the old run lingers.
AddEventHandler('onClientResourceStart', function(res)
    if res ~= GetCurrentResourceName() then HudSend({ type = 'appReload', app = res }) end
end)
