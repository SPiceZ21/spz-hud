-- server/pausemenu.lua — the pause menu's Quit.
-- Moved from spz-pausemenu/server/main.lua when it was merged into spz-hud.

-- server/main.lua

-- "Quit" drops the player who asked, and nobody else: the source is taken from
-- the event, never from the payload.
RegisterNetEvent('spz-pausemenu:disconnect', function()
    local src = source
    if src and src > 0 then
        DropPlayer(src, 'You left SPiceZ Racing. See you on track.')
    end
end)
