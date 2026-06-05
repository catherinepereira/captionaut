import { useEffect, useId, useState } from "react";
import type { RenderFormat } from "../api";

interface Props {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (format: RenderFormat) => void;
}

interface FormatOption {
  value: RenderFormat;
  name: string;
  meta: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { value: "mp4", name: "MP4", meta: "H.264 + AAC · plays everywhere" },
  { value: "webm", name: "WebM", meta: "VP9 + Opus · smaller, web-friendly" },
  { value: "mov", name: "MOV", meta: "ProRes HQ · editor-friendly, large" },
];

export function RenderModal({ open, busy, onClose, onConfirm }: Props) {
  const [format, setFormat] = useState<RenderFormat>("mp4");
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onClick={() => !busy && onClose()}
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
            Render video
          </h3>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close render dialog"
            className="text-text-muted hover:text-text-primary cursor-pointer border-0 bg-transparent px-1.5 text-2xl leading-none disabled:opacity-50"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <span className="text-text-dim mb-2.5 block text-xs font-semibold tracking-[0.08em] uppercase">
          Output format
        </span>
        <div
          className="mb-5 flex flex-col gap-2"
          role="radiogroup"
          aria-label="Output format"
        >
          {FORMAT_OPTIONS.map((opt) => {
            const active = format === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFormat(opt.value)}
                disabled={busy}
                className={`flex items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-colors ${
                  active
                    ? "bg-accent/10 border-accent text-text-primary"
                    : "bg-input border-border text-text-primary hover:border-accent-light"
                } disabled:opacity-60`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{opt.name}</span>
                  <span className="text-text-muted text-xs">{opt.meta}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="border-border text-text-primary hover:enabled:border-accent-light hover:enabled:text-accent-light rounded-md border bg-transparent px-4 py-2 text-[13px] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(format)}
            disabled={busy}
            className="bg-accent border-accent hover:enabled:bg-accent-light hover:enabled:border-accent-light rounded-md border px-4.5 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Rendering…" : "Render"}
          </button>
        </div>
      </div>
    </div>
  );
}
