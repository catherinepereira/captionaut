import { useEffect, useId, useState } from 'react'
import { loadSettings, saveSettings, type UserSettings } from '../utils/settings'
import { type ModelSize } from '../stores/captionStore'

interface Props {
  open: boolean
  onClose: () => void
}

const MODEL_SIZES: ModelSize[] = ['tiny', 'base', 'small', 'medium', 'large']

export function SettingsPanel({ open, onClose }: Props) {
  const [draft, setDraft] = useState<UserSettings>(() => loadSettings())
  const titleId = useId()
  const modelId = useId()
  const tokenId = useId()

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
    onClose()
  }

  const labelClass = 'block text-xs font-semibold tracking-[0.06em] uppercase text-accent-light mb-2'
  const inputClass = 'w-full bg-input border border-border text-text-primary text-[13px] px-2.5 py-2 rounded-md outline-none focus:border-accent'

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-lg p-6 w-full max-w-[480px] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id={titleId} className="text-base font-bold text-text-primary">Settings</h3>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="bg-transparent border-0 text-text-muted text-2xl leading-none cursor-pointer px-1.5 hover:text-text-primary"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <section className="mb-5">
          <label htmlFor={modelId} className={labelClass}>Default model</label>
          <select
            id={modelId}
            value={draft.defaultModelSize}
            onChange={(e) => setDraft({ ...draft, defaultModelSize: e.target.value as ModelSize })}
            className={inputClass + ' cursor-pointer'}
          >
            {MODEL_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </section>

        <section className="mb-5">
          <label htmlFor={tokenId} className={labelClass}>HuggingFace token</label>
          <input
            id={tokenId}
            type="password"
            placeholder="hf_xxx…"
            value={draft.hfToken}
            onChange={(e) => setDraft({ ...draft, hfToken: e.target.value })}
            autoComplete="off"
            className={inputClass}
          />
          <p className="mt-2 text-xs text-text-dim">Used for pyannote speaker identification.</p>
        </section>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="bg-transparent border border-border text-text-muted text-[13px] font-medium px-5 py-2 rounded-md hover:border-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="bg-accent border border-accent text-white text-sm font-semibold px-5 py-2 rounded-md hover:bg-accent-light hover:border-accent-light transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
