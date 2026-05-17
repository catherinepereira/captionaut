import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCaptionStore, type Caption } from '../stores/captionStore'
import { findActiveCaptionId } from '../utils/captions'
import styles from './CaptionTimeline.module.css'

interface HoverState {
  caption: Caption
  x: number
  y: number
}

const ZOOM_LEVELS = [1, 2, 4, 8] as const
type ZoomLevel = (typeof ZOOM_LEVELS)[number]

export function CaptionTimeline() {
  const captions = useCaptionStore((s) => s.captions)
  const videoDuration = useCaptionStore((s) => s.videoDuration)
  const currentTime = useCaptionStore((s) => s.currentTime)
  const speakerColors = useCaptionStore((s) => s.speakerColors)
  const captionStyle = useCaptionStore((s) => s.captionStyle)
  const requestSeek = useCaptionStore((s) => s.requestSeek)
  const requestScrollToCaption = useCaptionStore((s) => s.requestScrollToCaption)

  const [zoom, setZoom] = useState<ZoomLevel>(1)
  const [hover, setHover] = useState<HoverState | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Fall back to "last caption end" if metadata hasn't fired yet.
  const totalDuration = useMemo(() => {
    if (videoDuration > 0) return videoDuration
    if (captions.length === 0) return 0
    return Math.max(...captions.map((c) => c.end))
  }, [videoDuration, captions])

  const activeId = useMemo(
    () => findActiveCaptionId(captions, currentTime),
    [captions, currentTime],
  )

  // Keep the playhead in view when zoomed in.
  useEffect(() => {
    if (zoom === 1) return
    const el = scrollRef.current
    if (!el || totalDuration <= 0) return
    const innerWidth = el.scrollWidth
    const playheadX = (currentTime / totalDuration) * innerWidth
    const margin = el.clientWidth * 0.3
    if (playheadX < el.scrollLeft + margin || playheadX > el.scrollLeft + el.clientWidth - margin) {
      el.scrollTo({ left: playheadX - el.clientWidth / 2, behavior: 'smooth' })
    }
  }, [currentTime, zoom, totalDuration])

  if (captions.length === 0 || totalDuration <= 0) return null

  const handleBlockClick = (start: number, id: number) => {
    requestSeek(start)
    requestScrollToCaption(id)
  }

  const zoomIn = () => {
    const i = ZOOM_LEVELS.indexOf(zoom)
    if (i < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[i + 1])
  }
  const zoomOut = () => {
    const i = ZOOM_LEVELS.indexOf(zoom)
    if (i > 0) setZoom(ZOOM_LEVELS[i - 1])
  }

  const playheadPct = (currentTime / totalDuration) * 100

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>Timeline</span>
        <span className={styles.duration}>{formatDuration(totalDuration)}</span>
        <div className={styles.spacer} />
        <button
          className={styles.zoomBtn}
          onClick={zoomOut}
          disabled={zoom === ZOOM_LEVELS[0]}
          aria-label="Zoom out"
          title="Zoom out"
        >−</button>
        <span className={styles.zoomLabel}>{zoom}×</span>
        <button
          className={styles.zoomBtn}
          onClick={zoomIn}
          disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
          aria-label="Zoom in"
          title="Zoom in"
        >+</button>
      </div>

      <div
        ref={scrollRef}
        className={styles.scrollContainer}
        onClick={(e) => {
          // Click on empty timeline area seeks to that time.
          if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains(styles.inner)) return
          const el = scrollRef.current
          if (!el || totalDuration <= 0) return
          const rect = el.getBoundingClientRect()
          const x = e.clientX - rect.left + el.scrollLeft
          const innerWidth = el.scrollWidth
          const t = (x / innerWidth) * totalDuration
          requestSeek(Math.max(0, Math.min(totalDuration, t)))
        }}
      >
        <div className={styles.inner} style={{ width: `${zoom * 100}%` }}>
          <Ticks totalDuration={totalDuration} zoom={zoom} />
          {captions.map((cap) => {
            const leftPct = (cap.start / totalDuration) * 100
            const widthPct = ((cap.end - cap.start) / totalDuration) * 100
            const color = cap.color_override
              ?? (cap.speaker ? speakerColors[cap.speaker] : null)
              ?? captionStyle.color
            const isActive = cap.id === activeId
            return (
              <button
                key={cap.id}
                type="button"
                className={`${styles.block} ${isActive ? styles.blockActive : ''}`}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  background: color,
                }}
                aria-label={`Caption at ${formatDuration(cap.start)}: ${cap.text}`}
                onMouseEnter={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  setHover({ caption: cap, x: r.left + r.width / 2, y: r.top })
                }}
                onMouseLeave={() => setHover((h) => (h && h.caption.id === cap.id ? null : h))}
                onClick={(e) => {
                  e.stopPropagation()
                  setHover(null)
                  handleBlockClick(cap.start, cap.id)
                }}
              />
            )
          })}
          <div
            className={styles.playhead}
            style={{ left: `${playheadPct}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
      {hover && <BlockTooltip hover={hover} />}
    </div>
  )
}

function BlockTooltip({ hover }: { hover: HoverState }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: hover.x,
    top: hover.y,
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const margin = 8
    let left = hover.x - rect.width / 2
    let top = hover.y - rect.height - margin
    if (top < margin) top = hover.y + 16
    left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, left))
    setPos({ left, top })
  }, [hover])

  return createPortal(
    <div ref={ref} className={styles.tooltip} role="tooltip" style={{ left: pos.left, top: pos.top }}>
      <div className={styles.tooltipTime}>
        {formatDuration(hover.caption.start)} → {formatDuration(hover.caption.end)}
      </div>
      <div className={styles.tooltipText}>{hover.caption.text}</div>
    </div>,
    document.body,
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

function pickTickStep(visibleSeconds: number): number {
  // Aim for roughly 8 labeled ticks across the visible window.
  const target = visibleSeconds / 8
  for (const step of TICK_STEPS) {
    if (step >= target) return step
  }
  return TICK_STEPS[TICK_STEPS.length - 1]
}

function Ticks({ totalDuration, zoom }: { totalDuration: number; zoom: number }) {
  const visible = totalDuration / zoom
  const step = pickTickStep(visible)
  const minor = step / 5
  const ticks: { t: number; major: boolean }[] = []
  for (let t = 0; t <= totalDuration + 1e-6; t += minor) {
    const isMajor = Math.abs(t / step - Math.round(t / step)) < 1e-6
    ticks.push({ t, major: isMajor })
  }
  return (
    <div className={styles.ticks} aria-hidden="true">
      {ticks.map(({ t, major }, i) => {
        const leftPct = (t / totalDuration) * 100
        return (
          <div
            key={i}
            className={`${styles.tick} ${major ? styles.tickMajor : ''}`}
            style={{ left: `${leftPct}%`, height: major ? '100%' : '50%' }}
          >
            {major && <span className={styles.tickLabel}>{formatDuration(t)}</span>}
          </div>
        )
      })}
    </div>
  )
}
