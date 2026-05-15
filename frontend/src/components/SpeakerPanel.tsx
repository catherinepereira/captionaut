import { useCaptionStore } from '../stores/captionStore'
import styles from './SpeakerPanel.module.css'

export function SpeakerPanel() {
  const speakers = useCaptionStore((s) => s.speakers)
  const speakerColors = useCaptionStore((s) => s.speakerColors)
  const setSpeakerColor = useCaptionStore((s) => s.setSpeakerColor)

  if (speakers.length === 0) return null

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Speakers</span>
        <span className={styles.count}>{speakers.length}</span>
      </div>
      <div className={styles.list}>
        {speakers.map((label) => (
          <div key={label} className={styles.row}>
            <label className={styles.swatchLabel} aria-label={`Color for ${label}`}>
              <input
                type="color"
                value={speakerColors[label] ?? '#7c5cfc'}
                onChange={(e) => setSpeakerColor(label, e.target.value)}
                className={styles.colorInput}
              />
              <span
                className={styles.swatch}
                style={{ background: speakerColors[label] ?? '#7c5cfc' }}
                aria-hidden="true"
              />
            </label>
            <span className={styles.name}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
