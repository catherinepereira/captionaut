import { useMemo, useState } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import { StyleEditorPopover, type StyleValues } from './StyleEditorPopover'
import { DeleteSpeakerModal } from './DeleteSpeakerModal'
import { PaletteIcon, TrashIcon } from './icons'

const iconBtn =
  'inline-flex items-center justify-center w-[26px] h-[26px] bg-transparent border border-border text-text-muted rounded-md cursor-pointer p-0 hover:border-accent-light hover:text-accent-light focus-visible:border-accent-light focus-visible:text-accent-light'

const deleteIconBtn =
  'inline-flex items-center justify-center w-[26px] h-[26px] bg-transparent border border-border text-text-muted rounded-md cursor-pointer p-0 text-base leading-none hover:border-red hover:text-red hover:bg-red/10 focus-visible:border-red focus-visible:text-red focus-visible:bg-red/10'

export function SpeakerPanel() {
  const state = useCaptionStore((s) => s.state)
  const speakers = useCaptionStore((s) => s.speakers)
  const speakerColors = useCaptionStore((s) => s.speakerColors)
  const speakerOutlineColors = useCaptionStore((s) => s.speakerOutlineColors)
  const speakerOutlineThickness = useCaptionStore((s) => s.speakerOutlineThickness)
  const speakerFontFamilies = useCaptionStore((s) => s.speakerFontFamilies)
  const speakerFontSizes = useCaptionStore((s) => s.speakerFontSizes)
  const speakerPosX = useCaptionStore((s) => s.speakerPosX)
  const speakerPosY = useCaptionStore((s) => s.speakerPosY)
  const speakerAlign = useCaptionStore((s) => s.speakerAlign)
  const captionStyle = useCaptionStore((s) => s.captionStyle)
  const setSpeakerColor = useCaptionStore((s) => s.setSpeakerColor)
  const setSpeakerOutlineColor = useCaptionStore((s) => s.setSpeakerOutlineColor)
  const setSpeakerOutlineThickness = useCaptionStore((s) => s.setSpeakerOutlineThickness)
  const setSpeakerFontFamily = useCaptionStore((s) => s.setSpeakerFontFamily)
  const setSpeakerFontSize = useCaptionStore((s) => s.setSpeakerFontSize)
  const setSpeakerPosX = useCaptionStore((s) => s.setSpeakerPosX)
  const setSpeakerPosY = useCaptionStore((s) => s.setSpeakerPosY)
  const setSpeakerAlign = useCaptionStore((s) => s.setSpeakerAlign)
  const addSpeaker = useCaptionStore((s) => s.addSpeaker)
  const renameSpeaker = useCaptionStore((s) => s.renameSpeaker)
  const removeSpeaker = useCaptionStore((s) => s.removeSpeaker)
  const captions = useCaptionStore((s) => s.captions)
  const [openSpeaker, setOpenSpeaker] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const captionCountsBySpeaker = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of captions) {
      if (c.speaker) map[c.speaker] = (map[c.speaker] ?? 0) + 1
    }
    return map
  }, [captions])

  if (state !== 'editing' && state !== 'rendering') return null

  const commitAdd = () => {
    if (draft.trim()) addSpeaker(draft)
    setDraft('')
    setAdding(false)
  }

  return (
    <div className="bg-card border border-border rounded-md mb-3 overflow-visible">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-light">Speakers</span>
        <span className="text-[11px] text-text-dim">{speakers.length}</span>
      </div>
      <div className="flex flex-col py-2">
        {speakers.map((label) => {
          const textColor = speakerColors[label] ?? captionStyle.color
          const outlineColor = speakerOutlineColors[label] ?? captionStyle.outlineColor
          const thickness = speakerOutlineThickness[label] ?? captionStyle.outlineThickness
          const fontFamily = speakerFontFamilies[label] ?? captionStyle.fontFamily
          const fontSize = speakerFontSizes[label] ?? captionStyle.fontSize
          const posX = speakerPosX[label] ?? captionStyle.posX
          const posY = speakerPosY[label] ?? captionStyle.posY
          const align = speakerAlign[label] ?? captionStyle.align
          const isOpen = openSpeaker === label

          return (
            <div key={label} className="flex items-center gap-2.5 px-4 py-2 relative">
              <span className="text-[15px] font-bold tracking-[0.02em]" style={{ color: textColor }}>
                {label}
              </span>
              <div className="flex-1" />
              <button
                type="button"
                className={iconBtn}
                aria-label={`Edit style for ${label}`}
                title="Edit style"
                onClick={() => setOpenSpeaker(isOpen ? null : label)}
              >
                <PaletteIcon />
              </button>
              <button
                type="button"
                className={deleteIconBtn}
                aria-label={`Delete speaker ${label}`}
                title="Delete speaker"
                onClick={() => setDeleteTarget(label)}
              >
                <TrashIcon />
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
                    posX,
                    posY,
                    align,
                  }}
                  defaults={{
                    color: captionStyle.color,
                    outlineColor: captionStyle.outlineColor,
                    outlineThickness: captionStyle.outlineThickness,
                    fontFamily: captionStyle.fontFamily,
                    fontSize: captionStyle.fontSize,
                    posX: captionStyle.posX,
                    posY: captionStyle.posY,
                    align: captionStyle.align,
                  }}
                  onChange={(patch: Partial<StyleValues>) => {
                    if (patch.color != null) setSpeakerColor(label, patch.color)
                    if (patch.outlineColor != null) setSpeakerOutlineColor(label, patch.outlineColor)
                    if (patch.outlineThickness != null) {
                      setSpeakerOutlineThickness(label, patch.outlineThickness)
                    }
                    if (patch.fontFamily != null) setSpeakerFontFamily(label, patch.fontFamily)
                    if (patch.fontSize != null) setSpeakerFontSize(label, patch.fontSize)
                    if (patch.posX != null) setSpeakerPosX(label, patch.posX)
                    if (patch.posY != null) setSpeakerPosY(label, patch.posY)
                    if (patch.align != null) setSpeakerAlign(label, patch.align)
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
          <div className="flex items-center gap-2.5 px-4 py-2">
            <input
              value={draft}
              autoFocus
              placeholder="Name (e.g. Host, Guest)"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitAdd}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitAdd()
                if (e.key === 'Escape') { setDraft(''); setAdding(false) }
              }}
              className="flex-1 bg-input border border-accent rounded-md px-2.5 py-1.5 text-[13px] text-text-primary font-mono"
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mx-3 mb-1 mt-1.5 px-2.5 py-1.5 bg-transparent border border-dashed border-border text-text-muted rounded-md text-xs cursor-pointer text-left hover:border-accent-light hover:text-accent-light transition-colors"
          >
            + Add speaker
          </button>
        )}
      </div>
      <DeleteSpeakerModal
        open={deleteTarget !== null}
        speakerLabel={deleteTarget ?? ''}
        captionCount={deleteTarget ? captionCountsBySpeaker[deleteTarget] ?? 0 : 0}
        otherSpeakers={deleteTarget ? speakers.filter((s) => s !== deleteTarget) : []}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(reassignTo) => {
          if (deleteTarget) removeSpeaker(deleteTarget, reassignTo)
          setDeleteTarget(null)
          if (openSpeaker === deleteTarget) setOpenSpeaker(null)
        }}
      />
    </div>
  )
}
