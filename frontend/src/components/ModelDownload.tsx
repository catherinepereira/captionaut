import { useEffect, useRef, useState } from 'react'
import { checkModelStatus, streamProgress, type StreamHandle } from '../api'

interface Props {
  onReady: () => void
}

export function ModelDownload({ onReady }: Props) {
  const [checking, setChecking] = useState(true)
  const [needsDownload, setNeedsDownload] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<StreamHandle | null>(null)

  useEffect(() => () => { streamRef.current?.close() }, [])

  useEffect(() => {
    checkModelStatus()
      .then(({ downloaded }) => {
        if (downloaded) onReady()
        else { setChecking(false); setNeedsDownload(true) }
      })
      .catch(() => {
        setChecking(false)
        setNeedsDownload(true)
      })
  }, [onReady])

  const startDownload = () => {
    setDownloading(true)
    setError(null)
    streamRef.current = streamProgress('/download-model', {
      onProgress: setProgress,
      onDone: onReady,
      onError: (msg) => { setError(msg); setDownloading(false) },
    })
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg flex-col">
        <div
          className="w-8 h-8 rounded-full border-[3px] border-border border-t-accent"
          style={{ animation: 'spin 0.8s linear infinite' }}
        />
        <p className="mt-4 text-sm text-text-muted">Checking setup…</p>
      </div>
    )
  }

  if (!needsDownload) return null

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="bg-card border border-border rounded-2xl px-14 py-12 max-w-[480px] w-full text-center">
        <h2 className="text-2xl font-bold text-text-primary mb-4">One-time setup</h2>
        <p className="text-sm text-text-muted leading-relaxed mb-8">
          Captionaut uses <a
            href="https://github.com/openai/whisper"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-accent-light underline-offset-2 hover:underline"
          >Whisper AI</a> to transcribe your videos.
          The transcription model is about 145 MB and only needs to download once.
        </p>

        {error && (
          <p className="text-[13px] text-red mb-4 p-2.5 bg-red/10 rounded-md">{error}</p>
        )}

        {!downloading ? (
          <button
            onClick={startDownload}
            className="w-full bg-accent text-white text-[15px] font-semibold px-7 py-3 rounded-md hover:bg-accent-light transition-colors border-0"
          >
            Download Whisper model
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2.5">
            <div className="w-full h-2 bg-border rounded-sm overflow-hidden">
              <div
                className="h-full bg-accent rounded-sm transition-[width] duration-300 ease"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[13px] text-text-muted">{progress}%</p>
          </div>
        )}

        <p className="text-[11px] text-text-dim mt-6">
          You only need to do this once per environment.
        </p>
      </div>
    </div>
  )
}
