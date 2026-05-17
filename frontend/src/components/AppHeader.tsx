import { useEffect, useRef, useState } from 'react'
import { useCaptionStore } from '../stores/captionStore'

interface Props {
  onNewVideo: () => void
  onOpenSettings: () => void
}

export function AppHeader({ onNewVideo, onOpenSettings }: Props) {
  const state = useCaptionStore((s) => s.state)
  const videoFileName = useCaptionStore((s) => s.videoFile?.name ?? null)
  const projectName = useCaptionStore((s) => s.projectName)
  const setProjectName = useCaptionStore((s) => s.setProjectName)
  const isLanding = state === 'idle'
  const canStartOver = state === 'editing' || state === 'rendering'
  const canRename = canStartOver
  const inputRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const startEdit = () => {
    setDraft(projectName ?? '')
    setEditing(true)
  }

  const commit = () => {
    setProjectName(draft)
    setEditing(false)
  }

  const cancel = () => {
    setEditing(false)
  }

  const displayName = projectName || videoFileName

  return (
    <header className="sticky top-0 z-[100] flex items-center px-10 py-4 gap-6 border-b border-border bg-bg">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          type="button"
          onClick={onNewVideo}
          disabled={isLanding}
          aria-label="Return to home"
          className="inline-flex items-center gap-2 px-1.5 py-1 -mx-1.5 -my-1 rounded-md bg-transparent border-0 font-inherit text-inherit hover:enabled:bg-elevated disabled:cursor-default transition-colors"
        >
          <span aria-hidden="true" className="text-lg leading-none">👩‍🚀</span>
          <span className="text-base font-bold text-text-primary tracking-tight">Captionaut</span>
        </button>
        {displayName && !isLanding && (
          <>
            <span aria-hidden="true" className="text-text-dim mx-1">/</span>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit()
                  if (e.key === 'Escape') cancel()
                }}
                placeholder={videoFileName ?? 'Project name'}
                aria-label="Project name"
                className="bg-input border border-accent text-text-primary text-sm font-medium rounded-md px-2 py-1 max-w-[360px] outline-none"
              />
            ) : canRename ? (
              <button
                type="button"
                onClick={startEdit}
                aria-label={`Rename project (currently ${displayName})`}
                title="Click to rename"
                className="bg-transparent border-0 text-sm text-text-muted font-medium max-w-[360px] overflow-hidden text-ellipsis whitespace-nowrap cursor-text rounded-md px-2 py-1 -mx-2 -my-1 hover:bg-elevated hover:text-text-primary transition-colors"
              >
                {displayName}
              </button>
            ) : (
              <span
                aria-label="Current file"
                className="text-sm text-text-muted font-medium max-w-[360px] overflow-hidden text-ellipsis whitespace-nowrap"
              >
                {displayName}
              </span>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {canStartOver && (
          <button
            onClick={onNewVideo}
            className="bg-transparent border border-border text-text-primary text-[13px] font-medium px-3.5 py-1.5 rounded-md hover:border-accent-light hover:text-accent-light transition-colors"
          >
            + New video
          </button>
        )}
        <button
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="bg-transparent border border-border text-text-muted text-base w-8 h-8 rounded-md inline-flex items-center justify-center hover:border-accent-light hover:text-accent-light transition-colors"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </div>
    </header>
  )
}
