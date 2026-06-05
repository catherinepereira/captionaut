import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCaptionStore, type Caption } from "../stores/captionStore";
import { findActiveCaptionId } from "../utils/captions";

interface HoverState {
  caption: Caption;
  x: number;
  y: number;
}

const ZOOM_LEVELS = [1, 2, 4, 8] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export function CaptionTimeline() {
  const captions = useCaptionStore((s) => s.captions);
  const videoDuration = useCaptionStore((s) => s.videoDuration);
  const currentTime = useCaptionStore((s) => s.currentTime);
  const speakerColors = useCaptionStore((s) => s.speakerColors);
  const captionStyle = useCaptionStore((s) => s.captionStyle);
  const requestSeek = useCaptionStore((s) => s.requestSeek);
  const requestScrollToCaption = useCaptionStore(
    (s) => s.requestScrollToCaption,
  );

  const [zoom, setZoom] = useState<ZoomLevel>(1);
  const [hover, setHover] = useState<HoverState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalDuration = useMemo(() => {
    if (videoDuration > 0) return videoDuration;
    if (captions.length === 0) return 0;
    return Math.max(...captions.map((c) => c.end));
  }, [videoDuration, captions]);

  const activeId = useMemo(
    () => findActiveCaptionId(captions, currentTime),
    [captions, currentTime],
  );

  useEffect(() => {
    if (zoom === 1) return;
    const el = scrollRef.current;
    if (!el || totalDuration <= 0) return;
    const innerWidth = el.scrollWidth;
    const playheadX = (currentTime / totalDuration) * innerWidth;
    const margin = el.clientWidth * 0.3;
    if (
      playheadX < el.scrollLeft + margin ||
      playheadX > el.scrollLeft + el.clientWidth - margin
    ) {
      el.scrollTo({ left: playheadX - el.clientWidth / 2, behavior: "smooth" });
    }
  }, [currentTime, zoom, totalDuration]);

  if (captions.length === 0 || totalDuration <= 0) return null;

  const handleBlockClick = (start: number, id: number) => {
    requestSeek(start);
    requestScrollToCaption(id);
  };

  const zoomIn = () => {
    const i = ZOOM_LEVELS.indexOf(zoom);
    if (i < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[i + 1]);
  };
  const zoomOut = () => {
    const i = ZOOM_LEVELS.indexOf(zoom);
    if (i > 0) setZoom(ZOOM_LEVELS[i - 1]);
  };

  const playheadPct = (currentTime / totalDuration) * 100;

  const zoomBtnClass =
    "bg-transparent border border-border text-text-muted w-6 h-6 rounded text-sm leading-none inline-flex items-center justify-center hover:enabled:border-accent-light hover:enabled:text-accent-light focus-visible:enabled:border-accent-light focus-visible:enabled:text-accent-light disabled:opacity-[0.35] disabled:cursor-not-allowed";

  return (
    <div className="bg-card border-border mt-3 overflow-hidden rounded-md border">
      <div className="border-border flex items-center gap-2.5 border-b px-3.5 py-2.5">
        <span className="text-accent-light text-xs font-semibold tracking-[0.08em] uppercase">
          Timeline
        </span>
        <span className="text-text-dim font-mono text-[11px]">
          {formatDuration(totalDuration)}
        </span>
        <div className="flex-1" />
        <button
          className={zoomBtnClass}
          onClick={zoomOut}
          disabled={zoom === ZOOM_LEVELS[0]}
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
        <span className="text-text-muted min-w-6 text-center font-mono text-[11px]">
          {zoom}×
        </span>
        <button
          className={zoomBtnClass}
          onClick={zoomIn}
          disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
      </div>

      <div
        ref={scrollRef}
        className="[&::-webkit-scrollbar-thumb]:bg-border relative h-16 cursor-pointer overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-track]:bg-transparent"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target !== e.currentTarget && !target.dataset.inner) return;
          const el = scrollRef.current;
          if (!el || totalDuration <= 0) return;
          const rect = el.getBoundingClientRect();
          const x = e.clientX - rect.left + el.scrollLeft;
          const innerWidth = el.scrollWidth;
          const t = (x / innerWidth) * totalDuration;
          requestSeek(Math.max(0, Math.min(totalDuration, t)));
        }}
      >
        <div
          data-inner="1"
          className="relative h-full min-w-full"
          style={{ width: `${zoom * 100}%` }}
        >
          <Ticks totalDuration={totalDuration} zoom={zoom} />
          {captions.map((cap) => {
            const leftPct = (cap.start / totalDuration) * 100;
            const widthPct = ((cap.end - cap.start) / totalDuration) * 100;
            const color =
              cap.color_override ??
              (cap.speaker ? speakerColors[cap.speaker] : null) ??
              captionStyle.color;
            const isActive = cap.id === activeId;
            return (
              <button
                key={cap.id}
                type="button"
                className={`focus-visible:outline-accent absolute top-[22px] bottom-2 min-w-0.5 cursor-pointer rounded-sm border-0 p-0 transition-[opacity,transform,box-shadow] duration-150 hover:scale-y-110 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 ${isActive ? "opacity-100 shadow-[0_0_0_2px_var(--color-accent)]" : "opacity-80"}`}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  background: color,
                }}
                aria-label={`Caption at ${formatDuration(cap.start)}: ${cap.text}`}
                onMouseEnter={(e) => {
                  const r = (
                    e.currentTarget as HTMLElement
                  ).getBoundingClientRect();
                  setHover({ caption: cap, x: r.left + r.width / 2, y: r.top });
                }}
                onMouseLeave={() =>
                  setHover((h) => (h && h.caption.id === cap.id ? null : h))
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setHover(null);
                  handleBlockClick(cap.start, cap.id);
                }}
              />
            );
          })}
          <div
            className="bg-accent pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-px"
            style={{
              left: `${playheadPct}%`,
              boxShadow: "0 0 6px var(--color-accent)",
            }}
            aria-hidden="true"
          />
        </div>
      </div>
      {hover && <BlockTooltip hover={hover} />}
    </div>
  );
}

function BlockTooltip({ hover }: { hover: HoverState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: hover.x,
    top: hover.y,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let left = hover.x - rect.width / 2;
    let top = hover.y - rect.height - margin;
    if (top < margin) top = hover.y + 16;
    left = Math.max(
      margin,
      Math.min(window.innerWidth - rect.width - margin, left),
    );
    setPos({ left, top });
  }, [hover]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="bg-card border-border text-text-primary pointer-events-none fixed z-[200] max-w-[320px] rounded-md border px-2.5 py-2 text-xs leading-snug shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="text-text-dim mb-1 font-mono text-[11px]">
        {formatDuration(hover.caption.start)} →{" "}
        {formatDuration(hover.caption.end)}
      </div>
      <div className="break-words whitespace-pre-wrap">
        {hover.caption.text}
      </div>
    </div>,
    document.body,
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

function pickTickStep(visibleSeconds: number): number {
  const target = visibleSeconds / 8;
  for (const step of TICK_STEPS) {
    if (step >= target) return step;
  }
  return TICK_STEPS[TICK_STEPS.length - 1];
}

function Ticks({
  totalDuration,
  zoom,
}: {
  totalDuration: number;
  zoom: number;
}) {
  const visible = totalDuration / zoom;
  const step = pickTickStep(visible);
  const minor = step / 5;
  const ticks: { t: number; major: boolean }[] = [];
  for (let t = 0; t <= totalDuration + 1e-6; t += minor) {
    const isMajor = Math.abs(t / step - Math.round(t / step)) < 1e-6;
    ticks.push({ t, major: isMajor });
  }
  return (
    <div
      className="border-border pointer-events-none absolute top-0 right-0 left-0 h-4 border-b"
      aria-hidden="true"
    >
      {ticks.map(({ t, major }, i) => {
        const leftPct = (t / totalDuration) * 100;
        return (
          <div
            key={i}
            className={`absolute top-0 w-px ${major ? "bg-text-dim" : "bg-border"}`}
            style={{ left: `${leftPct}%`, height: major ? "100%" : "50%" }}
          >
            {major && (
              <span className="text-text-dim absolute top-px left-1 font-mono text-[10px] whitespace-nowrap select-none">
                {formatDuration(t)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
