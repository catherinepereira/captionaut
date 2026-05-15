import { describe, expect, it } from 'vitest'
import {
  findActiveCaption, findActiveCaptionId,
  shiftSelected, mergeSelected, splitAt, deleteSelected, renumber,
} from './captions'
import type { Caption } from '../stores/captionStore'

const c = (id: number, start: number, end: number, text = 'x', speaker?: string): Caption => ({
  id, start, end, text, speaker: speaker ?? null,
})

describe('findActiveCaption', () => {
  const list = [c(0, 0, 1), c(1, 1, 2), c(2, 5, 6)]

  it('finds a caption whose range covers t', () => {
    expect(findActiveCaption(list, 1.5)?.id).toBe(1)
  })

  it('returns undefined in a gap', () => {
    expect(findActiveCaption(list, 3)).toBeUndefined()
  })

  it('returns the caption at exact boundary', () => {
    expect(findActiveCaptionId(list, 0)).toBe(0)
    expect(findActiveCaptionId(list, 6)).toBe(2)
  })

  it('handles empty list', () => {
    expect(findActiveCaption([], 1)).toBeUndefined()
  })
})

describe('shiftSelected', () => {
  it('shifts only selected captions forward', () => {
    const list = [c(0, 0, 1), c(1, 2, 3), c(2, 5, 6)]
    const out = shiftSelected(list, new Set([1]), 0.5)
    expect(out[0]).toEqual(list[0])
    expect(out[1].start).toBeCloseTo(2.5)
    expect(out[1].end).toBeCloseTo(3.5)
    expect(out[2]).toEqual(list[2])
  })

  it('clamps to zero when shifting before the start', () => {
    const list = [c(0, 0.2, 1)]
    const out = shiftSelected(list, new Set([0]), -1)
    expect(out[0].start).toBe(0)
  })

  it('returns the same array when nothing is selected', () => {
    const list = [c(0, 0, 1)]
    expect(shiftSelected(list, new Set(), 1)).toBe(list)
  })
})

describe('mergeSelected', () => {
  it('joins text and spans min-start..max-end', () => {
    const list = [c(0, 0, 1, 'hi'), c(1, 1, 2, 'there'), c(2, 4, 5, 'unrelated')]
    const out = mergeSelected(list, new Set([0, 1]))
    expect(out).toHaveLength(2)
    expect(out[0].text).toBe('hi there')
    expect(out[0].start).toBe(0)
    expect(out[0].end).toBe(2)
    expect(out[1].text).toBe('unrelated')
  })

  it('preserves speaker when all selected share one', () => {
    const list = [c(0, 0, 1, 'a', 'SPEAKER_00'), c(1, 1, 2, 'b', 'SPEAKER_00')]
    const out = mergeSelected(list, new Set([0, 1]))
    expect(out[0].speaker).toBe('SPEAKER_00')
  })

  it('drops speaker when selected speakers conflict', () => {
    const list = [c(0, 0, 1, 'a', 'SPEAKER_00'), c(1, 1, 2, 'b', 'SPEAKER_01')]
    const out = mergeSelected(list, new Set([0, 1]))
    expect(out[0].speaker).toBeNull()
  })

  it('is a no-op with <2 selected', () => {
    const list = [c(0, 0, 1)]
    expect(mergeSelected(list, new Set([0]))).toBe(list)
  })
})

describe('splitAt', () => {
  it('splits a caption into two at t', () => {
    const list = [c(0, 0, 2, 'hello')]
    const out = splitAt(list, 0, 1)
    expect(out).toHaveLength(2)
    expect(out[0].end).toBe(1)
    expect(out[1].start).toBe(1)
    expect(out[0].id).toBe(0)
    expect(out[1].id).toBe(1)
  })

  it('refuses to split at or outside the bounds', () => {
    const list = [c(0, 0, 2, 'x')]
    expect(splitAt(list, 0, 0)).toBe(list)
    expect(splitAt(list, 0, 2)).toBe(list)
    expect(splitAt(list, 0, 5)).toBe(list)
  })
})

describe('deleteSelected', () => {
  it('removes selected and renumbers remaining', () => {
    const list = [c(0, 0, 1), c(1, 1, 2), c(2, 2, 3)]
    const out = deleteSelected(list, new Set([1]))
    expect(out.map((c) => c.id)).toEqual([0, 1])
    expect(out.map((c) => c.start)).toEqual([0, 2])
  })

  it('no-ops when nothing selected', () => {
    const list = [c(0, 0, 1)]
    expect(deleteSelected(list, new Set())).toBe(list)
  })
})

describe('renumber', () => {
  it('reassigns ids starting from 0', () => {
    const list = [c(7, 0, 1), c(11, 1, 2)]
    expect(renumber(list).map((c) => c.id)).toEqual([0, 1])
  })

  it('reuses object references when ids already match', () => {
    const list = [c(0, 0, 1), c(1, 1, 2)]
    expect(renumber(list)[0]).toBe(list[0])
  })
})
