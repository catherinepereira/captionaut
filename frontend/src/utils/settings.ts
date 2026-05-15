import type { ModelSize, BurnStyle } from '../stores/captionStore'
import { DEFAULT_BURN_STYLE } from '../stores/captionStore'

const KEY = 'captionaut.settings'

export interface UserSettings {
  defaultModelSize: ModelSize
  hfToken: string
  defaultBurnStyle: BurnStyle
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultModelSize: 'base',
  hfToken: '',
  defaultBurnStyle: DEFAULT_BURN_STYLE,
}

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<UserSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      defaultBurnStyle: { ...DEFAULT_SETTINGS.defaultBurnStyle, ...(parsed.defaultBurnStyle ?? {}) },
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
