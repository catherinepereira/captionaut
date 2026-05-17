import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCaptionStore, type Caption, type BurnStyle } from '../stores/captionStore'
import { alignScript, errMsg } from '../api'
import {
  findActiveCaptionId, shiftSelected, mergeSelected, splitAt, deleteSelected,
  insertCaptionAt,
} from '../utils/captions'
import { StyleEditorPopover, type StyleValues } from './StyleEditorPopover'
import { PaletteIcon } from './icons'
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
  speakerOutlineColor: string | null
  speakerOutlineThickness: number | null
  speakerFontFamily: string | null
  speakerFontSize: number | null
  effectiveTextColor: string | null
  speakers: string[]
  burnStyle: BurnStyle
  autoEditText: boolean
  onSeek: (t: number) => void
  onToggleSelect: (id: number, e: React.MouseEvent) => void
  onAutoEditConsumed: () => void
  registerRef: (id: number, el: HTMLDivElement | null) => void
}

const CaptionRow = memo(function CaptionRow({
  caption, isActive, isMismatched, isSelected, speakerColor, speakerOutlineColor,
  speakerOutlineThickness, speakerFontFamily, speakerFontSize,
  effectiveTextColor,
  speakers, burnStyle, autoEditText,
  onSeek, onToggleSelect, onAutoEditConsumed, registerRef,
}: RowProps) {
  const updateCaption = useCaptionStore((s) => s.updateCaption)
  const [editingField, setEditingField] = useState<'text' | 'start' | 'end' | null>(null)
  const [draft, setDraft] = useState('')
  const [styleOpen, setStyleOpen] = useState(false)

  useEffect(() => {
    if (autoEditText) {
      setEditingField('text')
      setDraft(caption.text)
      onAutoEditConsumed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEditText])

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

  const onKey = (e: React.KeyboardEvent) => {
    if (editingField !== null) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSeek(caption.start)
    }
  }

  return (
    <div
      ref={(el) => registerRef(caption.id, el)}
      className={rowClass}
      style={rowStyle}
      role="button"
      tabIndex={0}
      aria-label={`Caption ${caption.id + 1} at ${formatTime(caption.start)}. Press Enter to jump.`}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => editingField === null && onSeek(caption.start)}
      onKeyDown={onKey}
      title="Click to jump to this caption · checkbox to select for bulk ops"
    >
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={isSelected}
        aria-label={`Select caption ${caption.id + 1}`}
        onClick={(e) => { e.stopPropagation(); onToggleSelect(caption.id, e) }}
        onChange={() => { /* handled in onClick to access shiftKey */ }}
      />
      <div className={styles.metaRow} onClick={(e) => e.stopPropagation()}>
        <select
          className={styles.speakerSelect}
          value={caption.speaker ?? ''}
          aria-label="Speaker"
          style={caption.speaker && speakerColor ? { color: speakerColor } : undefined}
          onChange={(e) => {
            const v = e.target.value
            updateCaption(caption.id, { speaker: v === '' ? null : v })
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">No speaker</option>
          {speakers.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className={styles.styleSlot} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.paletteBtn}
          aria-label="Edit caption style"
          title="Edit style"
          onClick={(e) => { e.stopPropagation(); setStyleOpen((v) => !v) }}
        >
          <PaletteIcon />
        </button>

        {styleOpen && (
          <StyleEditorPopover
            variant="caption"
            values={{
              color: caption.color_override ?? null,
              outlineColor: caption.outline_override ?? null,
              outlineThickness: caption.outline_thickness ?? null,
              fontFamily: caption.font_family ?? null,
              fontSize: caption.font_size ?? null,
            }}
            defaults={{
              color: speakerColor ?? burnStyle.color,
              outlineColor: speakerOutlineColor ?? burnStyle.outlineColor,
              outlineThickness: speakerOutlineThickness ?? burnStyle.outlineThickness,
              fontFamily: speakerFontFamily ?? burnStyle.fontFamily,
              fontSize: speakerFontSize ?? burnStyle.fontSize,
            }}
            onChange={(patch: Partial<StyleValues>) => {
              const next: Parameters<typeof updateCaption>[1] = {}
              if ('color' in patch) next.color_override = patch.color
              if ('outlineColor' in patch) next.outline_override = patch.outlineColor
              if ('outlineThickness' in patch) next.outline_thickness = patch.outlineThickness
              if ('fontFamily' in patch) next.font_family = patch.fontFamily
              if ('fontSize' in patch) next.font_size = patch.fontSize
              updateCaption(caption.id, next)
            }}
            onClear={() => {
              updateCaption(caption.id, {
                color_override: null,
                outline_override: null,
                outline_thickness: null,
                font_family: null,
                font_size: null,
              })
              setStyleOpen(false)
            }}
            onClose={() => setStyleOpen(false)}
          />
        )}
      </div>

      <div className={styles.times}>
        {editingField === 'start' ? (
          <input
            className={styles.timeInput}
            value={draft}
            autoFocus
            aria-label="Start time"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
        ) : (
          <span
            className={styles.time}
            role="button"
            tabIndex={0}
            aria-label={`Edit start time, currently ${formatTime(caption.start)}`}
            onClick={(e) => startEdit('start', e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.stopPropagation(); startEdit('start', e as unknown as React.MouseEvent) }
            }}
          >
            {formatTime(caption.start)}
          </span>
        )}
        <span className={styles.arrow} aria-hidden="true">→</span>
        {editingField === 'end' ? (
          <input
            className={styles.timeInput}
            value={draft}
            autoFocus
            aria-label="End time"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
          />
        ) : (
          <span
            className={styles.time}
            role="button"
            tabIndex={0}
            aria-label={`Edit end time, currently ${formatTime(caption.end)}`}
            onClick={(e) => startEdit('end', e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.stopPropagation(); startEdit('end', e as unknown as React.MouseEvent) }
            }}
          >
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
          aria-label="Caption text"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() } }}
        />
      ) : (
        <p
          className={styles.text}
          role="button"
          tabIndex={0}
          aria-label={`Edit caption text: ${caption.text}`}
          style={effectiveTextColor ? { color: effectiveTextColor } : undefined}
          onClick={(e) => startEdit('text', e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.stopPropagation(); startEdit('text', e as unknown as React.MouseEvent) }
          }}
        >
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
  const videoDuration = useCaptionStore((s) => s.videoDuration)
  const alignment = useCaptionStore((s) => s.alignment)
  const speakers = useCaptionStore((s) => s.speakers)
  const speakerColors = useCaptionStore((s) => s.speakerColors)
  const speakerOutlineColors = useCaptionStore((s) => s.speakerOutlineColors)
  const speakerOutlineThickness = useCaptionStore((s) => s.speakerOutlineThickness)
  const speakerFontFamilies = useCaptionStore((s) => s.speakerFontFamilies)
  const speakerFontSizes = useCaptionStore((s) => s.speakerFontSizes)
  const burnStyle = useCaptionStore((s) => s.burnStyle)
  const requestSeek = useCaptionStore((s) => s.requestSeek)
  const undo = useCaptionStore((s) => s.undo)
  const redo = useCaptionStore((s) => s.redo)
  const replaceCaptions = useCaptionStore((s) => s.replaceCaptions)
  const historyDepth = useCaptionStore((s) => s.history.length)
  const futureDepth = useCaptionStore((s) => s.future.length)
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const lastSelectedRef = useRef<number | null>(null)
  const [autoEditId, setAutoEditId] = useState<number | null>(null)
  const [bulkSpeakerOpen, setBulkSpeakerOpen] = useState(false)

  useEffect(() => {
    if (!bulkSpeakerOpen) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest(`.${styles.bulkSpeaker}`)) setBulkSpeakerOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [bulkSpeakerOpen])

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

  // External requests (e.g. clicking a timeline block) scroll the row in too.
  const scrollToCaptionRequest = useCaptionStore((s) => s.scrollToCaptionRequest)
  const requestScrollToCaption = useCaptionStore((s) => s.requestScrollToCaption)
  useEffect(() => {
    if (scrollToCaptionRequest == null) return
    rowRefs.current.get(scrollToCaptionRequest)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    requestScrollToCaption(null)
  }, [scrollToCaptionRequest, requestScrollToCaption])

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

  const bulkAssignSpeaker = (label: string | null) => {
    if (selected.size === 0) return
    const next = captions.map((c) =>
      selected.has(c.id) && c.speaker !== label ? { ...c, speaker: label } : c,
    )
    if (next === captions) return
    replaceCaptions(next)
    setBulkSpeakerOpen(false)
  }

  const addAtPlayhead = () => {
    const result = insertCaptionAt(captions, currentTime, {
      maxEnd: videoDuration > 0 ? videoDuration : undefined,
    })
    replaceCaptions(result.captions)
    setAutoEditId(result.newId)
    // Scroll the new row into view on the next frame so it's visible to edit.
    requestAnimationFrame(() => {
      rowRefs.current.get(result.newId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

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
          className={styles.addBtn}
          onClick={addAtPlayhead}
          title="Add a new caption at the current playhead"
        >
          + Add
        </button>
        <button
          className={styles.historyBtn}
          onClick={undo}
          disabled={historyDepth === 0}
          title="Undo (Ctrl/⌘+Z)"
          aria-label="Undo"
        ><span aria-hidden="true">↶</span></button>
        <button
          className={styles.historyBtn}
          onClick={redo}
          disabled={futureDepth === 0}
          title="Redo (Ctrl/⌘+Shift+Z)"
          aria-label="Redo"
        ><span aria-hidden="true">↷</span></button>
      </div>

      {hasSelection && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selected.size} selected</span>
          <div className={styles.bulkSpacer} />
          <button className={styles.bulkBtn} onClick={() => shiftBy(-0.1)} title="Shift -100ms">−100ms</button>
          <button className={styles.bulkBtn} onClick={() => shiftBy(+0.1)} title="Shift +100ms">+100ms</button>
          <button className={styles.bulkBtn} onClick={mergeNow} disabled={selected.size < 2} title="Merge selected into one caption">Merge</button>
          <button className={styles.bulkBtn} onClick={splitAtPlayhead} disabled={!canSplit} title="Split selected caption at the playhead">Split</button>
          <div className={styles.bulkSpeaker}>
            <button
              className={styles.bulkBtn}
              onClick={() => setBulkSpeakerOpen((v) => !v)}
              title="Assign all selected captions to a speaker"
            >
              Speaker ▾
            </button>
            {bulkSpeakerOpen && (
              <div className={styles.bulkSpeakerMenu} role="menu">
                <button
                  className={styles.bulkSpeakerItem}
                  onClick={() => bulkAssignSpeaker(null)}
                >
                  No speaker
                </button>
                {speakers.map((s) => (
                  <button
                    key={s}
                    className={styles.bulkSpeakerItem}
                    style={{ color: speakerColors[s] ?? undefined }}
                    onClick={() => bulkAssignSpeaker(s)}
                  >
                    {s}
                  </button>
                ))}
                {speakers.length === 0 && (
                  <span className={styles.bulkSpeakerEmpty}>
                    Add a speaker first via the Speakers panel.
                  </span>
                )}
              </div>
            )}
          </div>
          <button className={`${styles.bulkBtn} ${styles.bulkDanger}`} onClick={deleteNow} title="Delete selected">Delete</button>
          <button
            className={styles.bulkClose}
            onClick={clearSelection}
            title="Clear selection"
            aria-label="Clear selection"
          ><span aria-hidden="true">×</span></button>
        </div>
      )}

      <div className={styles.list} role="list" aria-label="Captions">
        {captions.length === 0 && (
          <p className={styles.emptyHint}>
            No captions yet. Press <strong>+ Add</strong> to create one at the current playhead.
          </p>
        )}
        {captions.map((cap) => {
          const sp = cap.speaker
          const speakerColor = sp ? speakerColors[sp] ?? null : null
          const speakerOutlineColor = sp ? speakerOutlineColors[sp] ?? null : null
          const speakerOutline = sp ? speakerOutlineThickness[sp] ?? null : null
          const speakerFontFamily = sp ? speakerFontFamilies[sp] ?? null : null
          const speakerFontSize = sp ? speakerFontSizes[sp] ?? null : null

          const effectiveTextColor = cap.color_override ?? speakerColor

          return (
            <CaptionRow
              key={cap.id}
              caption={cap}
              isActive={cap.id === activeId}
              isMismatched={mismatchedIds.has(cap.id)}
              isSelected={selected.has(cap.id)}
              speakerColor={speakerColor}
              speakerOutlineColor={speakerOutlineColor}
              speakerOutlineThickness={speakerOutline}
              speakerFontFamily={speakerFontFamily}
              speakerFontSize={speakerFontSize}
              effectiveTextColor={effectiveTextColor}
              speakers={speakers}
              burnStyle={burnStyle}
              autoEditText={autoEditId === cap.id}
              onSeek={requestSeek}
              onToggleSelect={handleToggleSelect}
              onAutoEditConsumed={() => setAutoEditId(null)}
              registerRef={registerRef}
            />
          )
        })}
      </div>
    </div>
  )
}
