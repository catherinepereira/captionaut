import type { Caption } from "../stores/captionStore";

/**
 * Find the caption active at time `t`. Binary-searches assuming captions are
 * sorted by `start` and non-overlapping (true for raw Whisper output).
 */
export function findActiveCaption(
  captions: Caption[],
  t: number,
): Caption | undefined {
  let lo = 0;
  let hi = captions.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const c = captions[mid];
    if (t < c.start) hi = mid - 1;
    else if (t > c.end) lo = mid + 1;
    else return c;
  }
  return undefined;
}

export function findActiveCaptionId(
  captions: Caption[],
  t: number,
): number | undefined {
  return findActiveCaption(captions, t)?.id;
}

/** Reassign monotonically-increasing IDs starting from 0. */
export function renumber(captions: Caption[]): Caption[] {
  return captions.map((c, i) => (c.id === i ? c : { ...c, id: i }));
}

/** Shift selected captions' start + end by `deltaSeconds`, clamped to ≥0. */
export function shiftSelected(
  captions: Caption[],
  selected: Set<number>,
  deltaSeconds: number,
): Caption[] {
  if (selected.size === 0) return captions;
  return captions.map((c) => {
    if (!selected.has(c.id)) return c;
    const start = Math.max(0, c.start + deltaSeconds);
    const end = Math.max(start, c.end + deltaSeconds);
    return { ...c, start, end };
  });
}

/** Merge selected captions into one. Text joined with space, span = min(start)..max(end). */
export function mergeSelected(
  captions: Caption[],
  selected: Set<number>,
): Caption[] {
  if (selected.size < 2) return captions;
  const picked = captions.filter((c) => selected.has(c.id));
  const start = Math.min(...picked.map((c) => c.start));
  const end = Math.max(...picked.map((c) => c.end));
  // Keep the speaker label only if every merged caption agrees on it.
  const speakers = new Set(picked.map((c) => c.speaker ?? null));
  const speaker = speakers.size === 1 ? (picked[0].speaker ?? null) : null;
  const merged: Caption = {
    id: 0, // renumber() fixes this
    start,
    end,
    text: picked
      .map((c) => c.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
    speaker,
  };
  const firstSelectedIndex = captions.findIndex((c) => selected.has(c.id));
  const kept = captions.filter((c) => !selected.has(c.id));
  kept.splice(firstSelectedIndex, 0, merged);
  return renumber(kept);
}

/** Split a caption at `t` seconds. Second half inherits the speaker. */
export function splitAt(
  captions: Caption[],
  captionId: number,
  t: number,
): Caption[] {
  const idx = captions.findIndex((c) => c.id === captionId);
  if (idx < 0) return captions;
  const c = captions[idx];
  if (t <= c.start || t >= c.end) return captions;
  const left: Caption = { ...c, end: t };
  const right: Caption = { ...c, id: c.id + 1, start: t };
  const next = [
    ...captions.slice(0, idx),
    left,
    right,
    ...captions.slice(idx + 1),
  ];
  return renumber(next);
}

/** Drop selected captions and renumber. */
export function deleteSelected(
  captions: Caption[],
  selected: Set<number>,
): Caption[] {
  if (selected.size === 0) return captions;
  return renumber(captions.filter((c) => !selected.has(c.id)));
}

const DEFAULT_NEW_CAPTION_DURATION = 2;

/**
 * Insert a new empty caption around time `t`, returning the new list, the
 * id of the inserted caption, and the resolved start/end. The new caption is
 * placed so it doesn't overlap any existing one: if `t` falls inside an
 * existing caption, the new caption snaps to start at that caption's end.
 * Duration is trimmed if it would overlap the next caption or exceed `maxEnd`.
 */
export function insertCaptionAt(
  captions: Caption[],
  t: number,
  opts: { duration?: number; maxEnd?: number } = {},
): { captions: Caption[]; newId: number } {
  const duration = opts.duration ?? DEFAULT_NEW_CAPTION_DURATION;
  const maxEnd = opts.maxEnd ?? Infinity;

  // If t falls inside an existing caption, slide the new one to the gap after.
  const containing = captions.find((c) => t >= c.start && t < c.end);
  let start = Math.max(0, containing ? containing.end : t);

  // Snap to the next caption's start if the window would overlap it.
  const next = captions.find((c) => c.start > start);
  const ceiling = Math.min(maxEnd, next ? next.start : maxEnd);
  if (start >= ceiling) {
    // No room at the playhead. Drop the new caption at the end instead.
    const last = captions[captions.length - 1];
    start = last ? Math.max(last.end, 0) : 0;
  }
  const end = Math.min(ceiling, start + duration);

  const inserted: Caption = {
    id: 0, // renumber() rewrites this
    start,
    end,
    text: "",
    speaker: null,
  };

  const idx = captions.findIndex((c) => c.start > start);
  const next_list =
    idx < 0
      ? [...captions, inserted]
      : [...captions.slice(0, idx), inserted, ...captions.slice(idx)];

  const renumbered = renumber(next_list);
  const newIndex = idx < 0 ? renumbered.length - 1 : idx;
  return { captions: renumbered, newId: renumbered[newIndex].id };
}
