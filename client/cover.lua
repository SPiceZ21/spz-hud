-- client/cover.lua — the SPiceZ transition cover (web/src/core/Cover.tsx).
--
-- One full-screen wipe for every hand-off, in the spawn screen's look. Each
-- caller names itself, and the cover stays closed while anyone still holds it:
--
--   exports['spz-hud']:CoverShow('race-join', 'Joining the grid')   -- close (returns at once)
--   exports['spz-hud']:CoverShowWait('fade', 'Loading')             -- close, return once closed
--   exports['spz-hud']:CoverHide('race-join')                       -- release; opens when nobody holds it
--   exports['spz-hud']:IsCovered()
--
-- spz-core's FadeOut / FadeIn use it, so every teleport gets it.

local CLOSE_MS = 520 + 7 * 40 + 80     -- Cover.tsx COVER_CLOSE_MS, plus a frame or two
local MAX_HOLD = 30000                 -- never keep anyone behind it longer than this

local holders = {}                     -- [src] = GetGameTimer() when taken

local function show(src, status)
    src = tostring(src or 'lua')
    holders[src] = GetGameTimer()
    HudSend({ type = 'cover', on = true, src = src, status = status })
end

local function hide(src)
    src = tostring(src or 'lua')
    holders[src] = nil
    HudSend({ type = 'cover', on = false, src = src })
end

exports('CoverShow', function(src, status) show(src, status) end)
exports('CoverShowWait', function(src, status)
    local was = next(holders) ~= nil
    show(src, status)
    if not was then Wait(CLOSE_MS) end   -- already closed for someone else: nothing to wait for
end)
exports('CoverHide', function(src) hide(src) end)
exports('IsCovered', function() return next(holders) ~= nil end)

-- Safety net: a holder that errored out or never released.
CreateThread(function()
    while true do
        Wait(1000)
        local now = GetGameTimer()
        for src, at in pairs(holders) do
            if now - at > MAX_HOLD then
                print(('^3[spz-hud] cover held by %s for %ds: releasing^7'):format(src, MAX_HOLD // 1000))
                hide(src)
            end
        end
    end
end)

-- A resource that restarts while holding the cover can never release it.
AddEventHandler('onClientResourceStop', function(res)
    for src in pairs(holders) do
        if src:find(res, 1, true) == 1 then hide(src) end
    end
end)
