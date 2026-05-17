import { useEffect, useId } from 'react'

interface Props {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmModal({
  open, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'default',
  onClose, onConfirm,
}: Props) {
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

  const confirmClass = variant === 'danger'
    ? 'bg-red border border-red text-white text-[13px] font-semibold px-4 py-2 rounded-md hover:bg-red/90 hover:border-red/90'
    : 'bg-accent border border-accent text-white text-[13px] font-semibold px-4 py-2 rounded-md hover:bg-accent-light hover:border-accent-light'

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
          <h3 id={titleId} className="text-base font-bold text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Cancel"
            className="bg-transparent border-0 text-text-muted text-2xl leading-none cursor-pointer px-1.5 hover:text-text-primary"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="mb-5 text-sm leading-snug text-text-primary">{message}</div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-transparent border border-border text-text-primary text-[13px] px-4 py-2 rounded-md hover:border-accent-light hover:text-accent-light transition-colors"
          >
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={confirmClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
