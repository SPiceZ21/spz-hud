import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// Source lives in web/, the build (page + everything in web/public) goes to
// ../ui, which is what the resource serves.
export default defineConfig({
  plugins: [preact()],
  base: './',
  build: { outDir: '../ui', emptyOutDir: true },
})
