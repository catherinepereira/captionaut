import { useCaptionStore } from "../stores/captionStore";

export function ErrorBanner() {
  const { error, setError } = useCaptionStore();
  if (!error) return null;
  return (
    <div
      role="alert"
      className="text-text-primary border-red/40 bg-red/10 mx-8 mt-4 flex items-center gap-3 rounded-md border px-4 py-3 text-sm"
    >
      <span className="bg-red inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white">
        !
      </span>
      <span className="flex-1">{error}</span>
      <button
        onClick={() => setError(null)}
        aria-label="Dismiss"
        className="text-text-muted hover:text-text-primary border-0 bg-transparent px-1 text-xl leading-none"
      >
        ×
      </button>
    </div>
  );
}
