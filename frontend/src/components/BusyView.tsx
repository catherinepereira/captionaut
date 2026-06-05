import { useCaptionStore } from "../stores/captionStore";

const MODEL_LABELS: Record<string, string> = {
  tiny: "Tiny",
  base: "Base",
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export function BusyView() {
  const state = useCaptionStore((s) => s.state);
  const videoFileName = useCaptionStore((s) => s.videoFile?.name ?? null);
  const transcribeProgress = useCaptionStore((s) => s.transcribeProgress);
  const transcribeStage = useCaptionStore((s) => s.transcribeStage);
  const modelSize = useCaptionStore((s) => s.transcribeConfig.modelSize);
  const modelLabel = MODEL_LABELS[modelSize] ?? modelSize;

  const isTranscribing = state === "transcribing";
  const title = !isTranscribing
    ? "Uploading video…"
    : transcribeStage === "downloading_model"
      ? `Downloading Whisper ${modelLabel} model…`
      : `Transcribing with Whisper ${modelLabel}…`;

  const hint = !isTranscribing
    ? "This may take a moment"
    : transcribeStage === "downloading_model"
      ? "First-run only. Weights are cached for next time."
      : "Whisper processes about 5× faster than real-time on most machines.";

  return (
    <div
      role="status"
      aria-live="polite"
      className="text-text-muted flex min-h-[60vh] flex-col items-center justify-center gap-3"
    >
      <div
        aria-hidden="true"
        className="border-border border-t-accent mb-2 h-9 w-9 rounded-full border-[3px]"
        style={{ animation: "spin 0.8s linear infinite" }}
      />
      <p className="text-text-primary text-base font-semibold">{title}</p>
      {videoFileName && (
        <p className="text-text-muted max-w-[480px] overflow-hidden text-[13px] text-ellipsis whitespace-nowrap">
          {videoFileName}
        </p>
      )}

      {isTranscribing && (
        <div className="mt-1 flex w-full max-w-[320px] flex-col items-center gap-2">
          <div
            role="progressbar"
            aria-valuenow={transcribeProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Transcription progress"
            className="bg-border h-1.5 w-full overflow-hidden rounded-sm"
          >
            <div
              className="bg-accent ease h-full rounded-sm transition-[width] duration-300"
              style={{ width: `${transcribeProgress}%` }}
            />
          </div>
          <p className="text-text-muted font-mono text-xs">
            {transcribeProgress}%
          </p>
        </div>
      )}

      <p className="text-text-dim max-w-[480px] text-center text-xs">{hint}</p>
    </div>
  );
}
