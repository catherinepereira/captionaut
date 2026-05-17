import { useEffect, useRef } from 'react'
import {
  uploadVideo, transcribeJob, alignScript, streamProgress, errMsg, checkCapabilities,
  type StreamHandle,
} from '../api'
import { useCaptionStore } from '../stores/captionStore'
import { findByFingerprint, fingerprint, clearProject, type SavedProject } from '../utils/projects'
import { pushModelDownloadToasts } from '../utils/toasts'

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
  const reset = useCaptionStore((s) => s.reset)

  // Close the SSE stream on unmount and when leaving the busy states.
  useEffect(() => () => { progressStreamRef.current?.close() }, [])
  useEffect(() => {
    if (state === 'idle') progressStreamRef.current?.close()
  }, [state])

  // Restore captions immediately, then re-upload in the background to mint
  // a fresh jobId for burn / re-align.
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
      alignment: prior.alignment,
      burnStyle: prior.burnStyle,
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

  const handleVideoFile = async (file: File) => {
    reset()

    // If we've seen this exact file before, offer to restore the prior session.
    const prior = findByFingerprint(fingerprint(file))
    if (prior) {
      const confirmed = window.confirm(
        `Restore your previous work on "${prior.videoFileName}"?\n\n` +
        `Saved ${new Date(prior.savedAt).toLocaleString()}\n` +
        `${prior.captions.length} captions${prior.speakers.length ? `, ${prior.speakers.length} speakers` : ''}.`,
      )
      if (confirmed) {
        restoreFromSaved(file, prior)
        return
      }
    }

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

  // Recent-projects entry point: user picks a card, then picks a file.
  // Confirm if the file's fingerprint differs from the saved one.
  const continueProjectWithFile = (prior: SavedProject, file: File) => {
    reset()
    const fp = fingerprint(file)
    if (fp !== prior.videoFingerprint) {
      const confirmed = window.confirm(
        `This file doesn't match "${prior.videoFileName}" (saved size differs).\n\n` +
        `Use it anyway? Captions will be restored, but they may not line up if the video is different.`,
      )
      if (!confirmed) {
        setState('idle')
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
    try {
      progressStreamRef.current = streamProgress(`/transcribe-progress/${jobId}`, {
        onProgress: setTranscribeProgress,
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

      setState('editing')
    } catch (err) {
      progressStreamRef.current?.close()
      setError(`Transcription failed: ${errMsg(err)}`)
      setState('configuring')
    }
  }

  return { handleVideoFile, handleStartTranscription, continueProjectWithFile }
}
