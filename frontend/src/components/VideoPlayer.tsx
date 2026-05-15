import { useEffect, useMemo, useRef } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import { findActiveCaption } from '../utils/captions'
import styles from './VideoPlayer.module.css'

export function VideoPlayer() {
  const videoUrl = useCaptionStore((s) => s.videoUrl)
  const captions = useCaptionStore((s) => s.captions)
  const currentTime = useCaptionStore((s) => s.currentTime)
  const seekRequest = useCaptionStore((s) => s.seekRequest)
  const setCurrentTime = useCaptionStore((s) => s.setCurrentTime)
  const setVideoDuration = useCaptionStore((s) => s.setVideoDuration)
  const requestSeek = useCaptionStore((s) => s.requestSeek)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    const onTime = () => setCurrentTime(vid.currentTime)
    const onMeta = () => setVideoDuration(vid.duration || 0)
    vid.addEventListener('timeupdate', onTime)
    vid.addEventListener('loadedmetadata', onMeta)
    return () => {
      vid.removeEventListener('timeupdate', onTime)
      vid.removeEventListener('loadedmetadata', onMeta)
    }
  }, [setCurrentTime, setVideoDuration])

  useEffect(() => {
    const vid = videoRef.current
    if (!vid || seekRequest == null) return
    vid.currentTime = seekRequest
    requestSeek(null)
  }, [seekRequest, requestSeek])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const vid = videoRef.current
      if (!vid) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          if (vid.paused) vid.play(); else vid.pause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          vid.currentTime = Math.max(0, vid.currentTime - 1)
          break
        case 'ArrowRight':
          e.preventDefault()
          vid.currentTime = Math.min(vid.duration || Infinity, vid.currentTime + 1)
          break
        case 'j':
          e.preventDefault()
          vid.currentTime = Math.max(0, vid.currentTime - 5)
          break
        case 'l':
          e.preventDefault()
          vid.currentTime = Math.min(vid.duration || Infinity, vid.currentTime + 5)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const speakerColors = useCaptionStore((s) => s.speakerColors)
  const activeCaption = useMemo(
    () => findActiveCaption(captions, currentTime),
    [captions, currentTime],
  )

  if (!videoUrl) return null

  const overlayColor =
    activeCaption?.color_override ??
    (activeCaption?.speaker ? speakerColors[activeCaption.speaker] : null) ??
    null
  const overlayOutline = activeCaption?.outline_override ?? null

  const overlayStyle: React.CSSProperties = {}
  if (overlayColor) overlayStyle.color = overlayColor
  if (overlayOutline) {
    overlayStyle.textShadow = `0 0 2px ${overlayOutline}, 0 0 4px ${overlayOutline}`
  }

  return (
    <div className={styles.wrapper}>
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className={styles.video}
      />
      {activeCaption && (
        <div className={styles.overlay} style={overlayStyle}>
          {activeCaption.text}
        </div>
      )}
    </div>
  )
}
