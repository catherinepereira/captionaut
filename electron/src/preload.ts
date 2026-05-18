import { contextBridge, ipcRenderer } from 'electron'

// Exposes a tiny bridge so the renderer can discover the dynamic backend
// port the main process spawned. The frontend reads window.captionaut on
// boot to build its base URL.
contextBridge.exposeInMainWorld('captionaut', {
  getBackendPort: (): Promise<number | null> =>
    ipcRenderer.invoke('captionaut:get-backend-port'),
  isElectron: true,
})

declare global {
  interface Window {
    captionaut?: {
      getBackendPort: () => Promise<number | null>
      isElectron: true
    }
  }
}
