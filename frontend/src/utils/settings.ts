import type { ModelSize, CaptionStyle } from '../stores/captionStore'
import { DEFAULT_CAPTION_STYLE } from '../stores/captionStore'

const KEY = 'captionaut.settings'

export interface UserSettings {
  defaultModelSize: ModelSize
  hfToken: string
  defaultCaptionStyle: CaptionStyle
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultModelSize: 'base',
  hfToken: '',
  defaultCaptionStyle: DEFAULT_CAPTION_STYLE,
}

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<UserSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      defaultCaptionStyle: { ...DEFAULT_SETTINGS.defaultCaptionStyle, ...(parsed.defaultCaptionStyle ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: UserSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // localStorage write failed (quota / disabled); non-fatal.
  }
}
