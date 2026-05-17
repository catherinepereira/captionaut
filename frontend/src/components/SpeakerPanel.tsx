import { useState } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import { StyleEditorPopover, type StyleValues } from './StyleEditorPopover'
import { PaletteIcon } from './icons'
import styles from './SpeakerPanel.module.css'

export function SpeakerPanel() {
  const state = useCaptionStore((s) => s.state)
  const speakers = useCaptionStore((s) => s.speakers)
  const speakerColors = useCaptionStore((s) => s.speakerColors)
  const speakerOutlineColors = useCaptionStore((s) => s.speakerOutlineColors)
  const speakerOutlineThickness = useCaptionStore((s) => s.speakerOutlineThickness)
  const speakerFontFamilies = useCaptionStore((s) => s.speakerFontFamilies)
  const speakerFontSizes = useCaptionStore((s) => s.speakerFontSizes)
  const captionStyle = useCaptionStore((s) => s.captionStyle)
  const setSpeakerColor = useCaptionStore((s) => s.setSpeakerColor)
  const setSpeakerOutlineColor = useCaptionStore((s) => s.setSpeakerOutlineColor)
  const setSpeakerOutlineThickness = useCaptionStore((s) => s.setSpeakerOutlineThickness)
  const setSpeakerFontFamily = useCaptionStore((s) => s.setSpeakerFontFamily)
  const setSpeakerFontSize = useCaptionStore((s) => s.setSpeakerFontSize)
  const addSpeaker = useCaptionStore((s) => s.addSpeaker)
  const renameSpeaker = useCaptionStore((s) => s.renameSpeaker)
  const [openSpeaker, setOpenSpeaker] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  // Hide the panel until we're actually editing a transcribed video.
  if (state !== 'editing' && state !== 'rendering') return null

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
        {speakers.map((label) => {
          const textColor = speakerColors[label] ?? captionStyle.color
          const outlineColor = speakerOutlineColors[label] ?? captionStyle.outlineColor
          const thickness = speakerOutlineThickness[label] ?? captionStyle.outlineThickness
          const fontFamily = speakerFontFamilies[label] ?? captionStyle.fontFamily
          const fontSize = speakerFontSizes[label] ?? captionStyle.fontSize
          const isOpen = openSpeaker === label

          return (
            <div key={label} className={styles.row}>
              <span className={styles.name} style={{ color: textColor }}>
                {label}
              </span>
              <div className={styles.rowSpacer} />
              <button
                type="button"
                className={styles.paletteBtn}
                aria-label={`Edit style for ${label}`}
                title="Edit style"
                onClick={() => setOpenSpeaker(isOpen ? null : label)}
              >
                <PaletteIcon />
              </button>
              {isOpen && (
                <StyleEditorPopover
                  variant="speaker"
                  label={label}
                  values={{
                    color: textColor,
                    outlineColor,
                    outlineThickness: thickness,
                    fontFamily,
                    fontSize,
                  }}
                  defaults={{
                    color: captionStyle.color,
                    outlineColor: captionStyle.outlineColor,
                    outlineThickness: captionStyle.outlineThickness,
                    fontFamily: captionStyle.fontFamily,
                    fontSize: captionStyle.fontSize,
                  }}
                  onChange={(patch: Partial<StyleValues>) => {
                    if (patch.color != null) setSpeakerColor(label, patch.color)
                    if (patch.outlineColor != null) setSpeakerOutlineColor(label, patch.outlineColor)
                    if (patch.outlineThickness != null) {
                      setSpeakerOutlineThickness(label, patch.outlineThickness)
                    }
                    if (patch.fontFamily != null) setSpeakerFontFamily(label, patch.fontFamily)
                    if (patch.fontSize != null) setSpeakerFontSize(label, patch.fontSize)
                  }}
                  onRename={(newLabel) => {
                    renameSpeaker(label, newLabel)
                    setOpenSpeaker(newLabel)
                  }}
                  onClose={() => setOpenSpeaker(null)}
                />
              )}
            </div>
          )
        })}

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

