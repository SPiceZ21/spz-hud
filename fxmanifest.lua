fx_version 'cerulean'
game 'gta5'
lua54 'yes'

description 'SPiceZ HUD host: one overlay page, player-placed widgets, shared focus'
author 'SPiceZ'
version '0.1.0'

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
}

client_scripts {
    'client/focus.lua',
    'client/main.lua',
    'client/apps.lua',
    'client/keybar.lua',
    'client/hub.lua',
}

dependencies {
    'ox_lib',
}
