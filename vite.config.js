import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'

// import.meta.url-relative (not './package.json') so this resolves correctly
// regardless of the process's current working directory when vite is invoked.
const packageJsonPath = fileURLToPath(new URL('./package.json', import.meta.url))
const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.js',
      },
      preload: {
        input: 'electron/preload.js',
      },
    }),
    renderer(),
  ],
})
