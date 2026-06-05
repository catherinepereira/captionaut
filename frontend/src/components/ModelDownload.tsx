import { useEffect, useRef, useState } from "react";
import { checkModelStatus, streamProgress, type StreamHandle } from "../api";

interface Props {
  onReady: () => void;
}

export function ModelDownload({ onReady }: Props) {
  const [checking, setChecking] = useState(true);
  const [needsDownload, setNeedsDownload] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<StreamHandle | null>(null);

  useEffect(
    () => () => {
      streamRef.current?.close();
    },
    [],
  );

  useEffect(() => {
    checkModelStatus()
      .then(({ downloaded }) => {
        if (downloaded) onReady();
        else {
          setChecking(false);
          setNeedsDownload(true);
        }
      })
      .catch(() => {
        setChecking(false);
        setNeedsDownload(true);
      });
  }, [onReady]);

  const startDownload = () => {
    setDownloading(true);
    setError(null);
    streamRef.current = streamProgress("/download-model", {
      onProgress: setProgress,
      onDone: onReady,
      onError: (msg) => {
        setError(msg);
        setDownloading(false);
      },
    });
  };

  if (checking) {
    return (
      <div className="bg-bg flex min-h-screen flex-col items-center justify-center">
        <div
          className="border-border border-t-accent h-8 w-8 rounded-full border-[3px]"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        <p className="text-text-muted mt-4 text-sm">Checking setup…</p>
      </div>
    );
  }

  if (!needsDownload) return null;

  return (
    <div className="bg-bg flex min-h-screen items-center justify-center">
      <div className="bg-card border-border w-full max-w-[480px] rounded-2xl border px-14 py-12 text-center">
        <h2 className="text-text-primary mb-4 text-2xl font-bold">
          One-time setup
        </h2>
        <p className="text-text-muted mb-8 text-sm leading-relaxed">
          Captionaut uses{" "}
          <a
            href="https://github.com/openai/whisper"
            target="_blank"
            rel="noreferrer"
            className="text-accent-light font-bold underline-offset-2 hover:underline"
          >
            Whisper AI
          </a>{" "}
          to transcribe your videos. The transcription model is about 145 MB and
          only needs to download once.
        </p>

        {error && (
          <p className="text-red bg-red/10 mb-4 rounded-md p-2.5 text-[13px]">
            {error}
          </p>
        )}

        {!downloading ? (
          <button
            onClick={startDownload}
            className="bg-accent hover:bg-accent-light w-full rounded-md border-0 px-7 py-3 text-[15px] font-semibold text-white transition-colors"
          >
            Download Whisper model
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2.5">
            <div className="bg-border h-2 w-full overflow-hidden rounded-sm">
              <div
                className="bg-accent ease h-full rounded-sm transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-text-muted text-[13px]">{progress}%</p>
          </div>
        )}

        <p className="text-text-dim mt-6 text-[11px]">
          You only need to do this once per environment.
        </p>
      </div>
    </div>
  );
}
