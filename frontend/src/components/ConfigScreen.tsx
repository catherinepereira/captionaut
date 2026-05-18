import { useEffect, useRef, useState } from 'react'
import { useCaptionStore, type ModelSize } from '../stores/captionStore'
import { loadSettings, saveSettings } from '../utils/settings'
import { getCachedModels } from '../api'

interface ModelOption {
  value: ModelSize
  label: string
  size: string
  speed: string
}

const MODEL_OPTIONS: ModelOption[] = [
  { value: 'tiny',   label: 'Tiny',   size: '~75 MB',  speed: 'fastest' },
  { value: 'base',   label: 'Base',   size: '~145 MB', speed: 'fast' },
  { value: 'small',  label: 'Small',  size: '~465 MB', speed: 'balanced' },
  { value: 'medium', label: 'Medium', size: '~1.5 GB', speed: 'slow' },
  { value: 'large',  label: 'Large',  size: '~3 GB',   speed: 'slowest, most accurate' },
]

interface Props {
  onStart: () => void
  onCancel: () => void
}

const labelClass = 'block text-xs font-semibold tracking-[0.06em] uppercase text-accent-light mb-2.5'
const hintClass = 'mt-2 text-xs text-text-dim leading-snug'
const inputClass = 'w-full bg-bg border border-border text-text-primary text-[13px] px-2.5 py-2 rounded-md outline-none focus:border-accent'

export function ConfigScreen({ onStart, onCancel }: Props) {
  const videoFile = useCaptionStore((s) => s.videoFile)
  const config = useCaptionStore((s) => s.transcribeConfig)
  const setConfig = useCaptionStore((s) => s.setTranscribeConfig)
  const setDiarization = useCaptionStore((s) => s.setDiarizationConfig)
  const isReTranscribing = useCaptionStore((s) => s.isReTranscribing)
  const scriptInputRef = useRef<HTMLInputElement>(null)
  const [cachedModels, setCachedModels] = useState<Set<string>>(new Set())

  useEffect(() => {
    getCachedModels()
      .then((r) => setCachedModels(new Set(r.cached)))
      .catch(() => {})
  }, [])

  const onHfTokenChange = (token: string) => {
    setDiarization({ hfToken: token })
    saveSettings({ ...loadSettings(), hfToken: token })
  }

  useEffect(() => {
    const s = loadSettings()
    if (!config.diarization.hfToken && s.hfToken) {
      setDiarization({ hfToken: s.hfToken })
    }
    if (config.modelSize === 'base' && s.defaultModelSize !== 'base') {
      setConfig({ modelSize: s.defaultModelSize })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-start justify-center px-6 py-12">
      <div className="bg-card border border-border rounded-md px-9 py-8 w-full max-w-[640px]">
        <h2 className="text-[22px] font-bold text-text-primary mb-1">
          {isReTranscribing ? 'Re-transcribe video' : 'Configure transcription'}
        </h2>
        {isReTranscribing && (
          <p className="text-xs text-text-dim mb-3">
            Running this will replace your current captions, speakers, and edits.
          </p>
        )}
        {videoFile && (
          <p className="text-[13px] text-text-muted mb-7 overflow-hidden text-ellipsis whitespace-nowrap">
            {videoFile.name}
          </p>
        )}

        <section className="mb-6" aria-labelledby="model-label">
          <span id="model-label" className={labelClass}>Model</span>
          <div
            role="radiogroup"
            aria-labelledby="model-label"
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}
          >
            {MODEL_OPTIONS.map((opt) => {
              const active = config.modelSize === opt.value
              const downloaded = cachedModels.has(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`relative flex flex-col gap-1 px-2.5 py-3 rounded-md border text-left transition-colors ${
                    active
                      ? 'bg-accent border-accent text-white hover:bg-accent-light hover:border-accent-light'
                      : 'bg-input border-border text-text-primary hover:border-accent-light'
                  }`}
                  onClick={() => setConfig({ modelSize: opt.value })}
                >
                  {downloaded && (
                    <span
                      aria-label="Already downloaded"
                      title="Already downloaded"
                      className={`absolute top-1.5 right-1.5 text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-sm ${
                        active ? 'bg-white/20 text-white' : 'bg-accent/15 text-accent-light'
                      }`}
                    >
                      ✓ Cached
                    </span>
                  )}
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-[11px] opacity-75">{opt.size} · {opt.speed}</span>
                </button>
              )
            })}
          </div>
          <p className={hintClass}>
            Larger models are more accurate but slower. The first run with a new model will download it.
          </p>
        </section>

        <section className="mb-6">
          <label htmlFor="prompt" className={labelClass}>
            Prompt <span className="font-normal normal-case tracking-normal text-text-dim">(optional)</span>
          </label>
          <textarea
            id="prompt"
            rows={3}
            placeholder='Names, jargon, or context that helps Whisper get spelling right. e.g. "Discussion of Captionaut, FFmpeg, and pyannote."'
            value={config.initialPrompt}
            onChange={(e) => setConfig({ initialPrompt: e.target.value })}
            className="w-full bg-input border border-border text-text-primary text-[13px] px-3 py-2.5 rounded-md outline-none resize-y leading-snug focus:border-accent"
          />
        </section>

        <section className="mb-6">
          <label className={labelClass}>
            Script <span className="font-normal normal-case tracking-normal text-text-dim">(optional)</span>
          </label>
          <input
            ref={scriptInputRef}
            type="file"
            accept=".txt,.srt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setConfig({ scriptFile: f })
            }}
          />
          {config.scriptFile ? (
            <div className="flex items-center gap-3 bg-input border border-border rounded-md px-3.5 py-2.5">
              <span className="flex-1 text-[13px] text-text-primary overflow-hidden text-ellipsis whitespace-nowrap">
                {config.scriptFile.name}
              </span>
              <button
                onClick={() => setConfig({ scriptFile: null })}
                className="bg-transparent border-0 text-text-muted text-xs hover:text-red"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => scriptInputRef.current?.click()}
              className="w-full bg-transparent border border-dashed border-border text-text-muted text-[13px] py-3.5 rounded-md hover:border-accent-light hover:text-accent-light transition-colors"
            >
              Choose a .txt or .srt file
            </button>
          )}
          <p className={hintClass}>
            If provided, captions will be aligned against the script and mismatches highlighted.
          </p>
        </section>

        <section className="mb-6">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.denoise}
              onChange={(e) => setConfig({ denoise: e.target.checked })}
              className="w-4 h-4 cursor-pointer"
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span className="text-sm font-semibold text-text-primary">Denoise audio (Demucs vocal isolation)</span>
          </label>
          <p className={hintClass}>
            Recommended only for noisy videos. Isolates vocals before transcription.
            Significantly slower; downloads a ~250 MB model on first use.
          </p>
        </section>

        <section className="mb-6">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.diarization.enabled}
              onChange={(e) => setDiarization({ enabled: e.target.checked })}
              className="w-4 h-4 cursor-pointer"
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span className="text-sm font-semibold text-text-primary">Identify speakers (diarization)</span>
          </label>

          {config.diarization.enabled && (
            <div className="mt-3.5 px-4 py-3.5 bg-input border border-border rounded-md">
              <div className="mb-3">
                <label htmlFor="hf-token" className="block text-xs text-text-muted mb-1.5">HuggingFace token</label>
                <input
                  id="hf-token"
                  type="password"
                  placeholder="hf_xxx…"
                  value={config.diarization.hfToken}
                  onChange={(e) => onHfTokenChange(e.target.value)}
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
              <p className={hintClass + ' mb-3'}>
                Required by pyannote. Get a token at{' '}
                <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-accent-light underline">
                  huggingface.co/settings/tokens
                </a>{' '}
                and accept the model terms at{' '}
                <a href="https://huggingface.co/pyannote/speaker-diarization-3.1" target="_blank" rel="noreferrer" className="text-accent-light underline">
                  pyannote/speaker-diarization-3.1
                </a>.
              </p>

              <div>
                <label htmlFor="num-speakers" className="block text-xs text-text-muted mb-1.5">
                  Number of speakers <span className="text-text-dim">(auto-detect if blank)</span>
                </label>
                <input
                  id="num-speakers"
                  type="number"
                  min={1}
                  max={20}
                  placeholder="auto"
                  value={config.diarization.numSpeakers ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : Math.max(1, parseInt(e.target.value, 10))
                    setDiarization({ numSpeakers: Number.isNaN(v as number) ? null : v })
                  }}
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2.5 mt-8 pt-5 border-t border-border">
          <button
            onClick={onCancel}
            className="bg-transparent border border-border text-text-muted text-[13px] font-medium px-5 py-2.5 rounded-md hover:border-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            className="bg-accent border border-accent text-white text-sm font-semibold px-5 py-2.5 rounded-md hover:bg-accent-light hover:border-accent-light transition-colors"
          >
            {isReTranscribing ? 'Re-transcribe' : 'Start transcription'}
          </button>
        </div>
      </div>
    </div>
  )
}
