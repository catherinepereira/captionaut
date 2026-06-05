import { useEffect, useRef, useState } from "react";
import { useCaptionStore, type ModelSize } from "../stores/captionStore";
import { loadSettings, saveSettings } from "../utils/settings";
import { getCachedModels } from "../api";

interface ModelOption {
  value: ModelSize;
  label: string;
  size: string;
  speed: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { value: "tiny", label: "Tiny", size: "~75 MB", speed: "fastest" },
  { value: "base", label: "Base", size: "~145 MB", speed: "fast" },
  { value: "small", label: "Small", size: "~465 MB", speed: "balanced" },
  { value: "medium", label: "Medium", size: "~1.5 GB", speed: "slow" },
  {
    value: "large",
    label: "Large",
    size: "~3 GB",
    speed: "slowest, most accurate",
  },
];

interface Props {
  onStart: () => void;
  onCancel: () => void;
}

const labelClass =
  "block text-xs font-semibold tracking-[0.06em] uppercase text-accent-light mb-2.5";
const hintClass = "mt-2 text-xs text-text-dim leading-snug";
const inputClass =
  "w-full bg-bg border border-border text-text-primary text-[13px] px-2.5 py-2 rounded-md outline-none focus:border-accent";

export function ConfigScreen({ onStart, onCancel }: Props) {
  const videoFile = useCaptionStore((s) => s.videoFile);
  const config = useCaptionStore((s) => s.transcribeConfig);
  const setConfig = useCaptionStore((s) => s.setTranscribeConfig);
  const setDiarization = useCaptionStore((s) => s.setDiarizationConfig);
  const isReTranscribing = useCaptionStore((s) => s.isReTranscribing);
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const [cachedModels, setCachedModels] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCachedModels()
      .then((r) => setCachedModels(new Set(r.cached)))
      .catch(() => {});
  }, []);

  const onHfTokenChange = (token: string) => {
    setDiarization({ hfToken: token });
    saveSettings({ ...loadSettings(), hfToken: token });
  };

  useEffect(() => {
    const s = loadSettings();
    if (!config.diarization.hfToken && s.hfToken) {
      setDiarization({ hfToken: s.hfToken });
    }
    if (config.modelSize === "base" && s.defaultModelSize !== "base") {
      setConfig({ modelSize: s.defaultModelSize });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-start justify-center px-6 py-12">
      <div className="bg-card border-border w-full max-w-[640px] rounded-md border px-9 py-8">
        <h2 className="text-text-primary mb-1 text-[22px] font-bold">
          {isReTranscribing ? "Re-transcribe video" : "Configure transcription"}
        </h2>
        {isReTranscribing && (
          <p className="text-text-dim mb-3 text-xs">
            Running this will replace your current captions, speakers, and
            edits.
          </p>
        )}
        {videoFile && (
          <p className="text-text-muted mb-7 overflow-hidden text-[13px] text-ellipsis whitespace-nowrap">
            {videoFile.name}
          </p>
        )}

        <section className="mb-6" aria-labelledby="model-label">
          <span id="model-label" className={labelClass}>
            Model
          </span>
          <div
            role="radiogroup"
            aria-labelledby="model-label"
            className="grid gap-2"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            }}
          >
            {MODEL_OPTIONS.map((opt) => {
              const active = config.modelSize === opt.value;
              const downloaded = cachedModels.has(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`relative flex flex-col gap-1 rounded-md border px-2.5 py-3 text-left transition-colors ${
                    active
                      ? "bg-accent border-accent hover:bg-accent-light hover:border-accent-light text-white"
                      : "bg-input border-border text-text-primary hover:border-accent-light"
                  }`}
                  onClick={() => setConfig({ modelSize: opt.value })}
                >
                  {downloaded && (
                    <span
                      aria-label="Already downloaded"
                      title="Already downloaded"
                      className={`absolute top-1.5 right-1.5 rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-accent/15 text-accent-light"
                      }`}
                    >
                      ✓ Cached
                    </span>
                  )}
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-[11px] opacity-75">
                    {opt.size} · {opt.speed}
                  </span>
                </button>
              );
            })}
          </div>
          <p className={hintClass}>
            Larger models are more accurate but slower. The first run with a new
            model will download it.
          </p>
        </section>

        <section className="mb-6">
          <label htmlFor="prompt" className={labelClass}>
            Prompt{" "}
            <span className="text-text-dim font-normal tracking-normal normal-case">
              (optional)
            </span>
          </label>
          <textarea
            id="prompt"
            rows={3}
            placeholder='Names, jargon, or context that helps Whisper get spelling right. e.g. "Discussion of Captionaut, FFmpeg, and pyannote."'
            value={config.initialPrompt}
            onChange={(e) => setConfig({ initialPrompt: e.target.value })}
            className="bg-input border-border text-text-primary focus:border-accent w-full resize-y rounded-md border px-3 py-2.5 text-[13px] leading-snug outline-none"
          />
        </section>

        <section className="mb-6">
          <label className={labelClass}>
            Script{" "}
            <span className="text-text-dim font-normal tracking-normal normal-case">
              (optional)
            </span>
          </label>
          <input
            ref={scriptInputRef}
            type="file"
            accept=".txt,.srt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setConfig({ scriptFile: f });
            }}
          />
          {config.scriptFile ? (
            <div className="bg-input border-border flex items-center gap-3 rounded-md border px-3.5 py-2.5">
              <span className="text-text-primary flex-1 overflow-hidden text-[13px] text-ellipsis whitespace-nowrap">
                {config.scriptFile.name}
              </span>
              <button
                onClick={() => setConfig({ scriptFile: null })}
                className="text-text-muted hover:text-red border-0 bg-transparent text-xs"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => scriptInputRef.current?.click()}
              className="border-border text-text-muted hover:border-accent-light hover:text-accent-light w-full rounded-md border border-dashed bg-transparent py-3.5 text-[13px] transition-colors"
            >
              Choose a .txt or .srt file
            </button>
          )}
          <p className={hintClass}>
            If provided, captions will be aligned against the script and
            mismatches highlighted.
          </p>
        </section>

        <section className="mb-6">
          <label className="flex cursor-pointer items-center gap-2.5 select-none">
            <input
              type="checkbox"
              checked={config.denoise}
              onChange={(e) => setConfig({ denoise: e.target.checked })}
              className="h-4 w-4 cursor-pointer"
              style={{ accentColor: "var(--color-accent)" }}
            />
            <span className="text-text-primary text-sm font-semibold">
              Denoise audio (Demucs vocal isolation)
            </span>
          </label>
          <p className={hintClass}>
            Recommended only for noisy videos. Isolates vocals before
            transcription. Significantly slower; downloads a ~250 MB model on
            first use.
          </p>
        </section>

        <section className="mb-6">
          <label className="flex cursor-pointer items-center gap-2.5 select-none">
            <input
              type="checkbox"
              checked={config.diarization.enabled}
              onChange={(e) => setDiarization({ enabled: e.target.checked })}
              className="h-4 w-4 cursor-pointer"
              style={{ accentColor: "var(--color-accent)" }}
            />
            <span className="text-text-primary text-sm font-semibold">
              Identify speakers (diarization)
            </span>
          </label>

          {config.diarization.enabled && (
            <div className="bg-input border-border mt-3.5 rounded-md border px-4 py-3.5">
              <div className="mb-3">
                <label
                  htmlFor="hf-token"
                  className="text-text-muted mb-1.5 block text-xs"
                >
                  HuggingFace token
                </label>
                <input
                  id="hf-token"
                  type="password"
                  placeholder="hf_xxx…"
                  value={config.diarization.hfToken}
                  onChange={(e) => onHfTokenChange(e.target.value)}
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
              <p className={hintClass + " mb-3"}>
                Required by pyannote. Get a token at{" "}
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-light underline"
                >
                  huggingface.co/settings/tokens
                </a>{" "}
                and accept the model terms at{" "}
                <a
                  href="https://huggingface.co/pyannote/speaker-diarization-3.1"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-light underline"
                >
                  pyannote/speaker-diarization-3.1
                </a>
                .
              </p>

              <div>
                <label
                  htmlFor="num-speakers"
                  className="text-text-muted mb-1.5 block text-xs"
                >
                  Number of speakers{" "}
                  <span className="text-text-dim">(auto-detect if blank)</span>
                </label>
                <input
                  id="num-speakers"
                  type="number"
                  min={1}
                  max={20}
                  placeholder="auto"
                  value={config.diarization.numSpeakers ?? ""}
                  onChange={(e) => {
                    const v =
                      e.target.value === ""
                        ? null
                        : Math.max(1, parseInt(e.target.value, 10));
                    setDiarization({
                      numSpeakers: Number.isNaN(v as number) ? null : v,
                    });
                  }}
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </section>

        <div className="border-border mt-8 flex justify-end gap-2.5 border-t pt-5">
          <button
            onClick={onCancel}
            className="border-border text-text-muted hover:border-text-muted hover:text-text-primary rounded-md border bg-transparent px-5 py-2.5 text-[13px] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            className="bg-accent border-accent hover:bg-accent-light hover:border-accent-light rounded-md border px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {isReTranscribing ? "Re-transcribe" : "Start transcription"}
          </button>
        </div>
      </div>
    </div>
  );
}
