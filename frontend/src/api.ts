import type {
  Caption, AlignmentResult, BurnStyle, ModelSize, DiarizationConfig,
} from './stores/captionStore'

export interface TranscribeResult {
  captions: Caption[]
  speakers: string[]
}

/**
 * Frontend always talks to a same-origin `/api` path.
 * - Dev: Vite proxies `/api` → FastAPI backend (see vite.config.ts).
 * - Packaged: FastAPI serves the React build as static files, so `/api` is same-origin.
 * - Electron: Loads the page from FastAPI's static server, so same-origin still holds.
 */
const BASE = '/api'

export async function uploadVideo(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()).job_id
}

export async function transcribeJob(
  jobId: string,
  opts: {
    modelSize: ModelSize
    initialPrompt: string
    diarization: DiarizationConfig
    denoise: boolean
  },
): Promise<TranscribeResult> {
  const res = await fetch(`${BASE}/transcribe/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_size: opts.modelSize,
      initial_prompt: opts.initialPrompt || null,
      diarization: {
        enabled: opts.diarization.enabled,
        hf_token: opts.diarization.hfToken || null,
        num_speakers: opts.diarization.numSpeakers,
      },
      denoise: opts.denoise,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return { captions: data.captions, speakers: data.speakers ?? [] }
}

export async function alignScript(jobId: string, file: File): Promise<AlignmentResult[]> {
  const form = new FormData()
  form.append('script_file', file)
  const res = await fetch(`${BASE}/align/${jobId}`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function burnCaptions(
  jobId: string,
  captions: Caption[],
  style: BurnStyle,
  speakerColors?: Record<string, string>,
): Promise<Blob> {
  const res = await fetch(`${BASE}/burn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job_id: jobId,
      captions,
      style,
      speaker_colors: speakerColors && Object.keys(speakerColors).length > 0 ? speakerColors : null,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.blob()
}

export async function exportCaptions(captions: Caption[], format: 'srt' | 'vtt'): Promise<string> {
  const res = await fetch(`${BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captions, format }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.text()
}

export async function checkModelStatus(): Promise<{ downloaded: boolean; size_mb: number }> {
  const res = await fetch(`${BASE}/model-status`)
  return res.json()
}

// ── helpers ───────────────────────────────────────────────────────────────────

export interface ProgressEvent {
  status?: 'downloading' | 'done' | 'already_downloaded' | 'error'
  percent?: number
  done?: boolean
  message?: string
}

export interface StreamHandle {
  close: () => void
}

export function streamProgress(
  path: string,
  handlers: {
    onProgress?: (pct: number) => void
    onDone?: () => void
    onError?: (msg: string) => void
  },
): StreamHandle {
  const es = new EventSource(`${BASE}${path}`)
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    es.close()
  }
  es.onmessage = (e) => {
    let data: ProgressEvent
    try { data = JSON.parse(e.data) } catch { return }
    if (data.status === 'error') {
      handlers.onError?.(data.message ?? 'Unknown error')
      close()
      return
    }
    if (typeof data.percent === 'number') handlers.onProgress?.(data.percent)
    if (data.done || data.status === 'done' || data.status === 'already_downloaded') {
      handlers.onDone?.()
      close()
    }
  }
  es.onerror = () => {
    handlers.onError?.('Connection lost')
    close()
  }
  return { close }
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
