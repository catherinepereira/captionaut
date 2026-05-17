import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
}

export function DropZone({ onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  const base =
    'w-full px-10 py-14 flex flex-col items-center gap-2.5 rounded-md border-2 border-dashed text-text-muted bg-input transition-colors'
  const interactive = disabled
    ? 'cursor-default opacity-50 border-border'
    : `cursor-pointer ${dragging ? 'border-accent bg-[#1a1535]' : 'border-border'} hover:border-accent hover:bg-[#1a1535] focus-visible:border-accent focus-visible:bg-[#1a1535] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(107,140,179,0.35)]`

  return (
    <button
      type="button"
      className={`${base} ${interactive}`}
      disabled={disabled}
      aria-label="Drop a video file here, or click to browse"
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={disabled ? undefined : handleDrop}
      onClick={openPicker}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-matroska,.mkv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        tabIndex={-1}
        aria-hidden="true"
      />
      <svg
        width="36" height="36" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <p className="text-[15px] text-text-muted">
        Drop your video here or <span className="text-accent-light underline cursor-pointer">browse files</span>
      </p>
      <p className="text-xs text-text-dim">mp4, mov, mkv. Up to 2 GB.</p>
    </button>
  )
}
