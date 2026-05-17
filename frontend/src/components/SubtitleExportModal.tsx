import { useEffect, useId, useState } from 'react'

export type SubtitleFormat = 'srt' | 'vtt'

interface Props {
  open: boolean
  busy?: boolean
  onClose: () => void
  onConfirm: (format: SubtitleFormat) => void
}

interface FormatOption {
  value: SubtitleFormat
  name: string
  meta: string
}

const FORMAT_OPTIONS: FormatOption[] = [
  { value: 'srt', name: 'SRT', meta: 'SubRip · supported by virtually every player and platform' },
  { value: 'vtt', name: 'VTT', meta: 'WebVTT · native to HTML5 <track>, YouTube, web players' },
]

export function SubtitleExportModal({ open, busy = false, onClose, onConfirm }: Props) {
  const [format, setFormat] = useState<SubtitleFormat>('srt')
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-[2px]"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-lg p-6 w-full max-w-[420px] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id={titleId} className="text-base font-bold text-text-primary">Export subtitles</h3>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close subtitle export dialog"
            className="bg-transparent border-0 text-text-muted text-2xl leading-none cursor-pointer px-1.5 hover:text-text-primary disabled:opacity-50"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <span className="block text-xs font-semibold tracking-[0.08em] uppercase text-text-dim mb-2.5">Subtitle format</span>
        <div className="flex flex-col gap-2 mb-5" role="radiogroup" aria-label="Subtitle format">
          {FORMAT_OPTIONS.map((opt) => {
            const active = format === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFormat(opt.value)}
                disabled={busy}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-md border text-left transition-colors ${
                  active
                    ? 'bg-accent/10 border-accent text-text-primary'
                    : 'bg-input border-border text-text-primary hover:border-accent-light'
                } disabled:opacity-60`}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-semibold">{opt.name}</span>
                  <span className="text-xs text-text-muted">{opt.meta}</span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="bg-transparent border border-border text-text-primary text-[13px] px-4 py-2 rounded-md hover:enabled:border-accent-light hover:enabled:text-accent-light disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(format)}
            disabled={busy}
            className="bg-accent border border-accent text-white text-[13px] font-semibold px-4.5 py-2 rounded-md hover:enabled:bg-accent-light hover:enabled:border-accent-light disabled:opacity-60"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
