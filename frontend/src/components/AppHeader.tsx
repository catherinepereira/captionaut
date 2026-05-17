import { useCaptionStore } from '../stores/captionStore'
import styles from '../App.module.css'

interface Props {
  onNewVideo: () => void
  onOpenSettings: () => void
}

export function AppHeader({ onNewVideo, onOpenSettings }: Props) {
  const state = useCaptionStore((s) => s.state)
  const videoFileName = useCaptionStore((s) => s.videoFile?.name ?? null)
  const isLanding = state === 'idle'
  const canStartOver = state === 'editing' || state === 'rendering'

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <button
          type="button"
          className={styles.logoBtn}
          onClick={onNewVideo}
          disabled={isLanding}
          aria-label="Return to home"
        >
          <span className={styles.logoEmoji} aria-hidden="true">👩‍🚀</span>
          <span className={styles.logoText}>Captionaut</span>
        </button>
        {videoFileName && !isLanding && (
          <>
            <span className={styles.separator} aria-hidden="true">/</span>
            <span className={styles.fileName} aria-label="Current file">{videoFileName}</span>
          </>
        )}
      </div>
      <div className={styles.headerActions}>
        {canStartOver && (
          <button className={styles.newBtn} onClick={onNewVideo}>
            + New video
          </button>
        )}
        <button
          className={styles.iconBtn}
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </div>
    </header>
  )
}
