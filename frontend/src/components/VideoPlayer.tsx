import { useEffect, useMemo, useRef } from "react";
import { useCaptionStore } from "../stores/captionStore";
import { findActiveCaption } from "../utils/captions";

// Multi-stop CSS text-shadow approximating an N-pixel ASS outline.
function buildOutlineShadow(
  color: string,
  thickness: number,
): string | undefined {
  if (thickness <= 0) return undefined;
  // The overlay font is shown at 0.5x the export size, so halve thickness too.
  const radius = Math.max(0.5, thickness * 0.5);
  const steps = Math.max(8, Math.round(radius * 4));
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i * Math.PI * 2) / steps;
    const x = (Math.cos(angle) * radius).toFixed(2);
    const y = (Math.sin(angle) * radius).toFixed(2);
    parts.push(`${x}px ${y}px 0 ${color}`);
  }
  return parts.join(", ");
}

export function VideoPlayer() {
  const videoUrl = useCaptionStore((s) => s.videoUrl);
  const captions = useCaptionStore((s) => s.captions);
  const currentTime = useCaptionStore((s) => s.currentTime);
  const seekRequest = useCaptionStore((s) => s.seekRequest);
  const setCurrentTime = useCaptionStore((s) => s.setCurrentTime);
  const setVideoDuration = useCaptionStore((s) => s.setVideoDuration);
  const requestSeek = useCaptionStore((s) => s.requestSeek);
  const speakerColors = useCaptionStore((s) => s.speakerColors);
  const speakerOutlineColors = useCaptionStore((s) => s.speakerOutlineColors);
  const speakerOutlineThickness = useCaptionStore(
    (s) => s.speakerOutlineThickness,
  );
  const speakerFontFamilies = useCaptionStore((s) => s.speakerFontFamilies);
  const speakerFontSizes = useCaptionStore((s) => s.speakerFontSizes);
  const speakerPosX = useCaptionStore((s) => s.speakerPosX);
  const speakerPosY = useCaptionStore((s) => s.speakerPosY);
  const speakerAlign = useCaptionStore((s) => s.speakerAlign);
  const captionStyle = useCaptionStore((s) => s.captionStyle);
  const thumbnail = useCaptionStore((s) => s.thumbnail);
  const setThumbnail = useCaptionStore((s) => s.setThumbnail);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Capture a thumbnail once captions exist and the video has data.
  // Uses whatever frame the playhead is currently on, so users can pause
  // where they want before the first auto-save.
  useEffect(() => {
    if (thumbnail || captions.length === 0) return;
    const vid = videoRef.current;
    if (!vid) return;

    const capture = () => {
      if (vid.readyState < 2) return;
      try {
        const canvas = document.createElement("canvas");
        const targetW = 320;
        const ratio = (vid.videoHeight || 1) / (vid.videoWidth || 1);
        canvas.width = targetW;
        canvas.height = Math.round(targetW * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        setThumbnail(canvas.toDataURL("image/jpeg", 0.75));
      } catch {
        // CORS-tainted canvases or no decode yet. Silent fail, retry later.
      }
    };

    if (vid.readyState >= 2) capture();
    else {
      vid.addEventListener("loadeddata", capture, { once: true });
      return () => vid.removeEventListener("loadeddata", capture);
    }
  }, [thumbnail, captions.length, setThumbnail]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => setCurrentTime(vid.currentTime);
    const onMeta = () => setVideoDuration(vid.duration || 0);
    vid.addEventListener("timeupdate", onTime);
    vid.addEventListener("loadedmetadata", onMeta);
    return () => {
      vid.removeEventListener("timeupdate", onTime);
      vid.removeEventListener("loadedmetadata", onMeta);
    };
  }, [setCurrentTime, setVideoDuration]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || seekRequest == null) return;
    vid.currentTime = seekRequest;
    requestSeek(null);
  }, [seekRequest, requestSeek]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const vid = videoRef.current;
      if (!vid) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (vid.paused) vid.play();
          else vid.pause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          vid.currentTime = Math.max(0, vid.currentTime - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          vid.currentTime = Math.min(
            vid.duration || Infinity,
            vid.currentTime + 1,
          );
          break;
        case "j":
          e.preventDefault();
          vid.currentTime = Math.max(0, vid.currentTime - 5);
          break;
        case "l":
          e.preventDefault();
          vid.currentTime = Math.min(
            vid.duration || Infinity,
            vid.currentTime + 5,
          );
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeCaption = useMemo(
    () => findActiveCaption(captions, currentTime),
    [captions, currentTime],
  );

  if (!videoUrl) return null;

  // Resolve effective values. Per-caption override > speaker setting > global.
  const sp = activeCaption?.speaker ?? null;
  const speakerTextColor = sp ? speakerColors[sp] : undefined;
  const speakerOutlineColor = sp ? speakerOutlineColors[sp] : undefined;
  const speakerThickness = sp ? speakerOutlineThickness[sp] : undefined;
  const speakerFontFamily = sp ? speakerFontFamilies[sp] : undefined;
  const speakerFontSize = sp ? speakerFontSizes[sp] : undefined;

  const textColor =
    activeCaption?.color_override ?? speakerTextColor ?? captionStyle.color;
  const outlineColor =
    activeCaption?.outline_override ??
    speakerOutlineColor ??
    captionStyle.outlineColor;
  const thickness =
    activeCaption?.outline_thickness ??
    speakerThickness ??
    captionStyle.outlineThickness;

  const fontFamily =
    activeCaption?.font_family ?? speakerFontFamily ?? captionStyle.fontFamily;
  const fontSizePx = Math.round(
    (activeCaption?.font_size ?? speakerFontSize ?? captionStyle.fontSize) *
      0.5,
  );

  // Resolve effective position + alignment with hierarchy: global < speaker < caption.
  const posX =
    activeCaption?.pos_x_override ??
    (sp ? speakerPosX[sp] : undefined) ??
    captionStyle.posX;
  const posY =
    activeCaption?.pos_y_override ??
    (sp ? speakerPosY[sp] : undefined) ??
    captionStyle.posY;
  const align =
    activeCaption?.align_override ??
    (sp ? speakerAlign[sp] : undefined) ??
    captionStyle.align;

  // Match the ASS \pos + bottom-row alignment semantics: (x,y) is the bottom
  // of the text bbox. Align picks which horizontal edge of the bbox sits at x.
  const overlayPlacement: React.CSSProperties = {
    left: `${posX}%`,
    top: `${posY}%`,
    textAlign: align,
    maxWidth: align === "center" ? "90%" : "50%",
    transform: (() => {
      const ty = "-100%";
      if (align === "center") return `translate(-50%, ${ty})`;
      if (align === "right") return `translate(-100%, ${ty})`;
      return `translate(0%, ${ty})`;
    })(),
  };

  const overlayStyle: React.CSSProperties = {
    color: textColor,
    fontFamily,
    fontSize: `${fontSizePx}px`,
    textShadow: buildOutlineShadow(outlineColor, thickness),
    ...overlayPlacement,
  };

  return (
    <div className="relative w-full overflow-hidden rounded-md bg-black">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="block max-h-[70vh] w-full object-contain"
      />
      {activeCaption && (
        <div
          className="pointer-events-none absolute p-0 font-bold tracking-[0.01em] whitespace-pre-wrap"
          style={overlayStyle}
        >
          {activeCaption.text}
        </div>
      )}
    </div>
  );
}
