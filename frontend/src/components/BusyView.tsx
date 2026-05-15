import { useCaptionStore } from '../stores/captionStore'
import styles from '../App.module.css'

export function BusyView() {
  const state = useCaptionStore((s) => s.state)
  const videoFileName = useCaptionStore((s) => s.videoFile?.name ?? null)
  const transcribeProgress = useCaptionStore((s) => s.transcribeProgress)

  const isTranscribing = state === 'transcribing'
  const title = isTranscribing ? 'Transcribing with Whisper…' : 'Uploading video…'

  return (
    <div className={styles.busy} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.busyTitle}>{title}</p>
      {videoFileName && <p className={styles.busyFile}>{videoFileName}</p>}

      {isTranscribing && (
        <div className={styles.progressWrap}>
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-valuenow={transcribeProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Transcription progress"
          >
            <div
              className={styles.progressFill}
              style={{ width: `${transcribeProgress}%` }}
            />
          </div>
          <p className={styles.progressLabel}>{transcribeProgress}%</p>
        </div>
      )}

      <p className={styles.busySub}>
        {isTranscribing
          ? 'Whisper processes about 5× faster than real-time on most machines.'
          : 'This may take a moment'}
      </p>
    </div>
  )
}
