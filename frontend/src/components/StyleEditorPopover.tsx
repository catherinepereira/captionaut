import { useEffect, useRef } from 'react'
import { FONT_OPTIONS } from '../utils/fonts'

type Align = 'left' | 'center' | 'right'

export interface StyleValues {
  color: string | null
  outlineColor: string | null
  outlineThickness: number | null
  fontFamily: string | null
  fontSize: number | null
  posX: number | null
  posY: number | null
  align: Align | null
}

export interface StyleDefaults {
  color: string
  outlineColor: string
  outlineThickness: number
  fontFamily: string
  fontSize: number
  posX: number
  posY: number
  align: Align
}

const ALIGN_OPTIONS: Align[] = ['left', 'center', 'right']

interface BaseProps {
  values: StyleValues
  defaults: StyleDefaults
  onChange: (patch: Partial<StyleValues>) => void
  onClose: () => void
  onClear?: () => void
}

interface SpeakerProps extends BaseProps {
  variant: 'speaker'
  label: string
  onRename: (newLabel: string) => void
}

interface CaptionProps extends BaseProps {
  variant: 'caption'
}

type Props = SpeakerProps | CaptionProps

const row = 'grid grid-cols-[78px_1fr] items-center gap-2.5'
const lbl = 'text-[11px] uppercase tracking-[0.04em] text-text-muted'
const baseInput = 'bg-bg border border-border rounded-sm px-2 py-1 text-xs text-text-primary outline-none focus-visible:border-accent-light'
const rangeWrap = 'flex items-center gap-2 w-full'
const rangeVal = 'text-[11px] font-mono text-text-muted min-w-9 text-right'

export function StyleEditorPopover(props: Props) {
  const { values, defaults, onChange, onClose, onClear } = props
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const color = values.color ?? defaults.color
  const outline = values.outlineColor ?? defaults.outlineColor
  const family = values.fontFamily ?? defaults.fontFamily

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={props.variant === 'speaker' ? 'Speaker style' : 'Caption style'}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-[calc(100%+6px)] right-0 bg-card border border-border rounded-md p-3 z-50 shadow-[0_8px_24px_rgba(0,0,0,0.4)] flex flex-col gap-2 min-w-[240px]"
    >
      {props.variant === 'speaker' && (
        <label className={row}>
          <span className={lbl}>Name</span>
          <input
            type="text"
            defaultValue={props.label}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== props.label) props.onRename(v)
            }}
            className={baseInput}
          />
        </label>
      )}

      <label className={row}>
        <span className={lbl}>Font</span>
        <select
          value={values.fontFamily ?? ''}
          style={{ fontFamily: family }}
          onChange={(e) => {
            const v = e.target.value
            onChange({ fontFamily: v === '' ? null : v })
          }}
          className={baseInput + ' cursor-pointer min-w-0'}
        >
          <option value="">Default ({defaults.fontFamily})</option>
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>
      </label>

      <label className={row}>
        <span className={lbl}>Size</span>
        <input
          type="number"
          min={12} max={200} step={2}
          value={values.fontSize ?? ''}
          placeholder={String(defaults.fontSize)}
          onChange={(e) => {
            const v = e.target.value
            onChange({ fontSize: v === '' ? null : parseInt(v, 10) })
          }}
          className={baseInput + ' w-20'}
        />
      </label>

      <label className={row}>
        <span className={lbl}>Text color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </label>

      <label className={row}>
        <span className={lbl}>Outline</span>
        <input
          type="color"
          value={outline}
          onChange={(e) => onChange({ outlineColor: e.target.value })}
        />
      </label>

      <label className={row}>
        <span className={lbl}>Thickness</span>
        <div className={rangeWrap}>
          <input
            type="range" min={0} max={10} step={0.5}
            value={values.outlineThickness ?? defaults.outlineThickness}
            onChange={(e) => onChange({ outlineThickness: parseFloat(e.target.value) })}
            className="flex-1 accent-accent"
          />
          <span className={rangeVal}>
            {(values.outlineThickness ?? defaults.outlineThickness).toFixed(1)}
          </span>
        </div>
      </label>

      <label className={row}>
        <span className={lbl}>Horizontal</span>
        <div className={rangeWrap}>
          <input
            type="range" min={0} max={100} step={1}
            value={values.posX ?? defaults.posX}
            onChange={(e) => onChange({ posX: parseInt(e.target.value, 10) })}
            className="flex-1 accent-accent"
          />
          <span className={rangeVal}>{Math.round(values.posX ?? defaults.posX)}%</span>
        </div>
      </label>

      <label className={row}>
        <span className={lbl}>Vertical</span>
        <div className={rangeWrap}>
          <input
            type="range" min={0} max={100} step={1}
            value={values.posY ?? defaults.posY}
            onChange={(e) => onChange({ posY: parseInt(e.target.value, 10) })}
            className="flex-1 accent-accent"
          />
          <span className={rangeVal}>{Math.round(values.posY ?? defaults.posY)}%</span>
        </div>
      </label>

      <label className={row}>
        <span className={lbl}>Align</span>
        <select
          value={values.align ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange({ align: v === '' ? null : (v as Align) })
          }}
          className={baseInput + ' cursor-pointer min-w-0'}
        >
          <option value="">Default ({defaults.align})</option>
          {ALIGN_OPTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </label>

      {onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={
            values.color === null &&
            values.outlineColor === null &&
            values.outlineThickness === null &&
            values.fontFamily === null &&
            values.fontSize === null &&
            values.posX === null &&
            values.posY === null &&
            values.align === null
          }
          className="mt-1 bg-transparent border border-border text-text-muted text-[11px] px-2.5 py-1.5 rounded-sm cursor-pointer hover:enabled:border-red hover:enabled:text-red disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear overrides
        </button>
      )}
    </div>
  )
}
