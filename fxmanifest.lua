fx_version 'cerulean'
game 'gta5'
lua54 'yes'

description 'SPiceZ HUD host: one overlay page, player-placed widgets, shared focus, speedometer, pause menu'
author 'SPiceZ'
version '1.0.0'

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
}

server_scripts {
    'server/pausemenu.lua',
}

dependencies {
    'ox_lib',
    'spz-core',     -- theme, KeyFor, tablet (speedometer, pause menu)
}
