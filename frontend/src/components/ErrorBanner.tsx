import { useCaptionStore } from '../stores/captionStore'
import styles from './ErrorBanner.module.css'

export function ErrorBanner() {
  const { error, setError } = useCaptionStore()
  if (!error) return null
  return (
    <div className={styles.banner} role="alert">
      <span className={styles.icon}>!</span>
      <span className={styles.msg}>{error}</span>
      <button className={styles.close} onClick={() => setError(null)} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
