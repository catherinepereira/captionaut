import { beforeEach, describe, expect, it } from 'vitest'
import {
  saveProject, loadProject, clearProject, listProjects,
  findByFingerprint, fingerprint, type SavedProject,
} from './projects'
import { DEFAULT_BURN_STYLE } from '../stores/captionStore'

function makeProject(jobId: string, name = 'a.mp4', size = 100): SavedProject {
  return {
    jobId,
    videoFileName: name,
    videoFingerprint: `${name}::${size}`,
    savedAt: Date.now(),
    captions: [],
    speakers: [],
    speakerColors: {},
    alignment: [],
    burnStyle: DEFAULT_BURN_STYLE,
  }
}

describe('projects storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a project', () => {
    const p = makeProject('abc')
    saveProject(p)
    expect(loadProject('abc')).toEqual(p)
  })

  it('lists saved projects in MRU order', () => {
    saveProject(makeProject('a'))
    saveProject(makeProject('b'))
    saveProject(makeProject('c'))
    expect(listProjects()).toEqual(['c', 'b', 'a'])
  })

  it('moves an updated project to the front', () => {
    saveProject(makeProject('a'))
    saveProject(makeProject('b'))
    saveProject(makeProject('a'))
    expect(listProjects()).toEqual(['a', 'b'])
  })

  it('clears a project and removes it from the index', () => {
    saveProject(makeProject('a'))
    saveProject(makeProject('b'))
    clearProject('a')
    expect(loadProject('a')).toBeNull()
    expect(listProjects()).toEqual(['b'])
  })

  it('findByFingerprint matches the saved video', () => {
    saveProject(makeProject('a', 'movie.mp4', 12345))
    const fp = fingerprint(new File(['x'], 'movie.mp4', { type: 'video/mp4' }))
    // Forged size: fingerprint includes file.size which we can't easily fake.
    // Confirm null path for a mismatch:
    expect(findByFingerprint('different::99')).toBeNull()
    expect(findByFingerprint(fp)?.jobId).toBeUndefined()  // size mismatch
    expect(findByFingerprint('movie.mp4::12345')?.jobId).toBe('a')
  })
})
