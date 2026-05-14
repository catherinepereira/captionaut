import { useEffect, useRef } from 'react'
import { useCaptionStore, type ModelSize } from '../stores/captionStore'
import styles from './ConfigScreen.module.css'

const HF_TOKEN_STORAGE_KEY = 'captionaut.hfToken'

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

export function ConfigScreen({ onStart, onCancel }: Props) {
  const videoFile = useCaptionStore((s) => s.videoFile)
  const config = useCaptionStore((s) => s.transcribeConfig)
  const setConfig = useCaptionStore((s) => s.setTranscribeConfig)
  const setDiarization = useCaptionStore((s) => s.setDiarizationConfig)
  const scriptInputRef = useRef<HTMLInputElement>(null)

  const onHfTokenChange = (token: string) => {
    setDiarization({ hfToken: token })
    if (token) localStorage.setItem(HF_TOKEN_STORAGE_KEY, token)
    else localStorage.removeItem(HF_TOKEN_STORAGE_KEY)
  }

  useEffect(() => {
    if (config.diarization.hfToken) return
    const saved = localStorage.getItem(HF_TOKEN_STORAGE_KEY)
    if (saved) setDiarization({ hfToken: saved })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h2 className={styles.title}>Configure transcription</h2>
        {videoFile && <p className={styles.filename}>{videoFile.name}</p>}

        <section className={styles.section}>
          <label className={styles.label}>Model</label>
          <div className={styles.modelGrid}>
            {MODEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.modelOption} ${config.modelSize === opt.value ? styles.modelOptionActive : ''}`}
                onClick={() => setConfig({ modelSize: opt.value })}
              >
                <span className={styles.modelName}>{opt.label}</span>
                <span className={styles.modelMeta}>{opt.size} · {opt.speed}</span>
              </button>
            ))}
          </div>
          <p className={styles.hint}>
            Larger models are more accurate but slower. The first run with a new model will download it.
          </p>
        </section>

        <section className={styles.section}>
          <label htmlFor="prompt" className={styles.label}>
            Prompt <span className={styles.optional}>(optional)</span>
          </label>
          <textarea
            id="prompt"
            className={styles.textarea}
            rows={3}
            placeholder="Names, jargon, or context that helps Whisper get spelling right. e.g. &quot;Discussion of Captionaut, FFmpeg, and pyannote.&quot;"
            value={config.initialPrompt}
            onChange={(e) => setConfig({ initialPrompt: e.target.value })}
          />
        </section>

        <section className={styles.section}>
          <label className={styles.label}>
            Script <span className={styles.optional}>(optional)</span>
          </label>
          <input
            ref={scriptInputRef}
            type="file"
            accept=".txt,.srt"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setConfig({ scriptFile: f })
            }}
          />
          {config.scriptFile ? (
            <div className={styles.scriptPicked}>
              <span className={styles.scriptName}>{config.scriptFile.name}</span>
              <button
                className={styles.scriptRemove}
                onClick={() => setConfig({ scriptFile: null })}
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              className={styles.scriptPick}
              onClick={() => scriptInputRef.current?.click()}
            >
              Choose a .txt or .srt file
            </button>
          )}
          <p className={styles.hint}>
            If provided, captions will be aligned against the script and mismatches highlighted.
          </p>
        </section>

        <section className={styles.section}>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={config.denoise}
              onChange={(e) => setConfig({ denoise: e.target.checked })}
            />
            <span className={styles.toggleLabel}>Denoise audio (Demucs vocal isolation)</span>
          </label>
          <p className={styles.hint}>
            Recommended only for noisy videos — isolates vocals before transcription.
            Significantly slower; downloads a ~250 MB model on first use.
          </p>
        </section>

        <section className={styles.section}>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={config.diarization.enabled}
              onChange={(e) => setDiarization({ enabled: e.target.checked })}
            />
            <span className={styles.toggleLabel}>Identify speakers (diarization)</span>
          </label>

          {config.diarization.enabled && (
            <div className={styles.subOptions}>
              <div className={styles.subRow}>
                <label htmlFor="hf-token" className={styles.subLabel}>HuggingFace token</label>
                <input
                  id="hf-token"
                  type="password"
                  className={styles.textInput}
                  placeholder="hf_xxx…"
                  value={config.diarization.hfToken}
                  onChange={(e) => onHfTokenChange(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <p className={styles.hint}>
                Required by pyannote. Get a token at{' '}
                <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className={styles.link}>
                  huggingface.co/settings/tokens
                </a>{' '}
                and accept the model terms at{' '}
                <a href="https://huggingface.co/pyannote/speaker-diarization-3.1" target="_blank" rel="noreferrer" className={styles.link}>
                  pyannote/speaker-diarization-3.1
                </a>.
              </p>

              <div className={styles.subRow}>
                <label htmlFor="num-speakers" className={styles.subLabel}>
                  Number of speakers <span className={styles.optional}>(auto-detect if blank)</span>
                </label>
                <input
                  id="num-speakers"
                  type="number"
                  min={1}
                  max={20}
                  className={styles.textInput}
                  placeholder="auto"
                  value={config.diarization.numSpeakers ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : Math.max(1, parseInt(e.target.value, 10))
                    setDiarization({ numSpeakers: Number.isNaN(v as number) ? null : v })
                  }}
                />
              </div>
            </div>
          )}
        </section>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.startBtn} onClick={onStart}>Start transcription</button>
        </div>
      </div>
    </div>
  )
}
