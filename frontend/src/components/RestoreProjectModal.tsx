import { useEffect, useId } from 'react'
import type { RestorePrompt } from '../hooks/useVideoPipeline'

interface Props {
  prompt: RestorePrompt | null
}

export function RestoreProjectModal({ prompt }: Props) {
  const titleId = useId()

  useEffect(() => {
    if (!prompt) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') prompt.resolve('cancel')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prompt])

  if (!prompt) return null
  const { prior, fingerprintMatches, resolve } = prompt
  const captionCount = prior.captions.length
  const speakerCount = prior.speakers.length
  const savedDate = new Date(prior.savedAt).toLocaleString()
  const displayName = prior.name || prior.videoFileName

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-[2px]"
      onClick={() => resolve('cancel')}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-lg p-6 w-full max-w-[440px] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id={titleId} className="text-base font-bold text-text-primary">
            {fingerprintMatches ? 'Restore previous work?' : "File doesn't match saved project"}
          </h3>
          <button
            onClick={() => resolve('cancel')}
            aria-label="Cancel"
            className="bg-transparent border-0 text-text-muted text-2xl leading-none cursor-pointer px-1.5 hover:text-text-primary"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <p className="mb-2 text-sm leading-snug text-text-primary">
          {fingerprintMatches ? (
            <>You've worked on <strong>{displayName}</strong> before.</>
          ) : (
            <>This file doesn't match <strong>{displayName}</strong> (saved size differs). Captions may not line up if the video is different.</>
          )}
        </p>
        <p className="mb-5 text-xs text-text-muted">
          Saved {savedDate} · {captionCount} caption{captionCount === 1 ? '' : 's'}
          {speakerCount > 0 && ` · ${speakerCount} speaker${speakerCount === 1 ? '' : 's'}`}
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => resolve('cancel')}
            className="bg-transparent border border-border text-text-primary text-[13px] px-4 py-2 rounded-md hover:border-accent-light hover:text-accent-light transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => resolve('new')}
            className="bg-transparent border border-border text-text-primary text-[13px] px-4 py-2 rounded-md hover:border-accent-light hover:text-accent-light transition-colors"
          >
            Create new
          </button>
          <button
            onClick={() => resolve('restore')}
            className="bg-accent border border-accent text-white text-[13px] font-semibold px-4 py-2 rounded-md hover:bg-accent-light hover:border-accent-light transition-colors"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  )
}
