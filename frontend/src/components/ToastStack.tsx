import { useEffect } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import styles from './ToastStack.module.css'

const AUTO_DISMISS_MS = 8000

export function ToastStack() {
  const toasts = useCaptionStore((s) => s.toasts)
  const dismiss = useCaptionStore((s) => s.dismissToast)

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map((t) =>
      window.setTimeout(() => dismiss(t.id), AUTO_DISMISS_MS),
    )
    return () => timers.forEach(clearTimeout)
  }, [toasts, dismiss])

  if (toasts.length === 0) return null

  return (
    <div className={styles.stack} role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.kind]}`} role="status">
          <p className={styles.message}>{t.message}</p>
          <button
            className={styles.close}
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
