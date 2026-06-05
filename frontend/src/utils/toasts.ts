import type { Capabilities } from "../api";
import { useCaptionStore } from "../stores/captionStore";

interface PendingStages {
  diarize: boolean;
  denoise: boolean;
}

// Without these toasts the app appears to freeze on the first run with
// diarization or denoise enabled while pyannote / Demucs pull weights.
export function pushModelDownloadToasts(
  caps: Capabilities,
  stages: PendingStages,
): void {
  const push = useCaptionStore.getState().pushToast;

  if (stages.diarize && !caps.pyannote_cached) {
    push(
      "info",
      "Downloading speaker identification model (~50 MB). This only happens once.",
    );
  }
  if (stages.denoise && !caps.demucs_cached) {
    push(
      "info",
      "Downloading audio denoising model (~250 MB). This only happens once.",
    );
  }
}
