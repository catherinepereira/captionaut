import { useEffect, useId, useState } from 'react'

interface Props {
  open: boolean
  speakerLabel: string
  captionCount: number
  otherSpeakers: string[]
  onClose: () => void
  onConfirm: (reassignTo: string | null) => void
}

export function DeleteSpeakerModal({
  open, speakerLabel, captionCount, otherSpeakers, onClose, onConfirm,
}: Props) {
  const [reassignTo, setReassignTo] = useState<string | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (open) setReassignTo(null)
  }, [open, speakerLabel])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const hasCaptions = captionCount > 0
  const hasOthers = otherSpeakers.length > 0

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
        className="bg-card border border-border rounded-lg p-6 w-full max-w-[420px] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id={titleId} className="text-base font-bold text-text-primary">Delete speaker</h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="bg-transparent border-0 text-text-muted text-2xl leading-none cursor-pointer px-1.5 hover:text-text-primary"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <p className="mb-4 text-sm leading-snug text-text-primary">
          Are you sure you want to delete <strong>{speakerLabel}</strong>?
          {hasCaptions && (
            <>
              <br />
              <strong>{captionCount}</strong> caption{captionCount === 1 ? ' is' : 's are'} assigned to this speaker.
            </>
          )}
        </p>

        {hasCaptions && (
          <div className="flex items-center gap-2.5 mb-5">
            <label htmlFor={`${titleId}-reassign`} className="text-[13px] text-text-primary whitespace-nowrap">
              Reassign to speaker:
            </label>
            <select
              id={`${titleId}-reassign`}
              value={reassignTo ?? ''}
              onChange={(e) => setReassignTo(e.target.value === '' ? null : e.target.value)}
              className="flex-1 bg-input border border-border text-text-primary text-[13px] px-2.5 py-1.5 rounded-md outline-none cursor-pointer focus:border-accent"
            >
              <option value="">None</option>
              {hasOthers && otherSpeakers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-transparent border border-border text-text-primary text-[13px] px-4 py-2 rounded-md hover:border-accent-light hover:text-accent-light"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reassignTo)}
            className="bg-red border border-red text-white text-[13px] font-semibold px-4.5 py-2 rounded-md hover:bg-red/90 hover:border-red/90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
