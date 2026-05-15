import { useEffect, useId, useState } from 'react'
import { loadSettings, saveSettings, type UserSettings } from '../utils/settings'
import { useCaptionStore, type ModelSize, type BurnStyle } from '../stores/captionStore'
import styles from './SettingsPanel.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

const MODEL_SIZES: ModelSize[] = ['tiny', 'base', 'small', 'medium', 'large']
const POSITIONS: BurnStyle['position'][] = ['top', 'middle', 'bottom']

export function SettingsPanel({ open, onClose }: Props) {
  const [draft, setDraft] = useState<UserSettings>(() => loadSettings())
  const setBurnStyle = useCaptionStore((s) => s.setBurnStyle)
  const titleId = useId()
  const modelId = useId()
  const tokenId = useId()
  const fontId = useId()
  const sizeId = useId()
  const colorId = useId()
  const outlineId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const save = () => {
    saveSettings(draft)
    // Apply the new default burn style to any active session immediately.
    setBurnStyle(draft.defaultBurnStyle)
    onClose()
  }

  const patchBurn = (patch: Partial<BurnStyle>) => {
    setDraft({ ...draft, defaultBurnStyle: { ...draft.defaultBurnStyle, ...patch } })
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 id={titleId} className={styles.title}>Settings</h3>
          <button className={styles.close} onClick={onClose} aria-label="Close settings">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <section className={styles.section}>
          <label htmlFor={modelId} className={styles.label}>Default model</label>
          <select
            id={modelId}
            value={draft.defaultModelSize}
            onChange={(e) => setDraft({ ...draft, defaultModelSize: e.target.value as ModelSize })}
            className={styles.select}
          >
            {MODEL_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </section>

        <section className={styles.section}>
          <label htmlFor={tokenId} className={styles.label}>HuggingFace token</label>
          <input
            id={tokenId}
            type="password"
            placeholder="hf_xxx…"
            value={draft.hfToken}
            onChange={(e) => setDraft({ ...draft, hfToken: e.target.value })}
            className={styles.input}
            autoComplete="off"
          />
          <p className={styles.hint}>Used for pyannote diarization. Stays on your machine.</p>
        </section>

        <section className={styles.section}>
          <span className={styles.label}>Default burn-in style</span>
          <div className={styles.styleGrid}>
            <label htmlFor={fontId} className={styles.subLabel}>Font</label>
            <input
              id={fontId}
              value={draft.defaultBurnStyle.fontFamily}
              onChange={(e) => patchBurn({ fontFamily: e.target.value })}
              className={styles.input}
            />
            <label htmlFor={sizeId} className={styles.subLabel}>Size</label>
            <input
              id={sizeId}
              type="number"
              min={12} max={200}
              value={draft.defaultBurnStyle.fontSize}
              onChange={(e) => patchBurn({ fontSize: Number(e.target.value) })}
              className={styles.input}
            />
            <label htmlFor={colorId} className={styles.subLabel}>Text</label>
            <input
              id={colorId}
              type="color"
              value={draft.defaultBurnStyle.color}
              onChange={(e) => patchBurn({ color: e.target.value })}
              className={styles.color}
              aria-label="Text color"
            />
            <label htmlFor={outlineId} className={styles.subLabel}>Outline</label>
            <input
              id={outlineId}
              type="color"
              value={draft.defaultBurnStyle.outlineColor}
              onChange={(e) => patchBurn({ outlineColor: e.target.value })}
              className={styles.color}
              aria-label="Outline color"
            />
            <span className={styles.subLabel} id={`${titleId}-pos`}>Position</span>
            <div
              className={styles.posGroup}
              role="radiogroup"
              aria-labelledby={`${titleId}-pos`}
            >
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={draft.defaultBurnStyle.position === p}
                  className={`${styles.posBtn} ${draft.defaultBurnStyle.position === p ? styles.posActive : ''}`}
                  onClick={() => patchBurn({ position: p })}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
