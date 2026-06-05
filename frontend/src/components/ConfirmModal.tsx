import { useEffect, useId } from "react";

interface Props {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-red border border-red text-white text-[13px] font-semibold px-4 py-2 rounded-md hover:bg-red/90 hover:border-red/90"
      : "bg-accent border border-accent text-white text-[13px] font-semibold px-4 py-2 rounded-md hover:bg-accent-light hover:border-accent-light";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border-border max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-lg border p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id={titleId} className="text-text-primary text-base font-bold">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Cancel"
            className="text-text-muted hover:text-text-primary cursor-pointer border-0 bg-transparent px-1.5 text-2xl leading-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="text-text-primary mb-5 text-sm leading-snug">
          {message}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="border-border text-text-primary hover:border-accent-light hover:text-accent-light rounded-md border bg-transparent px-4 py-2 text-[13px] transition-colors"
          >
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={confirmClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
