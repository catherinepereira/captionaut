import type {
  Caption, AlignmentResult, BurnStyle, ModelSize, DiarizationConfig,
} from './stores/captionStore'

export interface TranscribeResult {
  captions: Caption[]
  speakers: string[]
}

// Same-origin in every environment: Vite proxies `/api` in dev, FastAPI
// serves the built React bundle under `/` in production.
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

export interface SpeakerStyleMaps {
  colors: Record<string, string>
  outlineColors: Record<string, string>
  outlineThickness: Record<string, number>
  fontFamilies: Record<string, string>
  fontSizes: Record<string, number>
}

function nonEmpty<T extends Record<string, unknown>>(m: T): T | null {
  return Object.keys(m).length > 0 ? m : null
}

export async function burnCaptions(
  jobId: string,
  captions: Caption[],
  style: BurnStyle,
  speakers: SpeakerStyleMaps,
): Promise<Blob> {
  const res = await fetch(`${BASE}/burn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job_id: jobId,
      captions,
      style,
      speaker_colors: nonEmpty(speakers.colors),
      speaker_outline_colors: nonEmpty(speakers.outlineColors),
      speaker_outline_thickness: nonEmpty(speakers.outlineThickness),
      speaker_font_families: nonEmpty(speakers.fontFamilies),
      speaker_font_sizes: nonEmpty(speakers.fontSizes),
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

export interface Capabilities {
  pyannote_cached: boolean
  demucs_cached: boolean
}

export async function checkCapabilities(): Promise<Capabilities> {
  const res = await fetch(`${BASE}/capabilities`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

interface ProgressEvent {
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
  // Defer revoke a tick; some browsers haven't started the download yet.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
