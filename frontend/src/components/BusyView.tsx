import { useCaptionStore } from '../stores/captionStore'

export function BusyView() {
  const state = useCaptionStore((s) => s.state)
  const videoFileName = useCaptionStore((s) => s.videoFile?.name ?? null)
  const transcribeProgress = useCaptionStore((s) => s.transcribeProgress)

  const isTranscribing = state === 'transcribing'
  const title = isTranscribing ? 'Transcribing with Whisper…' : 'Uploading video…'

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-text-muted"
    >
      <div
        aria-hidden="true"
        className="w-9 h-9 mb-2 rounded-full border-[3px] border-border border-t-accent"
        style={{ animation: 'spin 0.8s linear infinite' }}
      />
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {videoFileName && (
        <p className="text-[13px] text-text-muted max-w-[480px] overflow-hidden text-ellipsis whitespace-nowrap">
          {videoFileName}
        </p>
      )}

      {isTranscribing && (
        <div className="flex flex-col items-center gap-2 w-full max-w-[320px] mt-1">
          <div
            role="progressbar"
            aria-valuenow={transcribeProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Transcription progress"
            className="w-full h-1.5 bg-border rounded-sm overflow-hidden"
          >
            <div
              className="h-full bg-accent rounded-sm transition-[width] duration-300 ease"
              style={{ width: `${transcribeProgress}%` }}
            />
          </div>
          <p className="text-xs font-mono text-text-muted">{transcribeProgress}%</p>
        </div>
      )}

      <p className="text-xs text-text-dim max-w-[480px] text-center">
        {isTranscribing
          ? 'Whisper processes about 5× faster than real-time on most machines.'
          : 'This may take a moment'}
      </p>
    </div>
  )
}
