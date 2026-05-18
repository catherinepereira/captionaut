import { create } from 'zustand'
import type { ProgressStage } from '../api'

export interface Caption {
  id: number
  start: number
  end: number
  text: string
  speaker?: string | null
  color_override?: string | null
  outline_override?: string | null
  outline_thickness?: number | null
  font_family?: string | null
  font_size?: number | null
  pos_x_override?: number | null
  pos_y_override?: number | null
  align_override?: 'left' | 'center' | 'right' | null
}

export type CaptionPatch = Partial<Omit<Caption, 'id'>>

export interface AlignmentResult {
  caption_id: number
  matched: boolean
  script_text: string | null
  similarity: number
}

export type HorizontalAlign = 'left' | 'center' | 'right'

export interface CaptionStyle {
  fontFamily: string
  fontSize: number
  color: string
  outlineColor: string
  outlineThickness: number
  posX: number  // 0..100, percent of video width
  posY: number  // 0..100, percent of video height
  align: HorizontalAlign
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: 'Arial',
  fontSize: 48,
  color: '#000000',
  outlineColor: '#FFFFFF',
  outlineThickness: 7,
  posX: 50,
  posY: 90,
  align: 'center',
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
  '#8aaad0',
  '#6ec9a9',
  '#d97385',
  '#d3a06b',
  '#7dc1e8',
  '#c89bd0',
  '#9ad17e',
  '#e8c574',
]

type AppState =
  | 'idle'
  | 'uploading'
  | 'configuring'
  | 'transcribing'
  | 'editing'
  | 'rendering'

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
  speakerOutlineColors: Record<string, string>
  speakerOutlineThickness: Record<string, number>
  speakerFontFamilies: Record<string, string>
  speakerFontSizes: Record<string, number>
  speakerPosX: Record<string, number>
  speakerPosY: Record<string, number>
  speakerAlign: Record<string, HorizontalAlign>
  currentTime: number
  videoDuration: number
  seekRequest: number | null
  scrollToCaptionRequest: number | null
  error: string | null
  transcribeProgress: number
  transcribeStage: ProgressStage | null
  transcribeConfig: TranscribeConfig
  isReTranscribing: boolean
  captionStyle: CaptionStyle
  thumbnail: string | null
  projectName: string | null
  toasts: Toast[]

  setVideoFile: (file: File) => void
  setJobId: (id: string) => void
  setState: (s: AppState) => void
  setCaptions: (captions: Caption[]) => void
  updateCaption: (id: number, patch: CaptionPatch) => void
  setAlignment: (results: AlignmentResult[]) => void
  setSpeakers: (labels: string[]) => void
  setSpeakerColor: (label: string, color: string) => void
  setSpeakerOutlineColor: (label: string, color: string) => void
  setSpeakerOutlineThickness: (label: string, value: number) => void
  setSpeakerFontFamily: (label: string, family: string) => void
  setSpeakerFontSize: (label: string, size: number) => void
  setSpeakerPosX: (label: string, value: number) => void
  setSpeakerPosY: (label: string, value: number) => void
  setSpeakerAlign: (label: string, value: HorizontalAlign) => void
  addSpeaker: (label: string) => void
  renameSpeaker: (oldLabel: string, newLabel: string) => void
  removeSpeaker: (label: string, reassignTo?: string | null) => void
  loadSavedSession: (data: {
    captions: Caption[]
    speakers: string[]
    speakerColors: Record<string, string>
    speakerOutlineColors: Record<string, string>
    speakerOutlineThickness: Record<string, number>
    speakerFontFamilies: Record<string, string>
    speakerFontSizes: Record<string, number>
    speakerPosX?: Record<string, number>
    speakerPosY?: Record<string, number>
    speakerAlign?: Record<string, HorizontalAlign>
    alignment: AlignmentResult[]
    captionStyle: CaptionStyle
    thumbnail?: string | null
    name?: string | null
  }) => void
  setCurrentTime: (t: number) => void
  setVideoDuration: (d: number) => void
  requestSeek: (t: number | null) => void
  requestScrollToCaption: (id: number | null) => void
  setError: (msg: string | null) => void
  setTranscribeProgress: (p: number) => void
  setTranscribeStage: (s: ProgressStage | null) => void
  setTranscribeConfig: (patch: Partial<TranscribeConfig>) => void
  setDiarizationConfig: (patch: Partial<DiarizationConfig>) => void
  setCaptionStyle: (patch: Partial<CaptionStyle>) => void
  setReTranscribing: (v: boolean) => void
  setThumbnail: (dataUrl: string | null) => void
  setProjectName: (name: string | null) => void
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

const DEFAULT_SPEAKER_OUTLINE = '#FFFFFF'

function buildOutlinePalette(labels: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  labels.forEach((label) => { out[label] = DEFAULT_SPEAKER_OUTLINE })
  return out
}

// Per-field equality check for caption patches. Strict so adding a new
// Caption field forces a corresponding entry here (TS will flag it).
function patchDiffers(prev: Caption, patch: CaptionPatch): boolean {
  if ('start' in patch && patch.start !== prev.start) return true
  if ('end' in patch && patch.end !== prev.end) return true
  if ('text' in patch && patch.text !== prev.text) return true
  if ('speaker' in patch && patch.speaker !== prev.speaker) return true
  if ('color_override' in patch && patch.color_override !== prev.color_override) return true
  if ('outline_override' in patch && patch.outline_override !== prev.outline_override) return true
  if ('outline_thickness' in patch && patch.outline_thickness !== prev.outline_thickness) return true
  if ('font_family' in patch && patch.font_family !== prev.font_family) return true
  if ('font_size' in patch && patch.font_size !== prev.font_size) return true
  if ('pos_x_override' in patch && patch.pos_x_override !== prev.pos_x_override) return true
  if ('pos_y_override' in patch && patch.pos_y_override !== prev.pos_y_override) return true
  if ('align_override' in patch && patch.align_override !== prev.align_override) return true
  return false
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
  speakerOutlineColors: {},
  speakerOutlineThickness: {},
  speakerFontFamilies: {},
  speakerFontSizes: {},
  speakerPosX: {},
  speakerPosY: {},
  speakerAlign: {},
  currentTime: 0,
  videoDuration: 0,
  seekRequest: null,
  scrollToCaptionRequest: null,
  error: null,
  transcribeProgress: 0,
  transcribeStage: null,
  transcribeConfig: DEFAULT_TRANSCRIBE_CONFIG,
  isReTranscribing: false,
  captionStyle: DEFAULT_CAPTION_STYLE,
  thumbnail: null,
  projectName: null,
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
      if (!patchDiffers(c, patch)) return c
      changed = true
      return { ...c, ...patch }
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
  setSpeakers: (labels) => set({
    speakers: labels,
    speakerColors: buildPalette(labels),
    speakerOutlineColors: buildOutlinePalette(labels),
    speakerOutlineThickness: {},
    speakerFontFamilies: {},
    speakerFontSizes: {},
    speakerPosX: {},
    speakerPosY: {},
    speakerAlign: {},
  }),
  setSpeakerColor: (label, color) =>
    set((store) => ({ speakerColors: { ...store.speakerColors, [label]: color } })),
  setSpeakerOutlineColor: (label, color) =>
    set((store) => ({
      speakerOutlineColors: { ...store.speakerOutlineColors, [label]: color },
    })),
  setSpeakerOutlineThickness: (label, value) =>
    set((store) => ({
      speakerOutlineThickness: { ...store.speakerOutlineThickness, [label]: value },
    })),
  setSpeakerFontFamily: (label, family) =>
    set((store) => ({
      speakerFontFamilies: { ...store.speakerFontFamilies, [label]: family },
    })),
  setSpeakerFontSize: (label, size) =>
    set((store) => ({
      speakerFontSizes: { ...store.speakerFontSizes, [label]: size },
    })),
  setSpeakerPosX: (label, value) =>
    set((store) => ({ speakerPosX: { ...store.speakerPosX, [label]: value } })),
  setSpeakerPosY: (label, value) =>
    set((store) => ({ speakerPosY: { ...store.speakerPosY, [label]: value } })),
  setSpeakerAlign: (label, value) =>
    set((store) => ({ speakerAlign: { ...store.speakerAlign, [label]: value } })),
  addSpeaker: (label) => set((store) => {
    const trimmed = label.trim()
    if (!trimmed || store.speakers.includes(trimmed)) return store
    const nextSpeakers = [...store.speakers, trimmed]
    const color = SPEAKER_PALETTE[(nextSpeakers.length - 1) % SPEAKER_PALETTE.length]
    return {
      speakers: nextSpeakers,
      speakerOutlineColors: {
        ...store.speakerOutlineColors,
        [trimmed]: DEFAULT_SPEAKER_OUTLINE,
      },
      speakerColors: { ...store.speakerColors, [trimmed]: color },
    }
  }),
  renameSpeaker: (oldLabel, newLabel) => set((store) => {
    const trimmed = newLabel.trim()
    if (!trimmed || trimmed === oldLabel) return store
    if (!store.speakers.includes(oldLabel) || store.speakers.includes(trimmed)) return store

    // Preserve ordering in the speakers list.
    const speakers = store.speakers.map((s) => (s === oldLabel ? trimmed : s))

    // Migrate every per-speaker map from old key to new key.
    const migrate = <T,>(map: Record<string, T>): Record<string, T> => {
      if (!(oldLabel in map)) return map
      const next = { ...map }
      next[trimmed] = next[oldLabel]
      delete next[oldLabel]
      return next
    }
    const speakerColors = migrate(store.speakerColors)
    const speakerOutlineColors = migrate(store.speakerOutlineColors)
    const speakerOutlineThickness = migrate(store.speakerOutlineThickness)
    const speakerFontFamilies = migrate(store.speakerFontFamilies)
    const speakerFontSizes = migrate(store.speakerFontSizes)
    const speakerPosX = migrate(store.speakerPosX)
    const speakerPosY = migrate(store.speakerPosY)
    const speakerAlign = migrate(store.speakerAlign)

    // Rewrite every caption that references the old label, history-aware.
    let anyCaptionChanged = false
    const captions = store.captions.map((c) => {
      if (c.speaker !== oldLabel) return c
      anyCaptionChanged = true
      return { ...c, speaker: trimmed }
    })
    const history = anyCaptionChanged
      ? [...store.history, store.captions].slice(-HISTORY_LIMIT)
      : store.history
    const future = anyCaptionChanged ? [] : store.future

    return {
      speakers,
      speakerColors,
      speakerOutlineColors,
      speakerOutlineThickness,
      speakerFontFamilies,
      speakerFontSizes,
      speakerPosX,
      speakerPosY,
      speakerAlign,
      captions,
      history,
      future,
    }
  }),
  removeSpeaker: (label, reassignTo = null) => set((store) => {
    if (!store.speakers.includes(label)) return store
    // Reassign target must be a current speaker (or null to unassign).
    const target =
      reassignTo && store.speakers.includes(reassignTo) && reassignTo !== label
        ? reassignTo
        : null

    const speakers = store.speakers.filter((s) => s !== label)

    const drop = <T,>(map: Record<string, T>): Record<string, T> => {
      if (!(label in map)) return map
      const next = { ...map }
      delete next[label]
      return next
    }

    let anyCaptionChanged = false
    const captions = store.captions.map((c) => {
      if (c.speaker !== label) return c
      anyCaptionChanged = true
      return { ...c, speaker: target }
    })
    const history = anyCaptionChanged
      ? [...store.history, store.captions].slice(-HISTORY_LIMIT)
      : store.history
    const future = anyCaptionChanged ? [] : store.future

    return {
      speakers,
      speakerColors: drop(store.speakerColors),
      speakerOutlineColors: drop(store.speakerOutlineColors),
      speakerOutlineThickness: drop(store.speakerOutlineThickness),
      speakerFontFamilies: drop(store.speakerFontFamilies),
      speakerFontSizes: drop(store.speakerFontSizes),
      speakerPosX: drop(store.speakerPosX),
      speakerPosY: drop(store.speakerPosY),
      speakerAlign: drop(store.speakerAlign),
      captions,
      history,
      future,
    }
  }),
  setCurrentTime: (t) => set((s) => (s.currentTime === t ? s : { currentTime: t })),
  setVideoDuration: (d) => set((s) => (s.videoDuration === d ? s : { videoDuration: d })),
  requestSeek: (t) => set((s) => (s.seekRequest === t ? s : { seekRequest: t })),
  requestScrollToCaption: (id) =>
    set((s) => (s.scrollToCaptionRequest === id ? s : { scrollToCaptionRequest: id })),
  setError: (msg) => set((s) => (s.error === msg ? s : { error: msg })),
  setTranscribeProgress: (p) => set((s) => (s.transcribeProgress === p ? s : { transcribeProgress: p })),
  setTranscribeStage: (st) => set((s) => (s.transcribeStage === st ? s : { transcribeStage: st })),
  setTranscribeConfig: (patch) => set((store) => ({ transcribeConfig: { ...store.transcribeConfig, ...patch } })),
  setDiarizationConfig: (patch) =>
    set((store) => ({
      transcribeConfig: {
        ...store.transcribeConfig,
        diarization: { ...store.transcribeConfig.diarization, ...patch },
      },
    })),
  setCaptionStyle: (patch) => set((store) => ({ captionStyle: { ...store.captionStyle, ...patch } })),
  setReTranscribing: (v) => set({ isReTranscribing: v }),
  setThumbnail: (dataUrl) => set({ thumbnail: dataUrl }),
  setProjectName: (name) => set({ projectName: name && name.trim() ? name.trim() : null }),
  loadSavedSession: (data) => set({
    captions: data.captions,
    speakers: data.speakers,
    speakerColors: data.speakerColors,
    speakerOutlineColors: data.speakerOutlineColors,
    speakerOutlineThickness: data.speakerOutlineThickness,
    speakerFontFamilies: data.speakerFontFamilies,
    speakerFontSizes: data.speakerFontSizes,
    speakerPosX: data.speakerPosX ?? {},
    speakerPosY: data.speakerPosY ?? {},
    speakerAlign: data.speakerAlign ?? {},
    alignment: data.alignment,
    captionStyle: data.captionStyle,
    thumbnail: data.thumbnail ?? null,
    projectName: data.name ?? null,
    history: [],
    future: [],
  }),
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
      alignment: [], speakers: [], speakerColors: {}, speakerOutlineColors: {},
      speakerOutlineThickness: {}, speakerFontFamilies: {}, speakerFontSizes: {},
      speakerPosX: {}, speakerPosY: {}, speakerAlign: {},
      currentTime: 0, videoDuration: 0, seekRequest: null, scrollToCaptionRequest: null, error: null,
      transcribeProgress: 0, transcribeStage: null, transcribeConfig: DEFAULT_TRANSCRIBE_CONFIG,
      isReTranscribing: false,
      thumbnail: null,
      projectName: null,
    }
  }),
}))
