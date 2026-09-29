import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { restoreBounds, trackWindowState } from './windowState.js'
import { registerMediaProtocol, setupMediaProtocolHandler, registerFsHandlers } from './fsHandlers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// 버전은 package.json 한 곳에서만 가져온다 (Kim's programe 공통 규칙: 창 제목의
// 버전과 설치파일 버전이 항상 같은 값이어야 함).
const { version: APP_VERSION } = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'))
const WINDOW_TITLE = `FastImageAnnotator v${APP_VERSION}`

// 이 뷰어는 항상 media:// 프로토콜로 사진을 새로 읽어오고, 짧게 켰다 끄는 용도라
// 디스크에 영구 저장되는 HTTP/GPU 셰이더 캐시가 득이 될 일이 없다. 반대로, PhotoDedup이
// 연속으로 여러 번 실행하다가 이전 인스턴스가 미처 다 안 닫힌 채 새 인스턴스가 뜨면 그
// 캐시 폴더를 두 프로세스가 동시에 붙잡으면서 "Unable to move the cache" 오류가 나고
// 몇 초씩 재시도하다 창이 뜨는 현상을 직접 재현/확인했다. 캐시 자체를 꺼서 이 지연을
// 구조적으로 없앤다.
app.commandLine.appendSwitch('disable-http-cache')
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

// 같은 이유로, 이전 인스턴스가 아직 안 닫혔는데 PhotoDedup이 새 인스턴스를 띄우면 위 캐시
// 경합이 재발할 수 있다. 싱글 인스턴스 락으로, 이미 떠 있으면 새 프로세스는 그 창에 폴더
// 경로만 전달하고 즉시 종료하도록 해서 "이전 창 닫기 대기 -> 새 창 뜨기"의 지연 자체를
// 없앤다 (기존 창이 새 폴더로 바로 전환됨).
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

registerMediaProtocol()

// 다른 프로그램(예: PhotoDedup)이 "FastImageAnnotator.exe <폴더경로>" 형태로 실행했을 때
// 그 폴더를 자동으로 열기 위한 것. 패키징된 앱은 process.argv가 [exe경로, ...인자]이고,
// `vite`/`electron .`으로 띄우는 개발 모드는 [electron경로, 프로젝트경로, ...인자]라서
// 건너뛰는 개수가 다르다. "-"로 시작하는 옵션은 건너뛰고, 실제 존재하는 폴더만 인정한다.
function resolveLaunchFolder(argv) {
  const args = app.isPackaged ? argv.slice(1) : argv.slice(2)
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

let mainWin = null

function createWindow() {
  const bounds = restoreBounds()
  const launchFolder = resolveLaunchFolder(process.argv)

  const win = new BrowserWindow({
    ...bounds,
    title: WINDOW_TITLE,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWin = win
  win.on('closed', () => {
    if (mainWin === win) mainWin = null
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

// PhotoDedup 등이 이 뷰어가 이미 떠 있는 동안 또 실행하면(예: 연달아 여러 zip을 처리),
// 새 프로세스를 따로 띄우는 대신 이미 뜬 창을 그 폴더로 바로 전환한다 -- 창을 닫았다가
// 다시 여는 왕복(및 그로 인한 캐시 경합/지연) 자체가 없어진다.
app.on('second-instance', (_event, argv) => {
  if (!mainWin) return
  if (mainWin.isMinimized()) mainWin.restore()
  mainWin.focus()
  const folder = resolveLaunchFolder(argv)
  if (folder) mainWin.webContents.send('open-folder', folder)
})

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
