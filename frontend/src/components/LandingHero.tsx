import { DropZone } from './DropZone'
import { RecentProjects } from './RecentProjects'
import type { SavedProject } from '../utils/projects'

interface Props {
  onFile: (file: File) => void
  onContinueProject: (project: SavedProject, file: File) => void
}

export function LandingHero({ onFile, onContinueProject }: Props) {
  return (
    <section className="max-w-[680px] mx-auto px-6 pt-20 pb-16" aria-labelledby="hero-headline">
      <p className="text-[11px] font-bold tracking-[0.12em] text-accent-light mb-5">SUBTITLES AT LIGHT SPEED</p>
      <h1
        id="hero-headline"
        className="font-extrabold leading-[1.1] tracking-[-0.03em] text-text-primary mb-5"
        style={{ fontSize: 'clamp(40px, 6vw, 60px)' }}
      >
        Captions for<br />
        <span className="text-accent-light">every frame.</span>
      </h1>
      <p className="text-[15px] text-text-muted leading-relaxed mb-9">
        Drop a video. Whisper transcribes it. Edit every word inline.<br />
        Export captions, render them onto the file, or both.
      </p>

      <DropZone onFile={onFile} />

      <RecentProjects onContinue={onContinueProject} />

      <dl className="grid grid-cols-3 gap-6 mt-16 pt-8 border-t border-border">
        <div>
          <dt className="text-[10px] font-bold tracking-[0.1em] text-text-dim mb-1.5">TRANSCRIPTION</dt>
          <dd className="text-sm text-text-muted">Whisper AI</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold tracking-[0.1em] text-text-dim mb-1.5">SPEAKERS</dt>
          <dd className="text-sm text-text-muted">
            <span className="text-accent-light">auto-detected</span>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold tracking-[0.1em] text-text-dim mb-1.5">OUTPUT</dt>
          <dd className="text-sm text-text-muted">
            .srt · .vtt · <span className="text-accent-light">mp4</span>
          </dd>
        </div>
      </dl>
    </section>
  )
}
