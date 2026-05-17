import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCaptionStore, type Caption, type CaptionStyle } from '../stores/captionStore'
import { alignScript, errMsg } from '../api'
import {
  findActiveCaptionId, shiftSelected, mergeSelected, splitAt, deleteSelected,
  insertCaptionAt,
} from '../utils/captions'
import { StyleEditorPopover, type StyleValues } from './StyleEditorPopover'
import { PaletteIcon } from './icons'

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
  speakerPosX: number | null
  speakerPosY: number | null
  speakerAlign: 'left' | 'center' | 'right' | null
  effectiveTextColor: string | null
  speakers: string[]
  captionStyle: CaptionStyle
  autoEditText: boolean
  onSeek: (t: number) => void
  onToggleSelect: (id: number, e: React.MouseEvent) => void
  onAutoEditConsumed: () => void
  registerRef: (id: number, el: HTMLDivElement | null) => void
}

const iconBtn =
  'inline-flex items-center justify-center w-[26px] h-[26px] bg-transparent border border-border text-text-muted rounded-md cursor-pointer p-0 hover:border-accent-light hover:text-accent-light focus-visible:border-accent-light focus-visible:text-accent-light'

const CaptionRow = memo(function CaptionRow({
  caption, isActive, isMismatched, isSelected, speakerColor, speakerOutlineColor,
  speakerOutlineThickness, speakerFontFamily, speakerFontSize,
  speakerPosX, speakerPosY, speakerAlign,
  effectiveTextColor,
  speakers, captionStyle, autoEditText,
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

  const rowBaseClass = 'relative px-[18px] py-3 border-b border-border cursor-text transition-colors hover:bg-input focus-visible:bg-input focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2'
  const rowStateClass =
    isActive
      ? 'bg-[#1e1a40] border-l-[3px] border-l-accent'
      : isMismatched
        ? 'border-l-[3px] border-l-red'
        : isSelected
          ? 'bg-[rgba(107,140,179,0.08)]'
          : ''
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

  const timeClass = 'text-[11px] font-mono text-text-muted px-1.5 py-0.5 bg-bg rounded cursor-pointer hover:text-accent-light focus-visible:text-accent-light focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2'

  return (
    <div
      ref={(el) => registerRef(caption.id, el)}
      className={`${rowBaseClass} ${rowStateClass}`}
      style={rowStyle}
      role="button"
      tabIndex={0}
      aria-label={`Caption ${caption.id + 1} at ${formatTime(caption.start)}. Press Enter to jump.`}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => editingField === null && onSeek(caption.start)}
      onKeyDown={onKey}
      title="Click to jump to this caption · use the select button for bulk ops"
    >
      <div className="absolute top-3 right-3.5 flex gap-1.5 items-center" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <button
            type="button"
            className={iconBtn}
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
                posX: caption.pos_x_override ?? null,
                posY: caption.pos_y_override ?? null,
                align: caption.align_override ?? null,
              }}
              defaults={{
                color: speakerColor ?? captionStyle.color,
                outlineColor: speakerOutlineColor ?? captionStyle.outlineColor,
                outlineThickness: speakerOutlineThickness ?? captionStyle.outlineThickness,
                fontFamily: speakerFontFamily ?? captionStyle.fontFamily,
                fontSize: speakerFontSize ?? captionStyle.fontSize,
                posX: speakerPosX ?? captionStyle.posX,
                posY: speakerPosY ?? captionStyle.posY,
                align: speakerAlign ?? captionStyle.align,
              }}
              onChange={(patch: Partial<StyleValues>) => {
                const next: Parameters<typeof updateCaption>[1] = {}
                if ('color' in patch) next.color_override = patch.color
                if ('outlineColor' in patch) next.outline_override = patch.outlineColor
                if ('outlineThickness' in patch) next.outline_thickness = patch.outlineThickness
                if ('fontFamily' in patch) next.font_family = patch.fontFamily
                if ('fontSize' in patch) next.font_size = patch.fontSize
                if ('posX' in patch) next.pos_x_override = patch.posX
                if ('posY' in patch) next.pos_y_override = patch.posY
                if ('align' in patch) next.align_override = patch.align
                updateCaption(caption.id, next)
              }}
              onClear={() => {
                updateCaption(caption.id, {
                  color_override: null,
                  outline_override: null,
                  outline_thickness: null,
                  font_family: null,
                  font_size: null,
                  pos_x_override: null,
                  pos_y_override: null,
                  align_override: null,
                })
                setStyleOpen(false)
              }}
              onClose={() => setStyleOpen(false)}
            />
          )}
        </div>
        <button
          type="button"
          aria-pressed={isSelected}
          title={isSelected ? 'Deselect' : 'Select'}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(caption.id, e) }}
          className={`inline-flex items-center justify-center h-[26px] px-2.5 border rounded-md text-[11px] font-medium transition-colors ${
            isSelected
              ? 'bg-accent border-accent text-white hover:bg-accent-light hover:border-accent-light'
              : 'bg-transparent border-border text-text-muted hover:border-accent-light hover:text-accent-light'
          }`}
        >
          {isSelected ? 'Selected' : 'Select'}
        </button>
      </div>
      <div className="flex items-center gap-1.5 mb-1.5 relative" onClick={(e) => e.stopPropagation()}>
        <select
          value={caption.speaker ?? ''}
          aria-label="Speaker"
          className="bg-bg border border-border rounded text-[11px] font-mono text-text-muted px-1.5 py-0.5 cursor-pointer max-w-[140px] hover:border-accent-light"
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

      <div className="flex items-center gap-1.5 mb-1.5">
        {editingField === 'start' ? (
          <input
            value={draft}
            autoFocus
            aria-label="Start time"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="text-[11px] font-mono text-text-primary bg-bg border border-accent rounded px-1.5 py-0.5 w-[72px] outline-none"
          />
        ) : (
          <span
            role="button"
            tabIndex={0}
            className={timeClass}
            aria-label={`Edit start time, currently ${formatTime(caption.start)}`}
            onClick={(e) => startEdit('start', e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.stopPropagation(); startEdit('start', e as unknown as React.MouseEvent) }
            }}
          >
            {formatTime(caption.start)}
          </span>
        )}
        <span className="text-[11px] text-text-dim" aria-hidden="true">→</span>
        {editingField === 'end' ? (
          <input
            value={draft}
            autoFocus
            aria-label="End time"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="text-[11px] font-mono text-text-primary bg-bg border border-accent rounded px-1.5 py-0.5 w-[72px] outline-none"
          />
        ) : (
          <span
            role="button"
            tabIndex={0}
            className={timeClass}
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
          value={draft}
          autoFocus
          rows={2}
          aria-label="Caption text"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() } }}
          className="w-full text-sm text-text-primary bg-bg border border-accent rounded-md px-2 py-1.5 resize-y outline-none leading-snug"
        />
      ) : (
        <p
          role="button"
          tabIndex={0}
          aria-label={`Edit caption text: ${caption.text}`}
          style={effectiveTextColor ? { color: effectiveTextColor } : undefined}
          onClick={(e) => startEdit('text', e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.stopPropagation(); startEdit('text', e as unknown as React.MouseEvent) }
          }}
          className="text-sm text-text-primary leading-snug cursor-text hover:text-accent-light focus-visible:text-accent-light focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 focus-visible:rounded"
        >
          {caption.text}
        </p>
      )}

      {isMismatched && (
        <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide text-red bg-red/10 border border-red/30 rounded px-1.5 py-0.5">
          mismatch
        </span>
      )}
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
  const speakerPosX = useCaptionStore((s) => s.speakerPosX)
  const speakerPosY = useCaptionStore((s) => s.speakerPosY)
  const speakerAlign = useCaptionStore((s) => s.speakerAlign)
  const captionStyle = useCaptionStore((s) => s.captionStyle)
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
  const bulkSpeakerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bulkSpeakerOpen) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!bulkSpeakerRef.current?.contains(target)) setBulkSpeakerOpen(false)
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

  const allSelected = selected.size === captions.length && captions.length > 0
  const headerBtn =
    'bg-transparent border border-border text-text-muted text-sm w-[26px] h-[26px] rounded-md cursor-pointer ml-1 leading-none hover:enabled:border-accent-light hover:enabled:text-accent-light disabled:opacity-[0.35] disabled:cursor-not-allowed'
  const headerTextBtn =
    'bg-transparent border border-border text-text-muted text-xs h-[26px] px-2 rounded-md cursor-pointer mr-1.5 leading-none hover:enabled:border-accent-light hover:enabled:text-accent-light disabled:opacity-[0.35] disabled:cursor-not-allowed'
  const bulkBtn =
    'bg-transparent border border-border text-text-primary text-[11px] font-medium px-2 py-1 rounded-sm cursor-pointer hover:enabled:border-accent-light hover:enabled:text-accent-light disabled:opacity-[0.35] disabled:cursor-not-allowed'

  return (
    <div
      className={`bg-card border ${dragOver ? 'border-accent' : 'border-border'} rounded-md overflow-hidden flex flex-col relative max-h-[calc(100vh-480px)]`}
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
        <div className="absolute inset-0 bg-accent/20 flex items-center justify-center text-text-primary text-sm font-semibold z-10 pointer-events-none rounded-md">
          Drop a .txt or .srt to align it with these captions
        </div>
      )}
      <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-border">
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-light">Captions</span>
        <span className="text-xs text-text-dim">{captions.length} segments</span>
        <div className="flex-1" />
        <button
          className={headerTextBtn}
          onClick={() => allSelected ? clearSelection() : setSelected(new Set(captions.map((c) => c.id)))}
          disabled={captions.length === 0}
          title={allSelected ? 'Deselect all' : 'Select all'}
          aria-label={allSelected ? 'Deselect all' : 'Select all'}
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
        <button
          className="bg-accent border border-accent text-white text-xs font-semibold h-[26px] px-3 rounded-md cursor-pointer mr-1.5 leading-none hover:bg-accent-light hover:border-accent-light"
          onClick={addAtPlayhead}
          title="Add a new caption at the current playhead"
        >
          + Add
        </button>
        <button
          className={headerBtn}
          onClick={undo}
          disabled={historyDepth === 0}
          title="Undo (Ctrl/⌘+Z)"
          aria-label="Undo"
        ><span aria-hidden="true">↶</span></button>
        <button
          className={headerBtn}
          onClick={redo}
          disabled={futureDepth === 0}
          title="Redo (Ctrl/⌘+Shift+Z)"
          aria-label="Redo"
        ><span aria-hidden="true">↷</span></button>
      </div>

      {hasSelection && (
        <div className="flex items-center gap-1.5 px-3.5 py-2 bg-input border-b border-border">
          <span className="text-xs font-semibold text-accent-light">{selected.size} selected</span>
          <div className="flex-1" />
          <button className={bulkBtn} onClick={() => shiftBy(-0.1)} title="Shift -100ms">−100ms</button>
          <button className={bulkBtn} onClick={() => shiftBy(+0.1)} title="Shift +100ms">+100ms</button>
          <button className={bulkBtn} onClick={mergeNow} disabled={selected.size < 2} title="Merge selected into one caption">Merge</button>
          <button className={bulkBtn} onClick={splitAtPlayhead} disabled={!canSplit} title="Split selected caption at the playhead">Split</button>
          <div ref={bulkSpeakerRef} className="relative">
            <button
              className={bulkBtn}
              onClick={() => setBulkSpeakerOpen((v) => !v)}
              title="Assign all selected captions to a speaker"
            >
              Speaker ▾
            </button>
            {bulkSpeakerOpen && (
              <div
                role="menu"
                className="absolute top-[calc(100%+4px)] right-0 bg-card border border-border rounded-md py-1 min-w-[160px] z-[5] shadow-[0_8px_20px_rgba(0,0,0,0.4)] flex flex-col"
              >
                <button
                  className="bg-transparent border-0 text-left px-3 py-1.5 text-xs text-text-primary cursor-pointer font-mono hover:bg-input"
                  onClick={() => bulkAssignSpeaker(null)}
                >
                  No speaker
                </button>
                {speakers.map((s) => (
                  <button
                    key={s}
                    className="bg-transparent border-0 text-left px-3 py-1.5 text-xs cursor-pointer font-mono hover:bg-input"
                    style={{ color: speakerColors[s] ?? undefined }}
                    onClick={() => bulkAssignSpeaker(s)}
                  >
                    {s}
                  </button>
                ))}
                {speakers.length === 0 && (
                  <span className="px-3 py-2 text-[11px] text-text-dim">
                    Add a speaker first via the Speakers panel.
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            className={`${bulkBtn} text-red hover:enabled:border-red hover:enabled:text-red hover:enabled:bg-red/10`}
            onClick={deleteNow}
            title="Delete selected"
          >
            Delete
          </button>
          <button
            onClick={clearSelection}
            title="Clear selection"
            aria-label="Clear selection"
            className="bg-transparent border-0 text-text-muted text-base w-5 h-5 cursor-pointer leading-none p-0 hover:text-text-primary"
          ><span aria-hidden="true">×</span></button>
        </div>
      )}

      <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-sm" role="list" aria-label="Captions">
        {captions.length === 0 && (
          <p className="px-[18px] py-8 text-[13px] text-text-dim text-center">
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
          const sPosX = sp ? speakerPosX[sp] ?? null : null
          const sPosY = sp ? speakerPosY[sp] ?? null : null
          const sAlign = sp ? speakerAlign[sp] ?? null : null

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
              speakerPosX={sPosX}
              speakerPosY={sPosY}
              speakerAlign={sAlign}
              effectiveTextColor={effectiveTextColor}
              speakers={speakers}
              captionStyle={captionStyle}
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
