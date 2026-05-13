import { useRef, useEffect } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import styles from './VideoPlayer.module.css'

export function VideoPlayer() {
  const videoUrl = useCaptionStore((s) => s.videoUrl)
  const captions = useCaptionStore((s) => s.captions)
  const currentTime = useCaptionStore((s) => s.currentTime)
  const seekRequest = useCaptionStore((s) => s.seekRequest)
  const setCurrentTime = useCaptionStore((s) => s.setCurrentTime)
  const requestSeek = useCaptionStore((s) => s.requestSeek)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    const onTime = () => setCurrentTime(vid.currentTime)
    vid.addEventListener('timeupdate', onTime)
    return () => vid.removeEventListener('timeupdate', onTime)
  }, [setCurrentTime])

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

  const activeCaption = captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end
  )

  if (!videoUrl) return null

  return (
    <div className={styles.wrapper}>
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className={styles.video}
      />
      {activeCaption && (
        <div className={styles.overlay}>{activeCaption.text}</div>
      )}
    </div>
  )
}
