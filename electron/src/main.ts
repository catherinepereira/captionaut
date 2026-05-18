import * as electron from 'electron'
import type { BrowserWindow as BrowserWindowType } from 'electron'
import { spawn, ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import path from 'node:path'
import fs from 'node:fs'

// Belt-and-suspenders guard: when ELECTRON_RUN_AS_NODE=1 is set in the
// user's environment (VS Code and some debuggers do this), Electron's main
// process loader skips `main.js` entirely and runs as plain Node, so this
// check rarely fires from a fresh launch. It does protect against the case
// where main.js is invoked by something that's preserved the env var across
// a spawn. The real defence against this env-var landmine is the
// Captionaut.bat launcher that ships next to the exe and strips the var.
if (typeof electron === 'string' || !(electron as typeof import('electron')).app) {
  console.error(
    'Captionaut: the Electron runtime did not load. This usually means ELECTRON_RUN_AS_NODE=1 is set in your environment. Launch via Captionaut.bat (next to Captionaut.exe) which strips this variable.',
  )
  process.exit(1)
}

const { app, BrowserWindow, ipcMain, shell } = electron as typeof import('electron')

const isDev = !app.isPackaged

// Resolve paths to bundled resources. In packaged builds these live in
// `process.resourcesPath/<name>`; in dev they live next to the source.
function resourcePath(...parts: string[]): string {
  if (isDev) return path.join(__dirname, '..', 'resources', ...parts)
  return path.join(process.resourcesPath, ...parts)
}

function backendExePath(): string {
  // The PyInstaller bundle is shipped as a folder; the entry binary lives
  // inside it. The folder is copied wholesale via electron-builder's
  // extraResources.
  const exe = process.platform === 'win32'
    ? 'captionaut-backend.exe'
    : 'captionaut-backend'
  return resourcePath('backend', exe)
}

function ffmpegPath(): string {
  const bin = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  return resourcePath('ffmpeg', bin)
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        srv.close(() => resolve(port))
      } else {
        reject(new Error('Failed to acquire a port'))
      }
    })
  })
}

async function waitForBackend(port: number, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/status`)
      if (res.ok) return
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Backend did not respond on port ${port} within ${timeoutMs}ms`)
}

let backendProcess: ChildProcess | null = null
let backendPort: number | null = null
let mainWindow: BrowserWindowType | null = null

async function startBackend(): Promise<number> {
  const port = await findFreePort()
  const dataDir = app.getPath('userData')
  fs.mkdirSync(dataDir, { recursive: true })

  const exe = backendExePath()
  if (!fs.existsSync(exe)) {
    throw new Error(`Backend binary not found at ${exe}. Did you run \`npm run build:backend\`?`)
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CAPTIONAUT_DATA_DIR: dataDir,
    FFMPEG_BIN: ffmpegPath(),
  }

  backendProcess = spawn(
    exe,
    ['--port', String(port), '--data-dir', dataDir],
    { env, stdio: ['ignore', 'pipe', 'pipe'] },
  )

  backendProcess.stdout?.on('data', (d) => process.stdout.write(`[backend] ${d}`))
  backendProcess.stderr?.on('data', (d) => process.stderr.write(`[backend] ${d}`))
  backendProcess.on('exit', (code) => {
    console.log(`[backend] exited with code ${code}`)
    backendProcess = null
  })

  await waitForBackend(port)
  backendPort = port
  return port
}

function stopBackend(): void {
  if (!backendProcess) return
  try {
    if (process.platform === 'win32') {
      // SIGTERM is unreliable for spawned processes on Windows; kill the
      // process tree by PID.
      spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'])
    } else {
      backendProcess.kill('SIGTERM')
    }
  } catch (e) {
    console.error('Failed to stop backend cleanly:', e)
  }
  backendProcess = null
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#15171c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // External links open in the default browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url)
    return { action: 'deny' as const }
  })

  if (isDev) {
    // Vite dev server runs separately; the renderer proxies /api to the
    // spawned backend via a global injected by preload.
    await mainWindow.loadURL('http://localhost:5200')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'))
  }
}

ipcMain.handle('captionaut:get-backend-port', () => backendPort)

app.whenReady().then(async () => {
  try {
    if (isDev && process.env.CAPTIONAUT_DEV_BACKEND_PORT) {
      // Use an already-running dev backend (e.g. `python -m backend --port 8010`).
      backendPort = parseInt(process.env.CAPTIONAUT_DEV_BACKEND_PORT, 10)
      console.log(`[backend] using existing dev backend on port ${backendPort}`)
    } else {
      await startBackend()
    }
    await createWindow()
  } catch (err) {
    console.error('Startup failed:', err)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', stopBackend)

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) await createWindow()
})
