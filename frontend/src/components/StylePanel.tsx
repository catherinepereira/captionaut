import { useEffect, useId } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import { FONT_OPTIONS } from '../utils/fonts'
import styles from './StylePanel.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

const ALIGN_OPTIONS: { value: 'left' | 'center' | 'right'; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

export function StylePanel({ open, onClose }: Props) {
  const { burnStyle, setBurnStyle } = useCaptionStore()
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
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h3 id={titleId} className={styles.title}>Caption style</h3>
          <button className={styles.close} onClick={onClose} aria-label="Close caption style panel">
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className={styles.preview}>
          <div
            className={styles.previewText}
            style={{
              fontFamily: burnStyle.fontFamily,
              fontSize: Math.min(burnStyle.fontSize * 0.5, 32),
              color: burnStyle.color,
              textShadow: `0 0 2px ${burnStyle.outlineColor}, 0 0 4px ${burnStyle.outlineColor}`,
            }}
          >
            Sample caption text
          </div>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Font</label>
          <select
            className={styles.select}
            value={burnStyle.fontFamily}
            onChange={(e) => setBurnStyle({ fontFamily: e.target.value })}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
            ))}
          </select>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Size</label>
          <input
            className={styles.range}
            type="range"
            min={24}
            max={96}
            step={2}
            value={burnStyle.fontSize}
            onChange={(e) => setBurnStyle({ fontSize: Number(e.target.value) })}
          />
          <span className={styles.value}>{burnStyle.fontSize}px</span>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Text color</label>
          <input
            type="color"
            className={styles.color}
            value={burnStyle.color}
            onChange={(e) => setBurnStyle({ color: e.target.value })}
          />
          <span className={styles.value}>{burnStyle.color.toUpperCase()}</span>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Outline</label>
          <input
            type="color"
            className={styles.color}
            value={burnStyle.outlineColor}
            onChange={(e) => setBurnStyle({ outlineColor: e.target.value })}
          />
          <span className={styles.value}>{burnStyle.outlineColor.toUpperCase()}</span>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Thickness</label>
          <input
            className={styles.range}
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={burnStyle.outlineThickness}
            onChange={(e) => setBurnStyle({ outlineThickness: parseFloat(e.target.value) })}
          />
          <span className={styles.value}>{burnStyle.outlineThickness.toFixed(1)}</span>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Horizontal</label>
          <input
            className={styles.range}
            type="range"
            min={0}
            max={100}
            step={1}
            value={burnStyle.posX}
            onChange={(e) => setBurnStyle({ posX: Number(e.target.value) })}
          />
          <span className={styles.value}>{Math.round(burnStyle.posX)}%</span>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Vertical</label>
          <input
            className={styles.range}
            type="range"
            min={0}
            max={100}
            step={1}
            value={burnStyle.posY}
            onChange={(e) => setBurnStyle({ posY: Number(e.target.value) })}
          />
          <span className={styles.value}>{Math.round(burnStyle.posY)}%</span>
        </div>

        <div className={styles.row}>
          <span id={`${titleId}-align`} className={styles.label}>Align</span>
          <div
            className={styles.positionGroup}
            role="radiogroup"
            aria-labelledby={`${titleId}-align`}
          >
            {ALIGN_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={burnStyle.align === value}
                className={`${styles.posBtn} ${burnStyle.align === value ? styles.posBtnActive : ''}`}
                onClick={() => setBurnStyle({ align: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
