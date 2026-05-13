/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    getBackendPort(): Promise<number>
  }
}
