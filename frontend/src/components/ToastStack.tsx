import { useEffect } from "react";
import { useCaptionStore } from "../stores/captionStore";

const AUTO_DISMISS_MS = 8000;

const KIND_BORDER: Record<"info" | "warn" | "error", string> = {
  info: "border-l-accent",
  warn: "border-l-[#d3a06b]",
  error: "border-l-red",
};

export function ToastStack() {
  const toasts = useCaptionStore((s) => s.toasts);
  const dismiss = useCaptionStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => dismiss(t.id), AUTO_DISMISS_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed right-6 bottom-6 z-[100] flex max-w-[min(400px,calc(100vw-48px))] flex-col-reverse gap-2.5"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`bg-elevated border-border pointer-events-auto flex items-start gap-2.5 rounded-md border border-l-[3px] px-3.5 py-3 ${KIND_BORDER[t.kind]} text-text-primary text-[13.5px] leading-snug shadow-[0_6px_20px_rgba(0,0,0,0.4)]`}
          style={{ animation: "slideIn 180ms ease-out" }}
        >
          <p className="m-0 flex-1">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="text-text-muted hover:text-text-primary focus-visible:outline-accent rounded border-0 bg-transparent px-1 text-lg leading-none focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
