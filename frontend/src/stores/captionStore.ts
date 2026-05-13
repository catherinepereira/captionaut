import { create } from 'zustand'

export interface Caption {
  id: number
  start: number
  end: number
  text: string
  speaker?: string | null
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

// Palette used to assign colors to detected speakers (consumer cycles through it)
export const SPEAKER_PALETTE = [
  '#7c5cfc', // purple
  '#4caf91', // green
  '#e05c7a', // red
  '#ffa726', // orange
  '#42a5f5', // blue
  '#ec407a', // pink
  '#ab47bc', // violet
  '#26c6da', // cyan
]

type AppState =
  | 'idle'
  | 'uploading'
  | 'configuring'
  | 'transcribing'
  | 'editing'
  | 'burning'

interface CaptionStore {
  state: AppState
  jobId: string | null
  videoFile: File | null
  videoUrl: string | null
  captions: Caption[]
  alignment: AlignmentResult[]
  speakers: string[]                  // detected labels, e.g. "SPEAKER_00"
  speakerColors: Record<string, string>
  currentTime: number
  seekRequest: number | null
  error: string | null
  transcribeProgress: number
  transcribeConfig: TranscribeConfig
  burnStyle: BurnStyle

  setVideoFile: (file: File) => void
  setJobId: (id: string) => void
  setState: (s: AppState) => void
  setCaptions: (captions: Caption[]) => void
  updateCaption: (id: number, patch: Partial<Omit<Caption, 'id'>>) => void
  setAlignment: (results: AlignmentResult[]) => void
  setSpeakers: (labels: string[]) => void
  setSpeakerColor: (label: string, color: string) => void
  setCurrentTime: (t: number) => void
  requestSeek: (t: number | null) => void
  setError: (msg: string | null) => void
  setTranscribeProgress: (p: number) => void
  setTranscribeConfig: (patch: Partial<TranscribeConfig>) => void
  setDiarizationConfig: (patch: Partial<DiarizationConfig>) => void
  setBurnStyle: (patch: Partial<BurnStyle>) => void
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
  alignment: [],
  speakers: [],
  speakerColors: {},
  currentTime: 0,
  seekRequest: null,
  error: null,
  transcribeProgress: 0,
  transcribeConfig: DEFAULT_TRANSCRIBE_CONFIG,
  burnStyle: DEFAULT_BURN_STYLE,

  setVideoFile: (file) => set({
    videoFile: file,
    videoUrl: URL.createObjectURL(file),
  }),
  setJobId: (id) => set({ jobId: id }),
  setState: (s) => set({ state: s }),
  setCaptions: (captions) => set({ captions }),
  updateCaption: (id, patch) => set((store) => {
    let changed = false
    const next = store.captions.map((c) => {
      if (c.id !== id) return c
      const merged = { ...c, ...patch }
      if (merged.text === c.text && merged.start === c.start && merged.end === c.end) {
        return c
      }
      changed = true
      return merged
    })
    return changed ? { captions: next } : store
  }),
  setAlignment: (results) => set({ alignment: results }),
  setSpeakers: (labels) => set({ speakers: labels, speakerColors: buildPalette(labels) }),
  setSpeakerColor: (label, color) =>
    set((store) => ({ speakerColors: { ...store.speakerColors, [label]: color } })),
  setCurrentTime: (t) => set((s) => (s.currentTime === t ? s : { currentTime: t })),
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
  reset: () => set({
    state: 'idle', jobId: null, videoFile: null, videoUrl: null,
    captions: [], alignment: [], speakers: [], speakerColors: {},
    currentTime: 0, seekRequest: null, error: null,
    transcribeProgress: 0, transcribeConfig: DEFAULT_TRANSCRIBE_CONFIG,
  }),
}))
