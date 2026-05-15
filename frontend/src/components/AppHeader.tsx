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
  const canStartOver = state === 'editing' || state === 'burning'

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.logoText}>Captionaut</span>
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
