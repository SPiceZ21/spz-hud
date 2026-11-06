-- client/emotes/migrate.lua — carry players' saved emote settings over from
-- spz-emotes. Client KVP belongs to the resource that wrote it, so after the
-- merge into spz-hud the favourites, walk style and mood saved by spz-emotes
-- would look empty. They are still on the player's disk under spz-emotes;
-- GetExternalKvpString reads them (the old resource does not have to exist).
--
-- Runs once per player (spz_emotes:migrated), before client/emotes/play.lua
-- restores the walk style and mood. Never overwrites a value spz-hud already has.

local OLD  = 'spz-emotes'
local KEYS = { 'spz_emotes:fav', 'spz_emotes:walk', 'spz_emotes:mood' }
local DONE = 'spz_emotes:migrated'

if GetResourceKvpInt(DONE) ~= 1 and GetExternalKvpString then
    local copied = 0
    for _, key in ipairs(KEYS) do
        local mine = GetResourceKvpString(key)
        if mine == nil or mine == '' then
            local ok, old = pcall(GetExternalKvpString, OLD, key)
            if ok and type(old) == 'string' and old ~= '' then
                SetResourceKvp(key, old)
                copied = copied + 1
            end
        end
    end
    SetResourceKvpInt(DONE, 1)
    if copied > 0 then print(('^2[spz-hud] emotes: carried %d saved setting(s) over from spz-emotes^7'):format(copied)) end
end
