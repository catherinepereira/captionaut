import { useEffect, useRef } from 'react'
import {
  uploadVideo, transcribeJob, alignScript, streamProgress, errMsg,
  type StreamHandle,
} from '../api'
import { useCaptionStore } from '../stores/captionStore'
import { findByFingerprint, fingerprint, clearProject } from '../utils/projects'
import { fetchCapabilities, pushModelDownloadToasts } from '../utils/toasts'

/**
 * The upload → configure → transcribe → align pipeline as a single hook.
 *
 * Exposes two callbacks (`handleVideoFile`, `handleStartTranscription`) that
 * App.tsx wires into the DropZone and ConfigScreen.
 */
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

  const handleVideoFile = async (file: File) => {
    reset()
    setVideoFile(file)

    // If we've seen this exact file before, offer to restore the prior session
    // instead of re-uploading and re-transcribing.
    const prior = findByFingerprint(fingerprint(file))
    if (prior) {
      const confirmed = window.confirm(
        `Restore your previous work on "${prior.videoFileName}"?\n\n` +
        `Saved ${new Date(prior.savedAt).toLocaleString()}\n` +
        `${prior.captions.length} captions${prior.speakers.length ? `, ${prior.speakers.length} speakers` : ''}.`,
      )
      if (confirmed) {
        setCaptions(prior.captions)
        setSpeakers(prior.speakers)
        // setSpeakers builds a default palette; override with user's saved colors.
        Object.entries(prior.speakerColors).forEach(([label, color]) => {
          useCaptionStore.getState().setSpeakerColor(label, color)
        })
        useCaptionStore.getState().setAlignment(prior.alignment)
        useCaptionStore.getState().setBurnStyle(prior.burnStyle)
        setState('editing')
        // Re-upload silently in the background so burn-in / re-align work.
        // The fresh jobId replaces the prior one once upload completes.
        uploadVideo(file)
          .then((id) => {
            setJobId(id)
            clearProject(prior.jobId)
          })
          .catch((err) => setError(`Background upload failed: ${errMsg(err)}`))
        return
      }
    }

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

  const handleStartTranscription = async () => {
    const { jobId, transcribeConfig } = useCaptionStore.getState()
    if (!jobId) return

    // Surface a toast if pyannote / Demucs models need to download.
    if (transcribeConfig.diarization.enabled || transcribeConfig.denoise) {
      try {
        const caps = await fetchCapabilities()
        pushModelDownloadToasts(caps, {
          diarize: transcribeConfig.diarization.enabled,
          denoise: transcribeConfig.denoise,
        })
      } catch {
        // Toast hint failure is non-fatal; transcription proceeds anyway.
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

  return { handleVideoFile, handleStartTranscription }
}
