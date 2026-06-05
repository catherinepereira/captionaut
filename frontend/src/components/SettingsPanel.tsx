import { useEffect, useId, useState } from "react";
import {
  loadSettings,
  saveSettings,
  type UserSettings,
} from "../utils/settings";
import { type ModelSize } from "../stores/captionStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MODEL_SIZES: ModelSize[] = ["tiny", "base", "small", "medium", "large"];

export function SettingsPanel({ open, onClose }: Props) {
  const [draft, setDraft] = useState<UserSettings>(() => loadSettings());
  const titleId = useId();
  const modelId = useId();
  const tokenId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const save = () => {
    saveSettings(draft);
    onClose();
  };

  const labelClass =
    "block text-xs font-semibold tracking-[0.06em] uppercase text-accent-light mb-2";
  const inputClass =
    "w-full bg-input border border-border text-text-primary text-[13px] px-2.5 py-2 rounded-md outline-none focus:border-accent";

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
        className="bg-card border-border max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-lg border p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id={titleId} className="text-text-primary text-base font-bold">
            Settings
          </h3>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-text-muted hover:text-text-primary cursor-pointer border-0 bg-transparent px-1.5 text-2xl leading-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <section className="mb-5">
          <label htmlFor={modelId} className={labelClass}>
            Default model
          </label>
          <select
            id={modelId}
            value={draft.defaultModelSize}
            onChange={(e) =>
              setDraft({
                ...draft,
                defaultModelSize: e.target.value as ModelSize,
              })
            }
            className={inputClass + " cursor-pointer"}
          >
            {MODEL_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </section>

        <section className="mb-5">
          <label htmlFor={tokenId} className={labelClass}>
            HuggingFace token
          </label>
          <input
            id={tokenId}
            type="password"
            placeholder="hf_xxx…"
            value={draft.hfToken}
            onChange={(e) => setDraft({ ...draft, hfToken: e.target.value })}
            autoComplete="off"
            className={inputClass}
          />
          <p className="text-text-dim mt-2 text-xs">
            Used for pyannote speaker identification.
          </p>
        </section>

        <div className="border-border flex justify-end gap-2 border-t pt-4">
          <button
            onClick={onClose}
            className="border-border text-text-muted hover:border-text-muted hover:text-text-primary rounded-md border bg-transparent px-5 py-2 text-[13px] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="bg-accent border-accent hover:bg-accent-light hover:border-accent-light rounded-md border px-5 py-2 text-sm font-semibold text-white transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
