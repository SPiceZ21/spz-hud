import { render } from 'preact'
import { App } from './app'
import './styles/nui-base.css'
import './styles/app.css'
import { initMockEnv } from './mock'

initMockEnv()

render(<App />, document.getElementById('root')!)
