import { useEffect, useRef, useState } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import { listProjectMeta, clearProject, type SavedProject } from '../utils/projects'
import styles from './ProjectsPanel.module.css'

interface Props {
  onContinue: (project: SavedProject, file: File) => void
}

export function ProjectsPanel({ onContinue }: Props) {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<SavedProject[]>([])
  const [pending, setPending] = useState<SavedProject | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeJobId = useCaptionStore((s) => s.jobId)

  useEffect(() => {
    const refresh = () => setProjects(
      listProjectMeta().sort((a, b) => b.savedAt - a.savedAt),
    )
    refresh()
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  const handleCardClick = (project: SavedProject) => {
    setPending(project)
    if (fileInputRef.current) fileInputRef.current.value = ''
    fileInputRef.current?.click()
  }

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const project = pending
    setPending(null)
    if (file && project) {
      onContinue(project, file)
      setOpen(false)
    }
  }

  const handleDelete = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation()
    const confirmed = window.confirm('Delete this saved project? This cannot be undone.')
    if (!confirmed) return
    clearProject(jobId)
    setProjects((prev) => prev.filter((p) => p.jobId !== jobId))
  }

  return (
    <div className={styles.wrap} aria-hidden={!open && undefined}>
      <aside
        className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
        aria-label="Projects"
      >
        <div className={styles.header}>
          <span className={styles.title}>Projects</span>
          <span className={styles.count}>{projects.length}</span>
        </div>
        <div className={styles.list}>
          {projects.length === 0 ? (
            <p className={styles.empty}>No saved projects yet.</p>
          ) : (
            projects.map((p) => (
              <div
                key={p.jobId}
                className={`${styles.card} ${p.jobId === activeJobId ? styles.cardActive : ''}`}
              >
                <button
                  type="button"
                  className={styles.cardBody}
                  onClick={() => handleCardClick(p)}
                  aria-label={`Open ${p.videoFileName}`}
                  title={p.videoFileName}
                >
                  <span className={styles.fileName}>{p.videoFileName}</span>
                  <span className={styles.meta}>
                    <span>{p.captions.length} caption{p.captions.length === 1 ? '' : 's'}</span>
                    <span className={styles.date}>{formatRelative(p.savedAt)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.delete}
                  onClick={(e) => handleDelete(e, p.jobId)}
                  aria-label={`Delete ${p.videoFileName}`}
                  title="Delete project"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,.mkv,.mov,.mp4,.webm,.avi,.m4v"
          style={{ display: 'none' }}
          onChange={handleFilePicked}
          aria-hidden="true"
        />
      </aside>
      <button
        type="button"
        className={`${styles.toggle} ${open ? styles.toggleOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close projects panel' : 'Open projects panel'}
        aria-expanded={open}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        )}
      </button>
    </div>
  )
}

function formatRelative(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`
  const diffDays = Math.floor(diffSec / 86400)
  if (diffDays < 7) return `${diffDays}d`
  return new Date(ts).toLocaleDateString()
}
