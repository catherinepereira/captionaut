import { useState } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import styles from './SpeakerPanel.module.css'

export function SpeakerPanel() {
  const state = useCaptionStore((s) => s.state)
  const speakers = useCaptionStore((s) => s.speakers)
  const speakerColors = useCaptionStore((s) => s.speakerColors)
  const setSpeakerColor = useCaptionStore((s) => s.setSpeakerColor)
  const addSpeaker = useCaptionStore((s) => s.addSpeaker)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  // Hide the panel until we're actually editing a transcribed video.
  if (state !== 'editing' && state !== 'burning') return null

  const commitAdd = () => {
    if (draft.trim()) addSpeaker(draft)
    setDraft('')
    setAdding(false)
  }

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

        {adding ? (
          <div className={styles.row}>
            <input
              className={styles.addInput}
              value={draft}
              autoFocus
              placeholder="Name (e.g. Host, Guest)"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitAdd}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitAdd()
                if (e.key === 'Escape') { setDraft(''); setAdding(false) }
              }}
            />
          </div>
        ) : (
          <button
            className={styles.addBtn}
            onClick={() => setAdding(true)}
          >
            + Add speaker
          </button>
        )}
      </div>
    </div>
  )
}
