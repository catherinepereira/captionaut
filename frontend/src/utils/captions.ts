import type { Caption } from '../stores/captionStore'

/**
 * Find the caption active at time `t`. Binary-searches assuming captions are
 * sorted by `start` and non-overlapping — true for raw Whisper output.
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
