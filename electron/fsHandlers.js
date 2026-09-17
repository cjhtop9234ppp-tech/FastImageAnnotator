import { ipcMain, dialog, protocol, net } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { getLastFolder, setLastFolder } from './windowState.js'

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'])

export function registerMediaProtocol() {
  // NOT `standard: true` -- Chromium's standard-URL parser treats a Windows
  // drive letter right after the authority marker (media:///C:/...) as a
  // "host:port" pair and silently drops the colon (media://c/Users/...).
  // Keeping the scheme non-standard makes everything after `media:` opaque,
  // so the encoded path round-trips exactly as constructed.
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'media',
      privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true },
    },
  ])
}

export function setupMediaProtocolHandler() {
  protocol.handle('media', async (request) => {
    const fileUrl = 'file:' + request.url.slice('media:'.length)
    const filePath = fileURLToPath(fileUrl)
    const response = await net.fetch(pathToFileURL(filePath).toString())

    // Without an explicit CORS header, Chromium treats media:// images as
    // cross-origin and "taints" any canvas they're drawn onto, which blocks
    // toDataURL()/toCanvasElement() when composing the final saved image.
    const headers = new Headers(response.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(response.body, { status: response.status, headers })
  })
}

// Reuses Node's file-URL <-> path conversion (which already handles drive
// letters, spaces, and unicode correctly) instead of hand-rolled encoding.
function toMediaUrl(filePath) {
  return pathToFileURL(filePath).toString().replace(/^file:/, 'media:')
}

async function listFolder(folderPath) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true })
  const folders = []
  const imageFiles = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = path.join(folderPath, entry.name)
    if (entry.isDirectory()) {
      folders.push({ name: entry.name, path: fullPath })
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      if (IMAGE_EXTS.has(ext)) {
        imageFiles.push({ name: entry.name, path: fullPath, ext: ext.slice(1).toUpperCase() })
      }
    }
  }

  const images = await Promise.all(
    imageFiles.map(async (file) => {
      const stat = await fs.stat(file.path)
      return {
        ...file,
        url: toMediaUrl(file.path),
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      }
    }),
  )

  folders.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  images.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return { folders, images }
}

export function registerFsHandlers() {
  ipcMain.handle('fs:choose-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: getLastFolder() ?? undefined,
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const chosen = result.filePaths[0]
    setLastFolder(chosen)
    return chosen
  })

  ipcMain.handle('fs:list-folder', async (_event, folderPath) => {
    return listFolder(folderPath)
  })

  ipcMain.handle('fs:save-image', async (_event, { originalPath, dataUrl, mode }) => {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')

    let targetPath = originalPath
    if (mode === 'copy') {
      const ext = path.extname(originalPath)
      const baseName = path.basename(originalPath, ext)
      targetPath = path.join(path.dirname(originalPath), `${baseName}_edited${ext}`)
    }

    await fs.writeFile(targetPath, buffer)
    return { path: targetPath }
  })
}
