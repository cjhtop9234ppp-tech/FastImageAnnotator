import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { restoreBounds, trackWindowState } from './windowState.js'
import { registerMediaProtocol, setupMediaProtocolHandler, registerFsHandlers } from './fsHandlers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

registerMediaProtocol()

// 다른 프로그램(예: PhotoDedup)이 "FastImageAnnotator.exe <폴더경로>" 형태로 실행했을 때
// 그 폴더를 자동으로 열기 위한 것. 패키징된 앱은 process.argv가 [exe경로, ...인자]이고,
// `vite`/`electron .`으로 띄우는 개발 모드는 [electron경로, 프로젝트경로, ...인자]라서
// 건너뛰는 개수가 다르다. "-"로 시작하는 옵션은 건너뛰고, 실제 존재하는 폴더만 인정한다.
function resolveLaunchFolder() {
  const args = app.isPackaged ? process.argv.slice(1) : process.argv.slice(2)
  for (const arg of args) {
    if (!arg || arg.startsWith('-')) continue
    try {
      if (fs.statSync(arg).isDirectory()) return arg
    } catch {
      // 존재하지 않는 경로면 무시하고 다음 인자를 본다.
    }
  }
  return null
}

function createWindow() {
  const bounds = restoreBounds()
  const launchFolder = resolveLaunchFolder()

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  trackWindowState(win)

  win.once('ready-to-show', () => win.show())

  if (launchFolder) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('open-folder', launchFolder)
    })
  }

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  setupMediaProtocolHandler()
  registerFsHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
