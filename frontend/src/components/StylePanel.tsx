import { useCaptionStore } from '../stores/captionStore'
import styles from './StylePanel.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

const FONT_OPTIONS = [
  'Arial',
  'Helvetica',
  'Verdana',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Impact',
]

const POSITION_OPTIONS: { value: 'top' | 'middle' | 'bottom'; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
]

export function StylePanel({ open, onClose }: Props) {
  const { burnStyle, setBurnStyle } = useCaptionStore()
  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Caption style</h3>
          <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
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
            {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
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
          <label className={styles.label}>Position</label>
          <div className={styles.positionGroup}>
            {POSITION_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                className={`${styles.posBtn} ${burnStyle.position === value ? styles.posBtnActive : ''}`}
                onClick={() => setBurnStyle({ position: value })}
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
