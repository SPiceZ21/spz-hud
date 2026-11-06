fx_version 'cerulean'
game 'gta5'
lua54 'yes'

description 'SPiceZ HUD host: one overlay page, player-placed widgets, shared focus, speedometer, pause menu, nametags, chat, emotes'
author 'SPiceZ'
version '2.0.0'

ui_page 'ui/index.html'

files {
    'ui/**/*',
    'dui/**/*',          -- in-world DUI pages (spz-races checkpoint pill / animation)
    'shim.lua',
    'app.lua',           -- for resources that drive several pages (spz-races)
}

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
    'config_pausemenu.lua',   -- Config.PauseMenu (merged from spz-pausemenu)
    'config_nametag.lua',     -- Config.Nametag   (merged from spz-nametag)
    'config_chat.lua',        -- Config.Chat      (merged from spz-chat)
    'config_emotes.lua',      -- Config.Emotes    (merged from spz-emotes)
    'shared/emotes.lua',
}

client_scripts {
    'client/focus.lua',
    'client/main.lua',
    'client/apps.lua',
    'client/keybar.lua',
    'client/hub.lua',
    -- Merged in from spz-speedometer and spz-pausemenu. Their pages are still
    -- the spz-speedometer / spz-pausemenu apps; SpzHudApp (apps.lua) binds each.
    'client/speedometer.lua',
    'client/pausemenu.lua',
    -- Merged in from spz-nametag, spz-chat and spz-emotes.
    'client/nametag.lua',
    'client/chat_boot.lua',
    'client/chat.lua',
    'client/emotes/migrate.lua',   -- before play.lua: carries saved settings over from spz-emotes
    'client/emotes/play.lua',
    'client/emotes/shared.lua',
    'client/emotes/menu.lua',
}

server_scripts {
    'config_chat_server.lua',   -- SERVER ONLY: chat API keys (never shared with players)
    'server/pausemenu.lua',
    'server/nametag.lua',
    'server/chat_giphy.lua',
    'server/chat.lua',
    'server/emotes.lua',
}

dependencies {
    'ox_lib',
    'spz-core',     -- theme, KeyFor, tablet (speedometer, pause menu)
    'spz-identity', -- chat profiles
}
