import { useEffect, useId } from "react";
import type { RestorePrompt } from "../hooks/useVideoPipeline";

interface Props {
  prompt: RestorePrompt | null;
}

export function RestoreProjectModal({ prompt }: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") prompt.resolve("cancel");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompt]);

  if (!prompt) return null;
  const { prior, fingerprintMatches, resolve } = prompt;
  const captionCount = prior.captions.length;
  const speakerCount = prior.speakers.length;
  const savedDate = new Date(prior.savedAt).toLocaleString();
  const displayName = prior.name || prior.videoFileName;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onClick={() => resolve("cancel")}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border-border max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-lg border p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id={titleId} className="text-text-primary text-base font-bold">
            {fingerprintMatches
              ? "Restore previous work?"
              : "File doesn't match saved project"}
          </h3>
          <button
            onClick={() => resolve("cancel")}
            aria-label="Cancel"
            className="text-text-muted hover:text-text-primary cursor-pointer border-0 bg-transparent px-1.5 text-2xl leading-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <p className="text-text-primary mb-2 text-sm leading-snug">
          {fingerprintMatches ? (
            <>
              You've worked on <strong>{displayName}</strong> before.
            </>
          ) : (
            <>
              This file doesn't match <strong>{displayName}</strong> (saved size
              differs). Captions may not line up if the video is different.
            </>
          )}
        </p>
        <p className="text-text-muted mb-5 text-xs">
          Saved {savedDate} · {captionCount} caption
          {captionCount === 1 ? "" : "s"}
          {speakerCount > 0 &&
            ` · ${speakerCount} speaker${speakerCount === 1 ? "" : "s"}`}
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => resolve("cancel")}
            className="border-border text-text-primary hover:border-accent-light hover:text-accent-light rounded-md border bg-transparent px-4 py-2 text-[13px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => resolve("new")}
            className="border-border text-text-primary hover:border-accent-light hover:text-accent-light rounded-md border bg-transparent px-4 py-2 text-[13px] transition-colors"
          >
            Create new
          </button>
          <button
            onClick={() => resolve("restore")}
            className="bg-accent border-accent hover:bg-accent-light hover:border-accent-light rounded-md border px-4 py-2 text-[13px] font-semibold text-white transition-colors"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}
