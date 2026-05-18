import { useEffect, useRef, useState } from 'react'
import {
  uploadVideo, transcribeJob, alignScript, streamProgress, errMsg, checkCapabilities,
  type StreamHandle,
} from '../api'
import { useCaptionStore } from '../stores/captionStore'
import { findByFingerprint, fingerprint, clearProject, type SavedProject } from '../utils/projects'
import { pushModelDownloadToasts } from '../utils/toasts'

export type RestoreChoice = 'restore' | 'new' | 'cancel'

export interface RestorePrompt {
  prior: SavedProject
  fingerprintMatches: boolean  // false = file differs from saved fingerprint
  resolve: (choice: RestoreChoice) => void
}

// Upload → configure → transcribe → align pipeline as a single hook.
export function useVideoPipeline() {
  const progressStreamRef = useRef<StreamHandle | null>(null)
  const state = useCaptionStore((s) => s.state)
  const setState = useCaptionStore((s) => s.setState)
  const setVideoFile = useCaptionStore((s) => s.setVideoFile)
  const setJobId = useCaptionStore((s) => s.setJobId)
  const setCaptions = useCaptionStore((s) => s.setCaptions)
  const setSpeakers = useCaptionStore((s) => s.setSpeakers)
  const setAlignment = useCaptionStore((s) => s.setAlignment)
  const setError = useCaptionStore((s) => s.setError)
  const setTranscribeProgress = useCaptionStore((s) => s.setTranscribeProgress)
  const setTranscribeStage = useCaptionStore((s) => s.setTranscribeStage)
  const reset = useCaptionStore((s) => s.reset)

  const [restorePrompt, setRestorePrompt] = useState<RestorePrompt | null>(null)
  const [reTranscribePromptOpen, setReTranscribePromptOpen] = useState(false)
  const reTranscribeResolverRef = useRef<((ok: boolean) => void) | null>(null)

  const askRestore = (
    prior: SavedProject,
    fingerprintMatches: boolean,
  ): Promise<RestoreChoice> =>
    new Promise((resolve) => {
      setRestorePrompt({
        prior,
        fingerprintMatches,
        resolve: (choice) => {
          setRestorePrompt(null)
          resolve(choice)
        },
      })
    })

  // Close the SSE stream on unmount and when leaving the busy states.
  useEffect(() => () => { progressStreamRef.current?.close() }, [])
  useEffect(() => {
    if (state === 'idle') progressStreamRef.current?.close()
  }, [state])

  // Restore captions immediately, then re-upload in the background to mint
  // a fresh jobId for render / re-align.
  const restoreFromSaved = (file: File, prior: SavedProject) => {
    setVideoFile(file)

    const store = useCaptionStore.getState()
    store.loadSavedSession({
      captions: prior.captions,
      speakers: prior.speakers,
      speakerColors: prior.speakerColors,
      speakerOutlineColors: prior.speakerOutlineColors ?? {},
      speakerOutlineThickness: prior.speakerOutlineThickness ?? {},
      speakerFontFamilies: prior.speakerFontFamilies ?? {},
      speakerFontSizes: prior.speakerFontSizes ?? {},
      speakerPosX: prior.speakerPosX ?? {},
      speakerPosY: prior.speakerPosY ?? {},
      speakerAlign: prior.speakerAlign ?? {},
      alignment: prior.alignment,
      captionStyle: prior.captionStyle,
      name: prior.name ?? null,
    })
    setState('editing')

    // Once the upload completes, delete the prior saved project so auto-save
    // writes a fresh one under the new jobId.
    uploadVideo(file)
      .then((id) => {
        setJobId(id)
        clearProject(prior.jobId)
      })
      .catch((err) => setError(`Background upload failed: ${errMsg(err)}`))
  }

  const startFreshUpload = async (file: File) => {
    setVideoFile(file)
    setState('uploading')
    try {
      const id = await uploadVideo(file)
      setJobId(id)
      setState('configuring')
    } catch (err) {
      setError(`Upload failed: ${errMsg(err)}`)
      setState('idle')
    }
  }

  const handleVideoFile = async (file: File) => {
    reset()

    const prior = findByFingerprint(fingerprint(file))
    if (prior) {
      const choice = await askRestore(prior, true)
      if (choice === 'cancel') return
      if (choice === 'restore') {
        restoreFromSaved(file, prior)
        return
      }
      // choice === 'new' falls through to fresh upload
    }

    await startFreshUpload(file)
  }

  // Recent-projects entry point: user picks a card, then picks a file.
  const continueProjectWithFile = async (prior: SavedProject, file: File) => {
    reset()
    const fp = fingerprint(file)
    if (fp !== prior.videoFingerprint) {
      const choice = await askRestore(prior, false)
      if (choice === 'cancel') {
        setState('idle')
        return
      }
      if (choice === 'new') {
        await startFreshUpload(file)
        return
      }
    }
    restoreFromSaved(file, prior)
  }

  const handleStartTranscription = async () => {
    const { jobId, transcribeConfig } = useCaptionStore.getState()
    if (!jobId) return

    if (transcribeConfig.diarization.enabled || transcribeConfig.denoise) {
      try {
        const caps = await checkCapabilities()
        pushModelDownloadToasts(caps, {
          diarize: transcribeConfig.diarization.enabled,
          denoise: transcribeConfig.denoise,
        })
      } catch {
        // Non-fatal: the toast hint is just an affordance.
      }
    }

    setState('transcribing')
    setTranscribeStage(null)
    try {
      progressStreamRef.current = streamProgress(`/transcribe-progress/${jobId}`, {
        onProgress: setTranscribeProgress,
        onStage: setTranscribeStage,
      })

      const { captions, speakers } = await transcribeJob(jobId, {
        modelSize: transcribeConfig.modelSize,
        initialPrompt: transcribeConfig.initialPrompt,
        diarization: transcribeConfig.diarization,
        denoise: transcribeConfig.denoise,
      })
      progressStreamRef.current?.close()
      setCaptions(captions)
      setSpeakers(speakers)
      setTranscribeProgress(100)

      if (transcribeConfig.scriptFile) {
        try {
          const results = await alignScript(jobId, transcribeConfig.scriptFile)
          setAlignment(results)
        } catch (e) {
          setError(`Script alignment failed: ${errMsg(e)}`)
        }
      }

      useCaptionStore.getState().setReTranscribing(false)
      setState('editing')
    } catch (err) {
      progressStreamRef.current?.close()
      setError(`Transcription failed: ${errMsg(err)}`)
      setState('configuring')
    }
  }

  const askReTranscribe = (): Promise<boolean> =>
    new Promise((resolve) => {
      reTranscribeResolverRef.current = resolve
      setReTranscribePromptOpen(true)
    })

  const resolveReTranscribe = (ok: boolean) => {
    reTranscribeResolverRef.current?.(ok)
    reTranscribeResolverRef.current = null
    setReTranscribePromptOpen(false)
  }

  // Re-transcribe an in-progress project. Confirms before clobbering edits,
  // then routes through the existing ConfigScreen → transcribe pipeline.
  const handleReTranscribe = async () => {
    const store = useCaptionStore.getState()
    if (!store.jobId) return

    const hasEdits =
      store.captions.length > 0 ||
      store.speakers.length > 0 ||
      store.history.length > 0
    if (hasEdits) {
      const ok = await askReTranscribe()
      if (!ok) return
    }

    store.setReTranscribing(true)
    store.setAlignment([])
    setTranscribeProgress(0)
    setState('configuring')
  }

  return {
    handleVideoFile, handleStartTranscription, continueProjectWithFile, handleReTranscribe,
    restorePrompt,
    reTranscribePromptOpen,
    resolveReTranscribe,
  }
}
