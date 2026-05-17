import { useEffect, useId, useState } from 'react'
import { loadSettings, saveSettings, type UserSettings } from '../utils/settings'
import { useCaptionStore, type ModelSize, type CaptionStyle, type HorizontalAlign } from '../stores/captionStore'
import { FONT_OPTIONS } from '../utils/fonts'
import styles from './SettingsPanel.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

const MODEL_SIZES: ModelSize[] = ['tiny', 'base', 'small', 'medium', 'large']
const ALIGN_VALUES: HorizontalAlign[] = ['left', 'center', 'right']

export function SettingsPanel({ open, onClose }: Props) {
  const [draft, setDraft] = useState<UserSettings>(() => loadSettings())
  const setCaptionStyle = useCaptionStore((s) => s.setCaptionStyle)
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
    // Apply the new default caption style to any active session immediately.
    setCaptionStyle(draft.defaultCaptionStyle)
    onClose()
  }

  const patchStyle = (patch: Partial<CaptionStyle>) => {
    setDraft({ ...draft, defaultCaptionStyle: { ...draft.defaultCaptionStyle, ...patch } })
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
          <p className={styles.hint}>Used for pyannote speaker identification.</p>
        </section>

        <section className={styles.section}>
          <span className={styles.label}>Default caption style</span>
          <div className={styles.styleGrid}>
            <label htmlFor={fontId} className={styles.subLabel}>Font</label>
            <select
              id={fontId}
              value={draft.defaultCaptionStyle.fontFamily}
              onChange={(e) => patchStyle({ fontFamily: e.target.value })}
              className={styles.input}
              style={{ fontFamily: draft.defaultCaptionStyle.fontFamily }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>
            <label htmlFor={sizeId} className={styles.subLabel}>Size</label>
            <input
              id={sizeId}
              type="number"
              min={12} max={200}
              value={draft.defaultCaptionStyle.fontSize}
              onChange={(e) => patchStyle({ fontSize: Number(e.target.value) })}
              className={styles.input}
            />
            <label htmlFor={colorId} className={styles.subLabel}>Text</label>
            <input
              id={colorId}
              type="color"
              value={draft.defaultCaptionStyle.color}
              onChange={(e) => patchStyle({ color: e.target.value })}
              className={styles.color}
              aria-label="Text color"
            />
            <label htmlFor={outlineId} className={styles.subLabel}>Outline</label>
            <input
              id={outlineId}
              type="color"
              value={draft.defaultCaptionStyle.outlineColor}
              onChange={(e) => patchStyle({ outlineColor: e.target.value })}
              className={styles.color}
              aria-label="Outline color"
            />
            <span className={styles.subLabel}>Thickness</span>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={draft.defaultCaptionStyle.outlineThickness}
              onChange={(e) => patchStyle({ outlineThickness: parseFloat(e.target.value) })}
              aria-label="Outline thickness"
            />
            <span className={styles.subLabel}>X (%)</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={draft.defaultCaptionStyle.posX}
              onChange={(e) => patchStyle({ posX: Number(e.target.value) })}
              aria-label="Horizontal position percent"
            />
            <span className={styles.subLabel}>Y (%)</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={draft.defaultCaptionStyle.posY}
              onChange={(e) => patchStyle({ posY: Number(e.target.value) })}
              aria-label="Vertical position percent"
            />
            <span className={styles.subLabel} id={`${titleId}-align`}>Align</span>
            <div
              className={styles.posGroup}
              role="radiogroup"
              aria-labelledby={`${titleId}-align`}
            >
              {ALIGN_VALUES.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={draft.defaultCaptionStyle.align === a}
                  className={`${styles.posBtn} ${draft.defaultCaptionStyle.align === a ? styles.posActive : ''}`}
                  onClick={() => patchStyle({ align: a })}
                >
                  {a}
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
