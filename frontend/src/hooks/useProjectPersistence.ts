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
  const speakerOutlineColors = useCaptionStore((s) => s.speakerOutlineColors)
  const speakerOutlineThickness = useCaptionStore((s) => s.speakerOutlineThickness)
  const speakerFontFamilies = useCaptionStore((s) => s.speakerFontFamilies)
  const speakerFontSizes = useCaptionStore((s) => s.speakerFontSizes)
  const speakerPosX = useCaptionStore((s) => s.speakerPosX)
  const speakerPosY = useCaptionStore((s) => s.speakerPosY)
  const speakerAlign = useCaptionStore((s) => s.speakerAlign)
  const alignment = useCaptionStore((s) => s.alignment)
  const captionStyle = useCaptionStore((s) => s.captionStyle)
  const thumbnail = useCaptionStore((s) => s.thumbnail)

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
      speakerOutlineColors,
      speakerOutlineThickness,
      speakerFontFamilies,
      speakerFontSizes,
      speakerPosX,
      speakerPosY,
      speakerAlign,
      alignment,
      captionStyle,
      thumbnail: thumbnail ?? undefined,
    })
  }, [
    jobId, videoFile, captions, speakers,
    speakerColors, speakerOutlineColors, speakerOutlineThickness,
    speakerFontFamilies, speakerFontSizes,
    speakerPosX, speakerPosY, speakerAlign,
    alignment, captionStyle, thumbnail,
  ])
}
