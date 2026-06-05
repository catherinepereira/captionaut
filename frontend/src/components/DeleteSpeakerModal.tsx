import { useEffect, useId, useState } from "react";

interface Props {
  open: boolean;
  speakerLabel: string;
  captionCount: number;
  otherSpeakers: string[];
  onClose: () => void;
  onConfirm: (reassignTo: string | null) => void;
}

export function DeleteSpeakerModal({
  open,
  speakerLabel,
  captionCount,
  otherSpeakers,
  onClose,
  onConfirm,
}: Props) {
  const [reassignTo, setReassignTo] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) setReassignTo(null);
  }, [open, speakerLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasCaptions = captionCount > 0;
  const hasOthers = otherSpeakers.length > 0;

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
            Delete speaker
          </h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-text-muted hover:text-text-primary cursor-pointer border-0 bg-transparent px-1.5 text-2xl leading-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <p className="text-text-primary mb-4 text-sm leading-snug">
          Are you sure you want to delete <strong>{speakerLabel}</strong>?
          {hasCaptions && (
            <>
              <br />
              <strong>{captionCount}</strong> caption
              {captionCount === 1 ? " is" : "s are"} assigned to this speaker.
            </>
          )}
        </p>

        {hasCaptions && (
          <div className="mb-5 flex items-center gap-2.5">
            <label
              htmlFor={`${titleId}-reassign`}
              className="text-text-primary text-[13px] whitespace-nowrap"
            >
              Reassign to speaker:
            </label>
            <select
              id={`${titleId}-reassign`}
              value={reassignTo ?? ""}
              onChange={(e) =>
                setReassignTo(e.target.value === "" ? null : e.target.value)
              }
              className="bg-input border-border text-text-primary focus:border-accent flex-1 cursor-pointer rounded-md border px-2.5 py-1.5 text-[13px] outline-none"
            >
              <option value="">None</option>
              {hasOthers &&
                otherSpeakers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="border-border text-text-primary hover:border-accent-light hover:text-accent-light rounded-md border bg-transparent px-4 py-2 text-[13px]"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reassignTo)}
            className="bg-red border-red hover:bg-red/90 hover:border-red/90 rounded-md border px-4.5 py-2 text-[13px] font-semibold text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
