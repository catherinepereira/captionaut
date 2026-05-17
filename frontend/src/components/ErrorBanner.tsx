import { useCaptionStore } from '../stores/captionStore'

export function ErrorBanner() {
  const { error, setError } = useCaptionStore()
  if (!error) return null
  return (
    <div
      role="alert"
      className="flex items-center gap-3 mx-8 mt-4 px-4 py-3 rounded-md text-sm text-text-primary border border-red/40 bg-red/10"
    >
      <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-red text-white font-bold text-[13px] shrink-0">!</span>
      <span className="flex-1">{error}</span>
      <button
        onClick={() => setError(null)}
        aria-label="Dismiss"
        className="bg-transparent border-0 text-text-muted text-xl leading-none px-1 hover:text-text-primary"
      >
        ×
      </button>
    </div>
  )
}
