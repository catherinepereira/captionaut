import { useEffect } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import { saveProject, fingerprint } from '../utils/projects'

// Auto-save the project to localStorage whenever editable state changes.
// Only saves once captions actually exist (i.e. transcription has finished).
export function useProjectPersistence(): void {
  const jobId = useCaptionStore((s) => s.jobId)
  const videoFile = useCaptionStore((s) => s.videoFile)
  const captions = useCaptionStore((s) => s.captions)
  const speakers = useCaptionStore((s) => s.speakers)
  const speakerColors = useCaptionStore((s) => s.speakerColors)
  const alignment = useCaptionStore((s) => s.alignment)
  const burnStyle = useCaptionStore((s) => s.burnStyle)

  useEffect(() => {
    if (!jobId || captions.length === 0 || !videoFile) return
    saveProject({
      jobId,
      videoFileName: videoFile.name,
      videoFingerprint: fingerprint(videoFile),
      savedAt: Date.now(),
      captions,
      speakers,
      speakerColors,
      alignment,
      burnStyle,
    })
  }, [jobId, videoFile, captions, speakers, speakerColors, alignment, burnStyle])
}
