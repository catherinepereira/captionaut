import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCaptionStore, type Caption } from '../stores/captionStore'
import { alignScript, errMsg } from '../api'
import {
  findActiveCaptionId, shiftSelected, mergeSelected, splitAt, deleteSelected,
} from '../utils/captions'
import styles from './CaptionEditor.module.css'

const SCRIPT_EXT_RE = /\.(txt|srt)$/i

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
  isSelected: boolean
  speakerColor: string | null
  onSeek: (t: number) => void
  onToggleSelect: (id: number, e: React.MouseEvent) => void
  registerRef: (id: number, el: HTMLDivElement | null) => void
}

const CaptionRow = memo(function CaptionRow({
  caption, isActive, isMismatched, isSelected, speakerColor,
  onSeek, onToggleSelect, registerRef,
}: RowProps) {
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
    isSelected ? styles.selected : '',
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
      title="Click to jump to this caption · checkbox to select for bulk ops"
    >
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={isSelected}
        onClick={(e) => { e.stopPropagation(); onToggleSelect(caption.id, e) }}
        onChange={() => { /* handled in onClick to access shiftKey */ }}
      />
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
})

export function CaptionEditor() {
  const captions = useCaptionStore((s) => s.captions)
  const currentTime = useCaptionStore((s) => s.currentTime)
  const alignment = useCaptionStore((s) => s.alignment)
  const speakerColors = useCaptionStore((s) => s.speakerColors)
  const requestSeek = useCaptionStore((s) => s.requestSeek)
  const undo = useCaptionStore((s) => s.undo)
  const redo = useCaptionStore((s) => s.redo)
  const replaceCaptions = useCaptionStore((s) => s.replaceCaptions)
  const historyDepth = useCaptionStore((s) => s.history.length)
  const futureDepth = useCaptionStore((s) => s.future.length)
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const lastSelectedRef = useRef<number | null>(null)

  const jobId = useCaptionStore((s) => s.jobId)
  const setAlignment = useCaptionStore((s) => s.setAlignment)
  const setError = useCaptionStore((s) => s.setError)
  const [dragOver, setDragOver] = useState(false)

  const handleScriptDrop = async (file: File) => {
    if (!SCRIPT_EXT_RE.test(file.name)) {
      setError('Script must be a .txt or .srt file')
      return
    }
    if (!jobId) {
      setError('Re-upload the video to align a script.')
      return
    }
    try {
      setAlignment(await alignScript(jobId, file))
    } catch (e) {
      setError(`Script alignment failed: ${errMsg(e)}`)
    }
  }

  // Stable identity so memo(CaptionRow) doesn't re-render on every parent render.
  const registerRef = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el)
    else rowRefs.current.delete(id)
  }, [])

  const mismatchedIds = useMemo(
    () => new Set(alignment.filter((a) => !a.matched).map((a) => a.caption_id)),
    [alignment],
  )

  const activeId = useMemo(
    () => findActiveCaptionId(captions, currentTime),
    [captions, currentTime],
  )

  useEffect(() => {
    if (activeId == null) return
    rowRefs.current.get(activeId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeId])

  // Selection survives caption edits but is dropped when the entire captions
  // array is replaced (transcribe / reset / undo to pre-edit state).
  useEffect(() => {
    if (selected.size === 0) return
    setSelected((s) => {
      const next = new Set<number>()
      const valid = new Set(captions.map((c) => c.id))
      s.forEach((id) => { if (valid.has(id)) next.add(id) })
      return next.size === s.size ? s : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captions])

  const handleToggleSelect = useCallback((id: number, e: React.MouseEvent) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (e.shiftKey && lastSelectedRef.current != null) {
        const anchor = lastSelectedRef.current
        const a = Math.min(anchor, id)
        const b = Math.max(anchor, id)
        for (let i = a; i <= b; i++) next.add(i)
      } else {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      lastSelectedRef.current = id
      return next
    })
  }, [])

  const clearSelection = () => setSelected(new Set())

  const shiftBy = (deltaSeconds: number) => {
    replaceCaptions(shiftSelected(captions, selected, deltaSeconds))
  }

  const mergeNow = () => {
    if (selected.size < 2) return
    replaceCaptions(mergeSelected(captions, selected))
    clearSelection()
  }

  const splitAtPlayhead = () => {
    if (selected.size !== 1) return
    const id = selected.values().next().value
    if (id == null) return
    replaceCaptions(splitAt(captions, id, currentTime))
    clearSelection()
  }

  const deleteNow = () => {
    if (selected.size === 0) return
    replaceCaptions(deleteSelected(captions, selected))
    clearSelection()
  }

  if (captions.length === 0) return null

  const hasSelection = selected.size > 0
  const splitTargetId = selected.size === 1 ? selected.values().next().value : null
  const canSplit = splitTargetId != null && (() => {
    const c = captions.find((c) => c.id === splitTargetId)
    return !!c && currentTime > c.start && currentTime < c.end
  })()

  return (
    <div
      className={`${styles.editor} ${dragOver ? styles.dropTarget : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragOver(true)
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleScriptDrop(file)
      }}
    >
      {dragOver && (
        <div className={styles.dropOverlay}>Drop a .txt or .srt to align it with these captions</div>
      )}
      <div className={styles.header}>
        <span className={styles.title}>Captions</span>
        <span className={styles.count}>{captions.length} segments</span>
        <div className={styles.headerSpacer} />
        <button
          className={styles.historyBtn}
          onClick={undo}
          disabled={historyDepth === 0}
          title="Undo (Ctrl/⌘+Z)"
        >↶</button>
        <button
          className={styles.historyBtn}
          onClick={redo}
          disabled={futureDepth === 0}
          title="Redo (Ctrl/⌘+Shift+Z)"
        >↷</button>
      </div>

      {hasSelection && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selected.size} selected</span>
          <div className={styles.bulkSpacer} />
          <button className={styles.bulkBtn} onClick={() => shiftBy(-0.1)} title="Shift -100ms">−100ms</button>
          <button className={styles.bulkBtn} onClick={() => shiftBy(+0.1)} title="Shift +100ms">+100ms</button>
          <button className={styles.bulkBtn} onClick={mergeNow} disabled={selected.size < 2} title="Merge selected into one caption">Merge</button>
          <button className={styles.bulkBtn} onClick={splitAtPlayhead} disabled={!canSplit} title="Split selected caption at the playhead">Split</button>
          <button className={`${styles.bulkBtn} ${styles.bulkDanger}`} onClick={deleteNow} title="Delete selected">Delete</button>
          <button className={styles.bulkClose} onClick={clearSelection} title="Clear selection">×</button>
        </div>
      )}

      <div className={styles.list}>
        {captions.map((cap) => (
          <CaptionRow
            key={cap.id}
            caption={cap}
            isActive={cap.id === activeId}
            isMismatched={mismatchedIds.has(cap.id)}
            isSelected={selected.has(cap.id)}
            speakerColor={cap.speaker ? speakerColors[cap.speaker] ?? null : null}
            onSeek={requestSeek}
            onToggleSelect={handleToggleSelect}
            registerRef={registerRef}
          />
        ))}
      </div>
    </div>
  )
}
