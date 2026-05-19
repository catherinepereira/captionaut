import { useEffect, useId } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import { FONT_OPTIONS } from '../utils/fonts'

function buildOutlineShadow(color: string, thickness: number): string | undefined {
  if (thickness <= 0) return undefined
  const radius = Math.max(0.5, thickness * 0.5)
  const steps = Math.max(8, Math.round(radius * 4))
  const parts: string[] = []
  for (let i = 0; i < steps; i++) {
    const angle = (i * Math.PI * 2) / steps
    const x = (Math.cos(angle) * radius).toFixed(2)
    const y = (Math.sin(angle) * radius).toFixed(2)
    parts.push(`${x}px ${y}px 0 ${color}`)
  }
  return parts.join(', ')
}

interface Props {
  open: boolean
  onClose: () => void
}

const ALIGN_OPTIONS: { value: 'left' | 'center' | 'right'; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

const rowClass = 'flex items-center gap-3 mb-3'
const labelClass = 'text-xs text-text-muted w-20 shrink-0 font-medium'
const valueClass = 'text-xs font-mono text-text-muted min-w-[60px]'
const selectClass = 'flex-1 bg-input border border-border text-text-primary text-[13px] px-2.5 py-1.5 rounded-md outline-none focus:border-accent'
const rangeClass = 'flex-1 accent-accent'
const colorClass = 'w-9 h-7 border border-border rounded-md bg-transparent cursor-pointer p-0'

export function StylePanel({ open, onClose }: Props) {
  const { captionStyle, setCaptionStyle } = useCaptionStore()
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

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
        className="bg-card border border-border rounded-lg p-6 w-full max-w-[440px] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id={titleId} className="text-base font-bold text-text-primary">Caption style</h3>
          <button
            onClick={onClose}
            aria-label="Close caption style panel"
            className="bg-transparent border-0 text-text-muted text-2xl leading-none cursor-pointer px-1.5 hover:text-text-primary"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div
          className="border border-border rounded-md px-4 py-7 mb-5 text-center min-h-[88px] flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #232730 0%, #15171c 100%)' }}
        >
          <div
            className="font-bold"
            style={{
              fontFamily: captionStyle.fontFamily,
              fontSize: Math.min(captionStyle.fontSize * 0.5, 32),
              color: captionStyle.color,
              textShadow: buildOutlineShadow(captionStyle.outlineColor, captionStyle.outlineThickness),
            }}
          >
            Sample caption text
          </div>
        </div>

        <div className={rowClass}>
          <label className={labelClass}>Font</label>
          <select
            className={selectClass}
            value={captionStyle.fontFamily}
            onChange={(e) => setCaptionStyle({ fontFamily: e.target.value })}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
            ))}
          </select>
        </div>

        <div className={rowClass}>
          <label className={labelClass}>Size</label>
          <input
            type="range" min={24} max={96} step={2}
            value={captionStyle.fontSize}
            onChange={(e) => setCaptionStyle({ fontSize: Number(e.target.value) })}
            className={rangeClass}
          />
          <span className={valueClass}>{captionStyle.fontSize}px</span>
        </div>

        <div className={rowClass}>
          <label className={labelClass}>Text color</label>
          <input
            type="color"
            value={captionStyle.color}
            onChange={(e) => setCaptionStyle({ color: e.target.value })}
            className={colorClass}
          />
          <span className={valueClass}>{captionStyle.color.toUpperCase()}</span>
        </div>

        <div className={rowClass}>
          <label className={labelClass}>Outline</label>
          <input
            type="color"
            value={captionStyle.outlineColor}
            onChange={(e) => setCaptionStyle({ outlineColor: e.target.value })}
            className={colorClass}
          />
          <span className={valueClass}>{captionStyle.outlineColor.toUpperCase()}</span>
        </div>

        <div className={rowClass}>
          <label className={labelClass}>Thickness</label>
          <input
            type="range" min={0} max={10} step={0.5}
            value={captionStyle.outlineThickness}
            onChange={(e) => setCaptionStyle({ outlineThickness: parseFloat(e.target.value) })}
            className={rangeClass}
          />
          <span className={valueClass}>{captionStyle.outlineThickness.toFixed(1)}</span>
        </div>

        <div className={rowClass}>
          <label className={labelClass}>Horizontal</label>
          <input
            type="range" min={0} max={100} step={1}
            value={captionStyle.posX}
            onChange={(e) => setCaptionStyle({ posX: Number(e.target.value) })}
            className={rangeClass}
          />
          <span className={valueClass}>{Math.round(captionStyle.posX)}%</span>
        </div>

        <div className={rowClass}>
          <label className={labelClass}>Vertical</label>
          <input
            type="range" min={0} max={100} step={1}
            value={captionStyle.posY}
            onChange={(e) => setCaptionStyle({ posY: Number(e.target.value) })}
            className={rangeClass}
          />
          <span className={valueClass}>{Math.round(captionStyle.posY)}%</span>
        </div>

        <div className={rowClass}>
          <span id={`${titleId}-align`} className={labelClass}>Align</span>
          <div className="flex gap-1.5 flex-1" role="radiogroup" aria-labelledby={`${titleId}-align`}>
            {ALIGN_OPTIONS.map(({ value, label }) => {
              const active = captionStyle.align === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`flex-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors border ${
                    active
                      ? 'bg-accent border-accent text-white hover:bg-accent-light hover:border-accent-light'
                      : 'bg-input border-border text-text-muted hover:border-accent-light hover:text-text-primary'
                  }`}
                  onClick={() => setCaptionStyle({ align: value })}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
