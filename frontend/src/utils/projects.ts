import type {
  Caption,
  CaptionStyle,
  AlignmentResult,
  HorizontalAlign,
} from "../stores/captionStore";

const STORAGE_PREFIX = "captionaut.project.";
const INDEX_KEY = "captionaut.projectIndex";
const MAX_PROJECTS = 20;

export function fingerprint(file: File): string {
  return `${file.name}::${file.size}`;
}

export interface SavedProject {
  jobId: string;
  videoFileName: string;
  videoFingerprint: string; // `${name}::${size}`, used to match re-uploads
  savedAt: number;
  name?: string;
  captions: Caption[];
  speakers: string[];
  speakerColors: Record<string, string>;
  speakerOutlineColors: Record<string, string>;
  speakerOutlineThickness: Record<string, number>;
  speakerFontFamilies: Record<string, string>;
  speakerFontSizes: Record<string, number>;
  speakerPosX?: Record<string, number>;
  speakerPosY?: Record<string, number>;
  speakerAlign?: Record<string, HorizontalAlign>;
  alignment: AlignmentResult[];
  captionStyle: CaptionStyle;
  thumbnail?: string; // data: URL captured from the video
}

function key(jobId: string): string {
  return STORAGE_PREFIX + jobId;
}

export function saveProject(p: SavedProject): void {
  try {
    localStorage.setItem(key(p.jobId), JSON.stringify(p));
    const index = listProjects().filter((id) => id !== p.jobId);
    index.unshift(p.jobId);
    while (index.length > MAX_PROJECTS) {
      const evicted = index.pop();
      if (evicted) localStorage.removeItem(key(evicted));
    }
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Quota or serialization failure; non-fatal.
  }
}

export function loadProject(jobId: string): SavedProject | null {
  try {
    const raw = localStorage.getItem(key(jobId));
    return raw ? (JSON.parse(raw) as SavedProject) : null;
  } catch {
    return null;
  }
}

export function clearProject(jobId: string): void {
  localStorage.removeItem(key(jobId));
  const index = listProjects().filter((id) => id !== jobId);
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function listProjects(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function listProjectMeta(): SavedProject[] {
  return listProjects()
    .map((id) => loadProject(id))
    .filter((p): p is SavedProject => p !== null);
}

export function findByFingerprint(fp: string): SavedProject | null {
  for (const p of listProjectMeta()) {
    if (p.videoFingerprint === fp) return p;
  }
  return null;
}
