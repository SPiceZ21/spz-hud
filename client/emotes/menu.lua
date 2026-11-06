-- client/emotes/menu.lua — emotes (menu).
-- Moved from spz-emotes/client/menu.lua when it was merged into spz-hud.
-- Its page is still the "spz-emotes" app; these locals send to that page only.
local SendNUIMessage, SetNuiFocus, SetNuiFocusKeepInput, RegisterNUICallback = SpzHudApp('spz-emotes')
local Config = Config.Emotes

-- client/menu.lua — the emote menu (ui/). Opens on Config.MenuKey or /emotes.

local open = false
local KVP_FAV = "spz_emotes:fav"

local function loadFavs()
    local raw = GetResourceKvpString(KVP_FAV)
    local ok, t = pcall(json.decode, raw or "[]")
    return (ok and type(t) == "table") and t or {}
end

local function list()
    local out = {}
    for key, e in pairs(Emotes) do
        out[#out + 1] = { key = key, label = e.label, cat = e.cat, shared = e.shared ~= nil, upper = e.upper == true }
    end
    table.sort(out, function(a, b) return a.label < b.label end)
    return out
end

local function close()
    if not open then return end
    open = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = "close" })
end

local function openMenu()
    if open then return close() end
    local why = Emote.blocked()
    if why then return Emote.notify(why, "error") end
    open = true
    local ok, theme = pcall(function() return exports["spz-core"]:GetTheme() end)
    SendNUIMessage({
        action = "open",
        categories = Categories, emotes = list(), favs = loadFavs(),
        theme = ok and theme or nil,
        playing = Emote.current and Emote.current.label or nil,
        -- Which preview set to show (ui/previews/<sex>/); same idea as
        -- fivem-appearance's per-sex thumbnails.
        sex = GetEntityModel(PlayerPedId()) == `mp_f_freemode_01` and "female" or "male",
        cancelKey = Config.CancelKey,
    })
    SetNuiFocus(true, true)
end

RegisterCommand(Config.Command, openMenu, false)
RegisterCommand("+emote_menu", openMenu, false)
RegisterCommand("-emote_menu", function() end, false)
RegisterKeyMapping("+emote_menu", "Emotes: open menu", "keyboard", Config.MenuKey)

AddEventHandler("SPZ:themeUpdated", function(theme)
    if open then SendNUIMessage({ action = "theme", theme = theme }) end
end)

RegisterNUICallback("play", function(d, cb)
    cb(1)
    if d and d.key then
        local e = Emotes[d.key]
        -- Shared emotes ask the other player through a dialog; get out of its way.
        if e and e.shared then close() end
        Emote.play(d.key)
        if open then SendNUIMessage({ action = "playing", label = Emote.current and Emote.current.label or nil }) end
    end
end)

RegisterNUICallback("stop", function(_, cb)
    cb(1)
    Emote.stop()
    SendNUIMessage({ action = "playing", label = nil })
end)

RegisterNUICallback("favs", function(d, cb)
    cb(1)
    if type(d) == "table" and type(d.favs) == "table" then SetResourceKvp(KVP_FAV, json.encode(d.favs)) end
end)

RegisterNUICallback("close", function(_, cb) cb(1) close() end)

-- Racing / a minigame starts while the menu is open.
CreateThread(function()
    while true do
        Wait(500)
        if open and Emote.blocked() then close() end
    end
end)

exports("OpenEmoteMenu", openMenu)
exports("PlayEmote", function(key) return Emote.play(key) end)
exports("StopEmote", function() Emote.stop() end)

AddEventHandler("onResourceStop", function(res)
    if res == GetCurrentResourceName() and open then SetNuiFocus(false, false) end
end)
