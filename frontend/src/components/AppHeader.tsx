import { useEffect, useRef, useState } from "react";
import { useCaptionStore } from "../stores/captionStore";

interface Props {
  onNewVideo: () => void;
  onOpenSettings: () => void;
}

export function AppHeader({ onNewVideo, onOpenSettings }: Props) {
  const state = useCaptionStore((s) => s.state);
  const videoFileName = useCaptionStore((s) => s.videoFile?.name ?? null);
  const projectName = useCaptionStore((s) => s.projectName);
  const setProjectName = useCaptionStore((s) => s.setProjectName);
  const isLanding = state === "idle";
  const canStartOver = state === "editing" || state === "rendering";
  const canRename = canStartOver;
  const inputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = () => {
    setDraft(projectName ?? "");
    setEditing(true);
  };

  const commit = () => {
    setProjectName(draft);
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  const displayName = projectName || videoFileName;

  return (
    <header className="border-border bg-bg sticky top-0 z-[100] flex items-center gap-6 border-b px-10 py-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onNewVideo}
          disabled={isLanding}
          aria-label="Return to home"
          className="font-inherit hover:enabled:bg-elevated -mx-1.5 -my-1 inline-flex items-center gap-2 rounded-md border-0 bg-transparent px-1.5 py-1 text-inherit transition-colors disabled:cursor-default"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            👩‍🚀
          </span>
          <span className="text-text-primary text-base font-bold tracking-tight">
            Captionaut
          </span>
        </button>
        {displayName && !isLanding && (
          <>
            <span aria-hidden="true" className="text-text-dim mx-1">
              /
            </span>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") cancel();
                }}
                placeholder={videoFileName ?? "Project name"}
                aria-label="Project name"
                className="bg-input border-accent text-text-primary max-w-[360px] rounded-md border px-2 py-1 text-sm font-medium outline-none"
              />
            ) : canRename ? (
              <button
                type="button"
                onClick={startEdit}
                aria-label={`Rename project (currently ${displayName})`}
                title="Click to rename"
                className="text-text-muted hover:bg-elevated hover:text-text-primary -mx-2 -my-1 max-w-[360px] cursor-text overflow-hidden rounded-md border-0 bg-transparent px-2 py-1 text-sm font-medium text-ellipsis whitespace-nowrap transition-colors"
              >
                {displayName}
              </button>
            ) : (
              <span
                aria-label="Current file"
                className="text-text-muted max-w-[360px] overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap"
              >
                {displayName}
              </span>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {canStartOver && (
          <button
            onClick={onNewVideo}
            className="border-border text-text-primary hover:border-accent-light hover:text-accent-light rounded-md border bg-transparent px-3.5 py-1.5 text-[13px] font-medium transition-colors"
          >
            + New video
          </button>
        )}
        <button
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="border-border text-text-muted hover:border-accent-light hover:text-accent-light inline-flex h-8 w-8 items-center justify-center rounded-md border bg-transparent text-base transition-colors"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </div>
    </header>
  );
}
