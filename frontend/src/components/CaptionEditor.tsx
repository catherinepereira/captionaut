import { useEffect, useMemo, useRef, useState } from 'react'
import { useCaptionStore, type Caption } from '../stores/captionStore'
import styles from './CaptionEditor.module.css'

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return `${m}:${sec}`
}

function parseTime(str: string): number | null {
  const parts = str.split(':')
  if (parts.length !== 2) return null
  const m = parseFloat(parts[0])
  const s = parseFloat(parts[1])
  if (isNaN(m) || isNaN(s)) return null
  return m * 60 + s
}

interface RowProps {
  caption: Caption
  isActive: boolean
  isMismatched: boolean
  speakerColor: string | null
  onSeek: (t: number) => void
  registerRef: (id: number, el: HTMLDivElement | null) => void
}

function CaptionRow({ caption, isActive, isMismatched, speakerColor, onSeek, registerRef }: RowProps) {
  const updateCaption = useCaptionStore((s) => s.updateCaption)
  const [editingField, setEditingField] = useState<'text' | 'start' | 'end' | null>(null)
  const [draft, setDraft] = useState('')

  const startEdit = (field: 'text' | 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingField(field)
    if (field === 'text') setDraft(caption.text)
    else if (field === 'start') setDraft(formatTime(caption.start))
    else setDraft(formatTime(caption.end))
  }

  const commit = () => {
    if (editingField === 'text') {
      updateCaption(caption.id, { text: draft })
    } else if (editingField === 'start' || editingField === 'end') {
      const t = parseTime(draft)
      if (t !== null) updateCaption(caption.id, { [editingField]: t })
    }
    setEditingField(null)
  }

  const rowClass = [
    styles.row,
    isActive ? styles.active : '',
    isMismatched ? styles.mismatch : '',
  ].join(' ')

  const rowStyle =
    speakerColor && !isActive && !isMismatched
      ? { borderLeft: `3px solid ${speakerColor}` }
      : undefined

  return (
    <div
      ref={(el) => registerRef(caption.id, el)}
      className={rowClass}
      style={rowStyle}
      onClick={() => editingField === null && onSeek(caption.start)}
      title="Click to jump to this caption"
    >
      {caption.speaker && (
        <span
          className={styles.speakerTag}
          style={{ color: speakerColor ?? undefined }}
        >
          {caption.speaker}
        </span>
      )}
      <div className={styles.times}>
        {editingField === 'start' ? (
          <input
            className={styles.timeInput}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
        ) : (
          <span className={styles.time} onClick={(e) => startEdit('start', e)}>
            {formatTime(caption.start)}
          </span>
        )}
        <span className={styles.arrow}>→</span>
        {editingField === 'end' ? (
          <input
            className={styles.timeInput}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
        ) : (
          <span className={styles.time} onClick={(e) => startEdit('end', e)}>
            {formatTime(caption.end)}
          </span>
        )}
      </div>

      {editingField === 'text' ? (
        <textarea
          className={styles.textArea}
          value={draft}
          autoFocus
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() } }}
        />
      ) : (
        <p className={styles.text} onClick={(e) => startEdit('text', e)}>
          {caption.text}
        </p>
      )}

      {isMismatched && <span className={styles.badge}>mismatch</span>}
    </div>
  )
}

export function CaptionEditor() {
  const captions = useCaptionStore((s) => s.captions)
  const currentTime = useCaptionStore((s) => s.currentTime)
  const alignment = useCaptionStore((s) => s.alignment)
  const speakerColors = useCaptionStore((s) => s.speakerColors)
  const requestSeek = useCaptionStore((s) => s.requestSeek)
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const registerRef = (id: number, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el)
    else rowRefs.current.delete(id)
  }

  const mismatchedIds = useMemo(
    () => new Set(alignment.filter((a) => !a.matched).map((a) => a.caption_id)),
    [alignment],
  )

  const activeId = useMemo(
    () => captions.find((c) => currentTime >= c.start && currentTime <= c.end)?.id,
    [captions, currentTime],
  )

  useEffect(() => {
    if (activeId == null) return
    rowRefs.current.get(activeId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeId])

  if (captions.length === 0) return null

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <span className={styles.title}>Captions</span>
        <span className={styles.count}>{captions.length} segments</span>
      </div>
      <div className={styles.list}>
        {captions.map((cap) => (
          <CaptionRow
            key={cap.id}
            caption={cap}
            isActive={cap.id === activeId}
            isMismatched={mismatchedIds.has(cap.id)}
            speakerColor={cap.speaker ? speakerColors[cap.speaker] ?? null : null}
            onSeek={requestSeek}
            registerRef={registerRef}
          />
        ))}
      </div>
    </div>
  )
}
