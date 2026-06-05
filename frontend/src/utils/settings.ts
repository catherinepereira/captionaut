import type { ModelSize } from "../stores/captionStore";

const KEY = "captionaut.settings";

export interface UserSettings {
  defaultModelSize: ModelSize;
  hfToken: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultModelSize: "base",
  hfToken: "",
};

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: UserSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // localStorage write failed (quota / disabled); non-fatal.
  }
}
