import { create } from 'zustand'

export interface Caption {
  id: number
  start: number
  end: number
  text: string
  speaker?: string | null
  color_override?: string | null
  outline_override?: string | null
}

export interface AlignmentResult {
  caption_id: number
  matched: boolean
  script_text: string | null
  similarity: number
}

export interface BurnStyle {
  fontFamily: string
  fontSize: number
  color: string
  outlineColor: string
  position: 'top' | 'middle' | 'bottom'
}

export const DEFAULT_BURN_STYLE: BurnStyle = {
  fontFamily: 'Arial',
  fontSize: 48,
  color: '#FFFFFF',
  outlineColor: '#000000',
  position: 'bottom',
}

export type ModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large'

export interface DiarizationConfig {
  enabled: boolean
  hfToken: string
  numSpeakers: number | null
}

export interface TranscribeConfig {
  modelSize: ModelSize
  initialPrompt: string
  scriptFile: File | null
  diarization: DiarizationConfig
  denoise: boolean
}

export const DEFAULT_TRANSCRIBE_CONFIG: TranscribeConfig = {
  modelSize: 'base',
  initialPrompt: '',
  scriptFile: null,
  diarization: {
    enabled: false,
    hfToken: '',
    numSpeakers: null,
  },
  denoise: false,
}

export const SPEAKER_PALETTE = [
  '#7c5cfc',
  '#4caf91',
  '#e05c7a',
  '#ffa726',
  '#42a5f5',
  '#ec407a',
  '#ab47bc',
  '#26c6da',
]

type AppState =
  | 'idle'
  | 'uploading'
  | 'configuring'
  | 'transcribing'
  | 'editing'
  | 'burning'

const HISTORY_LIMIT = 100

export interface Toast {
  id: number
  kind: 'info' | 'warn' | 'error'
  message: string
}

let _toastSeq = 0

interface CaptionStore {
  state: AppState
  jobId: string | null
  videoFile: File | null
  videoUrl: string | null
  captions: Caption[]
  history: Caption[][]
  future: Caption[][]
  alignment: AlignmentResult[]
  speakers: string[]                  // detected labels, e.g. "SPEAKER_00"
  speakerColors: Record<string, string>
  currentTime: number
  videoDuration: number
  seekRequest: number | null
  error: string | null
  transcribeProgress: number
  transcribeConfig: TranscribeConfig
  burnStyle: BurnStyle
  toasts: Toast[]

  setVideoFile: (file: File) => void
  setJobId: (id: string) => void
  setState: (s: AppState) => void
  setCaptions: (captions: Caption[]) => void
  updateCaption: (id: number, patch: Partial<Omit<Caption, 'id'>>) => void
  setAlignment: (results: AlignmentResult[]) => void
  setSpeakers: (labels: string[]) => void
  setSpeakerColor: (label: string, color: string) => void
  addSpeaker: (label: string) => void
  setCurrentTime: (t: number) => void
  setVideoDuration: (d: number) => void
  requestSeek: (t: number | null) => void
  setError: (msg: string | null) => void
  setTranscribeProgress: (p: number) => void
  setTranscribeConfig: (patch: Partial<TranscribeConfig>) => void
  setDiarizationConfig: (patch: Partial<DiarizationConfig>) => void
  setBurnStyle: (patch: Partial<BurnStyle>) => void
  replaceCaptions: (next: Caption[]) => void  // history-aware mutator for bulk ops
  undo: () => void
  redo: () => void
  pushToast: (kind: Toast['kind'], message: string) => number
  dismissToast: (id: number) => void
  reset: () => void
}

function buildPalette(labels: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  labels.forEach((label, i) => { out[label] = SPEAKER_PALETTE[i % SPEAKER_PALETTE.length] })
  return out
}

export const useCaptionStore = create<CaptionStore>((set) => ({
  state: 'idle',
  jobId: null,
  videoFile: null,
  videoUrl: null,
  captions: [],
  history: [],
  future: [],
  alignment: [],
  speakers: [],
  speakerColors: {},
  currentTime: 0,
  videoDuration: 0,
  seekRequest: null,
  error: null,
  transcribeProgress: 0,
  transcribeConfig: DEFAULT_TRANSCRIBE_CONFIG,
  burnStyle: DEFAULT_BURN_STYLE,
  toasts: [],

  setVideoFile: (file) => set((store) => {
    if (store.videoUrl) URL.revokeObjectURL(store.videoUrl)
    return { videoFile: file, videoUrl: URL.createObjectURL(file) }
  }),
  setJobId: (id) => set({ jobId: id }),
  setState: (s) => set({ state: s }),
  // Initial load (after transcription / restore): replaces captions wholesale
  // and resets the undo stack so the user starts from a clean slate.
  setCaptions: (captions) => set({ captions, history: [], future: [] }),
  updateCaption: (id, patch) => set((store) => {
    let changed = false
    const next = store.captions.map((c) => {
      if (c.id !== id) return c
      const merged = { ...c, ...patch }
      if (
        merged.text === c.text &&
        merged.start === c.start &&
        merged.end === c.end &&
        merged.speaker === c.speaker
      ) {
        return c
      }
      changed = true
      return merged
    })
    if (!changed) return store
    const history = [...store.history, store.captions].slice(-HISTORY_LIMIT)
    return { captions: next, history, future: [] }
  }),
  replaceCaptions: (next) => set((store) => {
    if (next === store.captions) return store
    const history = [...store.history, store.captions].slice(-HISTORY_LIMIT)
    return { captions: next, history, future: [] }
  }),
  undo: () => set((store) => {
    if (store.history.length === 0) return store
    const prev = store.history[store.history.length - 1]
    return {
      captions: prev,
      history: store.history.slice(0, -1),
      future: [...store.future, store.captions],
    }
  }),
  redo: () => set((store) => {
    if (store.future.length === 0) return store
    const next = store.future[store.future.length - 1]
    return {
      captions: next,
      history: [...store.history, store.captions],
      future: store.future.slice(0, -1),
    }
  }),
  setAlignment: (results) => set({ alignment: results }),
  setSpeakers: (labels) => set({ speakers: labels, speakerColors: buildPalette(labels) }),
  setSpeakerColor: (label, color) =>
    set((store) => ({ speakerColors: { ...store.speakerColors, [label]: color } })),
  addSpeaker: (label) => set((store) => {
    const trimmed = label.trim()
    if (!trimmed || store.speakers.includes(trimmed)) return store
    const nextSpeakers = [...store.speakers, trimmed]
    const color = SPEAKER_PALETTE[(nextSpeakers.length - 1) % SPEAKER_PALETTE.length]
    return {
      speakers: nextSpeakers,
      speakerColors: { ...store.speakerColors, [trimmed]: color },
    }
  }),
  setCurrentTime: (t) => set((s) => (s.currentTime === t ? s : { currentTime: t })),
  setVideoDuration: (d) => set((s) => (s.videoDuration === d ? s : { videoDuration: d })),
  requestSeek: (t) => set((s) => (s.seekRequest === t ? s : { seekRequest: t })),
  setError: (msg) => set((s) => (s.error === msg ? s : { error: msg })),
  setTranscribeProgress: (p) => set((s) => (s.transcribeProgress === p ? s : { transcribeProgress: p })),
  setTranscribeConfig: (patch) => set((store) => ({ transcribeConfig: { ...store.transcribeConfig, ...patch } })),
  setDiarizationConfig: (patch) =>
    set((store) => ({
      transcribeConfig: {
        ...store.transcribeConfig,
        diarization: { ...store.transcribeConfig.diarization, ...patch },
      },
    })),
  setBurnStyle: (patch) => set((store) => ({ burnStyle: { ...store.burnStyle, ...patch } })),
  pushToast: (kind, message) => {
    const id = ++_toastSeq
    set((store) => ({ toasts: [...store.toasts, { id, kind, message }] }))
    return id
  },
  dismissToast: (id) => set((store) => ({ toasts: store.toasts.filter((t) => t.id !== id) })),
  reset: () => set((store) => {
    if (store.videoUrl) URL.revokeObjectURL(store.videoUrl)
    return {
      state: 'idle', jobId: null, videoFile: null, videoUrl: null,
      captions: [], history: [], future: [],
      alignment: [], speakers: [], speakerColors: {},
      currentTime: 0, videoDuration: 0, seekRequest: null, error: null,
      transcribeProgress: 0, transcribeConfig: DEFAULT_TRANSCRIBE_CONFIG,
    }
  }),
}))
