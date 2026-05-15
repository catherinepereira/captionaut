import { checkCapabilities, type Capabilities } from '../api'
import { useCaptionStore } from '../stores/captionStore'

export async function fetchCapabilities(): Promise<Capabilities> {
  return checkCapabilities()
}

interface PendingStages {
  diarize: boolean
  denoise: boolean
}

/**
 * Surface a "downloading model" toast for any stage whose model isn't cached
 * yet. Without this the app appears to freeze while pyannote / Demucs pull
 * weights from the network on first run.
 */
export function pushModelDownloadToasts(caps: Capabilities, stages: PendingStages): void {
  const push = useCaptionStore.getState().pushToast

  if (stages.diarize && !caps.pyannote_cached) {
    push(
      'info',
      'Downloading speaker identification model (~50 MB). This only happens once.',
    )
  }
  if (stages.denoise && !caps.demucs_cached) {
    push(
      'info',
      'Downloading audio denoising model (~250 MB). This only happens once.',
    )
  }
}
