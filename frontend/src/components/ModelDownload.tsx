import { useEffect, useRef, useState } from 'react'
import { checkModelStatus, streamProgress, type StreamHandle } from '../api'
import styles from './ModelDownload.module.css'

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
      <div className={styles.screen}>
        <div className={styles.spinner} />
        <p className={styles.label}>Checking setup…</p>
      </div>
    )
  }

  if (!needsDownload) return null

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h2 className={styles.title}>One-time setup</h2>
        <p className={styles.desc}>
          Captionaut uses <strong>Whisper AI</strong> to transcribe your videos locally.
          The model needs to be downloaded once (~145 MB) and stays on your machine.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        {!downloading ? (
          <button className={styles.btn} onClick={startDownload}>
            Download Whisper model
          </button>
        ) : (
          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <p className={styles.progressLabel}>{progress}%</p>
          </div>
        )}

        <p className={styles.privacy}>
          Everything stays on your machine — no data ever leaves your computer.
        </p>
      </div>
    </div>
  )
}
