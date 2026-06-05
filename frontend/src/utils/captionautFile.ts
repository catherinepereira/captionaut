import type {
  Caption,
  CaptionStyle,
  AlignmentResult,
  HorizontalAlign,
} from "../stores/captionStore";

export const CAPTIONAUT_FORMAT = "captionaut";
export const CAPTIONAUT_VERSION = 1;

export interface CaptionautFile {
  format: typeof CAPTIONAUT_FORMAT;
  version: number;
  exportedAt: string;
  sourceFileName: string | null;
  projectName: string | null;
  captions: Caption[];
  speakers: string[];
  speakerColors: Record<string, string>;
  speakerOutlineColors: Record<string, string>;
  speakerOutlineThickness: Record<string, number>;
  speakerFontFamilies: Record<string, string>;
  speakerFontSizes: Record<string, number>;
  speakerPosX: Record<string, number>;
  speakerPosY: Record<string, number>;
  speakerAlign: Record<string, HorizontalAlign>;
  captionStyle: CaptionStyle;
  alignment: AlignmentResult[];
}

export interface CaptionautImport {
  projectName: string | null;
  captions: Caption[];
  speakers: string[];
  speakerColors: Record<string, string>;
  speakerOutlineColors: Record<string, string>;
  speakerOutlineThickness: Record<string, number>;
  speakerFontFamilies: Record<string, string>;
  speakerFontSizes: Record<string, number>;
  speakerPosX: Record<string, number>;
  speakerPosY: Record<string, number>;
  speakerAlign: Record<string, HorizontalAlign>;
  captionStyle: CaptionStyle;
  alignment: AlignmentResult[];
}

export function buildCaptionautFile(
  input: Omit<CaptionautImport, never> & { sourceFileName: string | null },
): CaptionautFile {
  return {
    format: CAPTIONAUT_FORMAT,
    version: CAPTIONAUT_VERSION,
    exportedAt: new Date().toISOString(),
    sourceFileName: input.sourceFileName,
    projectName: input.projectName,
    captions: input.captions,
    speakers: input.speakers,
    speakerColors: input.speakerColors,
    speakerOutlineColors: input.speakerOutlineColors,
    speakerOutlineThickness: input.speakerOutlineThickness,
    speakerFontFamilies: input.speakerFontFamilies,
    speakerFontSizes: input.speakerFontSizes,
    speakerPosX: input.speakerPosX,
    speakerPosY: input.speakerPosY,
    speakerAlign: input.speakerAlign,
    captionStyle: input.captionStyle,
    alignment: input.alignment,
  };
}

export function parseCaptionautFile(raw: string): CaptionautImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  if (!isRecord(parsed)) throw new Error("File is not a Captionaut document.");
  if (parsed.format !== CAPTIONAUT_FORMAT) {
    throw new Error("File is not a Captionaut document.");
  }
  if (
    typeof parsed.version !== "number" ||
    parsed.version > CAPTIONAUT_VERSION
  ) {
    throw new Error(
      `Unsupported Captionaut file version (${String(parsed.version)}).`,
    );
  }
  const captions = parsed.captions;
  if (!Array.isArray(captions)) throw new Error('Missing "captions" array.');

  return {
    projectName:
      typeof parsed.projectName === "string" ? parsed.projectName : null,
    captions: captions as Caption[],
    speakers: arr<string>(parsed.speakers),
    speakerColors: rec<string>(parsed.speakerColors),
    speakerOutlineColors: rec<string>(parsed.speakerOutlineColors),
    speakerOutlineThickness: rec<number>(parsed.speakerOutlineThickness),
    speakerFontFamilies: rec<string>(parsed.speakerFontFamilies),
    speakerFontSizes: rec<number>(parsed.speakerFontSizes),
    speakerPosX: rec<number>(parsed.speakerPosX),
    speakerPosY: rec<number>(parsed.speakerPosY),
    speakerAlign: rec<HorizontalAlign>(parsed.speakerAlign),
    captionStyle: parsed.captionStyle as CaptionStyle,
    alignment: arr<AlignmentResult>(parsed.alignment),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function rec<T>(v: unknown): Record<string, T> {
  return isRecord(v) ? (v as Record<string, T>) : {};
}
