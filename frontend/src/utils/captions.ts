import type { Caption } from '../stores/captionStore'

/**
 * Find the caption active at time `t`. Binary-searches assuming captions are
 * sorted by `start` and non-overlapping (true for raw Whisper output).
 */
export function findActiveCaption(captions: Caption[], t: number): Caption | undefined {
  let lo = 0
  let hi = captions.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const c = captions[mid]
    if (t < c.start) hi = mid - 1
    else if (t > c.end) lo = mid + 1
    else return c
  }
  return undefined
}

export function findActiveCaptionId(captions: Caption[], t: number): number | undefined {
  return findActiveCaption(captions, t)?.id
}

/** Reassign monotonically-increasing IDs starting from 0. */
export function renumber(captions: Caption[]): Caption[] {
  return captions.map((c, i) => (c.id === i ? c : { ...c, id: i }))
}

/** Shift selected captions' start + end by `deltaSeconds`, clamped to ≥0. */
export function shiftSelected(
  captions: Caption[],
  selected: Set<number>,
  deltaSeconds: number,
): Caption[] {
  if (selected.size === 0) return captions
  return captions.map((c) => {
    if (!selected.has(c.id)) return c
    const start = Math.max(0, c.start + deltaSeconds)
    const end = Math.max(start, c.end + deltaSeconds)
    return { ...c, start, end }
  })
}

/** Merge selected captions into one. Text joined with space, span = min(start)..max(end). */
export function mergeSelected(captions: Caption[], selected: Set<number>): Caption[] {
  if (selected.size < 2) return captions
  const picked = captions.filter((c) => selected.has(c.id))
  const start = Math.min(...picked.map((c) => c.start))
  const end = Math.max(...picked.map((c) => c.end))
  // All merged captions need the same speaker label to keep it; otherwise drop it
  const speakers = new Set(picked.map((c) => c.speaker ?? null))
  const speaker = speakers.size === 1 ? picked[0].speaker ?? null : null
  const merged: Caption = {
    id: 0, // renumber() fixes this
    start,
    end,
    text: picked.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim(),
    speaker,
  }
  const firstSelectedIndex = captions.findIndex((c) => selected.has(c.id))
  const kept = captions.filter((c) => !selected.has(c.id))
  kept.splice(firstSelectedIndex, 0, merged)
  return renumber(kept)
}

/** Split a caption at `t` seconds. Second half inherits the speaker. */
export function splitAt(captions: Caption[], captionId: number, t: number): Caption[] {
  const idx = captions.findIndex((c) => c.id === captionId)
  if (idx < 0) return captions
  const c = captions[idx]
  if (t <= c.start || t >= c.end) return captions
  const left: Caption = { ...c, end: t }
  const right: Caption = { ...c, id: c.id + 1, start: t }
  const next = [...captions.slice(0, idx), left, right, ...captions.slice(idx + 1)]
  return renumber(next)
}

/** Drop selected captions and renumber. */
export function deleteSelected(captions: Caption[], selected: Set<number>): Caption[] {
  if (selected.size === 0) return captions
  return renumber(captions.filter((c) => !selected.has(c.id)))
}
