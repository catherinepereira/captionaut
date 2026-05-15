import { beforeEach, describe, expect, it } from 'vitest'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from './settings'

describe('settings storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when nothing is saved', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips saved settings', () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      defaultModelSize: 'small',
      hfToken: 'hf_abc',
    })
    const loaded = loadSettings()
    expect(loaded.defaultModelSize).toBe('small')
    expect(loaded.hfToken).toBe('hf_abc')
  })

  it('merges partial saved data with defaults', () => {
    localStorage.setItem('captionaut.settings', JSON.stringify({ hfToken: 'partial' }))
    const loaded = loadSettings()
    expect(loaded.hfToken).toBe('partial')
    expect(loaded.defaultModelSize).toBe(DEFAULT_SETTINGS.defaultModelSize)
    expect(loaded.defaultBurnStyle).toEqual(DEFAULT_SETTINGS.defaultBurnStyle)
  })

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem('captionaut.settings', 'not-json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
