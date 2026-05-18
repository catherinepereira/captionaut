// Launches Electron in dev mode against an already-running backend.
// Strips ELECTRON_RUN_AS_NODE (often set by VS Code in the parent env),
// which would otherwise turn the spawned electron binary into a plain
// Node process and break `require('electron')`.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
env.CAPTIONAUT_DEV_BACKEND_PORT = env.CAPTIONAUT_DEV_BACKEND_PORT ?? '8010'

const electronBin = process.platform === 'win32'
  ? path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron')

const child = spawn(electronBin, [projectRoot], { env, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 1))
