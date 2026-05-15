import { useState } from 'react'
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
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Settings</h3>
          <button className={styles.close} onClick={onClose}>×</button>
        </div>

        <section className={styles.section}>
          <label className={styles.label}>Default model</label>
          <select
            value={draft.defaultModelSize}
            onChange={(e) => setDraft({ ...draft, defaultModelSize: e.target.value as ModelSize })}
            className={styles.select}
          >
            {MODEL_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </section>

        <section className={styles.section}>
          <label className={styles.label}>HuggingFace token</label>
          <input
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
          <label className={styles.label}>Default burn-in style</label>
          <div className={styles.styleGrid}>
            <span className={styles.subLabel}>Font</span>
            <input
              value={draft.defaultBurnStyle.fontFamily}
              onChange={(e) => patchBurn({ fontFamily: e.target.value })}
              className={styles.input}
            />
            <span className={styles.subLabel}>Size</span>
            <input
              type="number"
              min={12} max={200}
              value={draft.defaultBurnStyle.fontSize}
              onChange={(e) => patchBurn({ fontSize: Number(e.target.value) })}
              className={styles.input}
            />
            <span className={styles.subLabel}>Text</span>
            <input
              type="color"
              value={draft.defaultBurnStyle.color}
              onChange={(e) => patchBurn({ color: e.target.value })}
              className={styles.color}
            />
            <span className={styles.subLabel}>Outline</span>
            <input
              type="color"
              value={draft.defaultBurnStyle.outlineColor}
              onChange={(e) => patchBurn({ outlineColor: e.target.value })}
              className={styles.color}
            />
            <span className={styles.subLabel}>Position</span>
            <div className={styles.posGroup}>
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
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
