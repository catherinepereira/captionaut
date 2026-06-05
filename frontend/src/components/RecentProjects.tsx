import { useEffect, useMemo, useRef, useState } from "react";
import {
  listProjectMeta,
  clearProject,
  type SavedProject,
} from "../utils/projects";
import { ConfirmModal } from "./ConfirmModal";

interface Props {
  onContinue: (project: SavedProject, file: File) => void;
}

export function RecentProjects({ onContinue }: Props) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [pending, setPending] = useState<SavedProject | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deleteTarget = useMemo(
    () => projects.find((p) => p.jobId === deleteTargetId) ?? null,
    [projects, deleteTargetId],
  );

  useEffect(() => {
    const refresh = () =>
      setProjects(listProjectMeta().sort((a, b) => b.savedAt - a.savedAt));
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const handleCardClick = (project: SavedProject) => {
    setPending(project);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const project = pending;
    setPending(null);
    if (file && project) onContinue(project, file);
  };

  const requestDelete = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    setDeleteTargetId(jobId);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    clearProject(deleteTargetId);
    setProjects((prev) => prev.filter((p) => p.jobId !== deleteTargetId));
    setDeleteTargetId(null);
  };

  if (projects.length === 0) return null;

  return (
    <section className="mt-12 text-left" aria-labelledby="recent-heading">
      <h2
        id="recent-heading"
        className="text-text-dim mb-3 text-[11px] font-bold tracking-[0.12em] uppercase"
      >
        Recent projects
      </h2>
      <div
        role="list"
        className="-mx-1 flex snap-x snap-proximity gap-3 overflow-x-auto overflow-y-hidden px-1 pb-3"
      >
        {projects.map((p) => (
          <article
            key={p.jobId}
            role="listitem"
            className="group bg-card border-border hover:border-accent-light relative flex flex-[0_0_200px] snap-start flex-col overflow-hidden rounded-md border transition-[border-color,transform] duration-150 hover:-translate-y-0.5"
          >
            <button
              type="button"
              onClick={() => handleCardClick(p)}
              aria-label={`Continue ${p.name || p.videoFileName}`}
              className="text-text-primary font-inherit focus-visible:outline-accent flex flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
            >
              {p.thumbnail ? (
                <img
                  className="bg-input border-border block aspect-video w-full border-b object-cover"
                  src={p.thumbnail}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="text-text-dim border-border flex aspect-video w-full items-center justify-center border-b text-2xl"
                  style={{
                    background:
                      "radial-gradient(ellipse at 30% 30%, rgba(110, 130, 170, 0.18), transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(140, 110, 170, 0.12), transparent 60%), var(--color-input)",
                  }}
                >
                  🎬
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-1 px-3 py-2.5">
                <span
                  className="overflow-hidden text-[13px] font-medium text-ellipsis whitespace-nowrap"
                  title={
                    p.name ? `${p.name} (${p.videoFileName})` : p.videoFileName
                  }
                >
                  {p.name || p.videoFileName}
                </span>
                <span className="text-text-muted flex justify-between gap-2 text-[11px]">
                  <span>
                    {p.captions.length} caption
                    {p.captions.length === 1 ? "" : "s"}
                    {p.speakers.length > 0 && ` · ${p.speakers.length}`}
                  </span>
                  <span className="text-text-dim font-mono">
                    {formatRelative(p.savedAt)}
                  </span>
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => requestDelete(e, p.jobId)}
              aria-label={`Delete ${p.videoFileName}`}
              title="Delete project"
              className="border-border text-text-muted hover:text-red focus-visible:text-red absolute top-1.5 right-1.5 h-6 w-6 cursor-pointer rounded border bg-black/55 text-sm leading-none opacity-0 transition-[opacity,color,background] duration-150 group-hover:opacity-100 hover:bg-black/70 hover:outline-none focus-visible:bg-black/70 focus-visible:opacity-100 focus-visible:outline-none"
            >
              ×
            </button>
          </article>
        ))}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-matroska,.mkv,.mov,.mp4,.webm,.avi,.m4v"
        className="hidden"
        onChange={handleFilePicked}
        aria-hidden="true"
      />
      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete project"
        message={
          <>
            Delete{" "}
            <strong>{deleteTarget?.name || deleteTarget?.videoFileName}</strong>
            ?
            <br />
            This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

function formatRelative(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  const diffDays = Math.floor(diffSec / 86400);
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(ts).toLocaleDateString();
}
