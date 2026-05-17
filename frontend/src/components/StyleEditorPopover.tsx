import { useEffect, useRef } from 'react'
import { FONT_OPTIONS } from '../utils/fonts'
import styles from './StyleEditorPopover.module.css'

export interface StyleValues {
  color: string | null
  outlineColor: string | null
  outlineThickness: number | null
  fontFamily: string | null
  fontSize: number | null
}

export interface StyleDefaults {
  color: string
  outlineColor: string
  outlineThickness: number
  fontFamily: string
  fontSize: number
}

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
      className={styles.popover}
      role="dialog"
      aria-label={props.variant === 'speaker' ? 'Speaker style' : 'Caption style'}
      onClick={(e) => e.stopPropagation()}
    >
      {props.variant === 'speaker' && (
        <label className={styles.row}>
          <span className={styles.label}>Name</span>
          <input
            type="text"
            className={styles.text}
            defaultValue={props.label}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== props.label) props.onRename(v)
            }}
          />
        </label>
      )}

      <label className={styles.row}>
        <span className={styles.label}>Text color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </label>

      <label className={styles.row}>
        <span className={styles.label}>Outline</span>
        <input
          type="color"
          value={outline}
          onChange={(e) => onChange({ outlineColor: e.target.value })}
        />
      </label>

      <label className={styles.row}>
        <span className={styles.label}>Font</span>
        <select
          className={styles.select}
          value={values.fontFamily ?? ''}
          style={{ fontFamily: family }}
          onChange={(e) => {
            const v = e.target.value
            onChange({ fontFamily: v === '' ? null : v })
          }}
        >
          <option value="">Default ({defaults.fontFamily})</option>
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>
      </label>

      <label className={styles.row}>
        <span className={styles.label}>Size</span>
        <input
          type="number"
          className={styles.size}
          min={12}
          max={200}
          step={2}
          value={values.fontSize ?? ''}
          placeholder={String(defaults.fontSize)}
          onChange={(e) => {
            const v = e.target.value
            onChange({ fontSize: v === '' ? null : parseInt(v, 10) })
          }}
        />
      </label>

      <label className={styles.row}>
        <span className={styles.label}>Thickness</span>
        <div className={styles.rangeWrap}>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={values.outlineThickness ?? defaults.outlineThickness}
            onChange={(e) => onChange({ outlineThickness: parseFloat(e.target.value) })}
          />
          <span className={styles.rangeValue}>
            {(values.outlineThickness ?? defaults.outlineThickness).toFixed(1)}
          </span>
        </div>
      </label>

      {onClear && (
        <button
          type="button"
          className={styles.clear}
          onClick={onClear}
          disabled={
            values.color === null &&
            values.outlineColor === null &&
            values.outlineThickness === null &&
            values.fontFamily === null &&
            values.fontSize === null
          }
        >
          Clear overrides
        </button>
      )}
    </div>
  )
}
