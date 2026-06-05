import { DropZone } from "./DropZone";
import { RecentProjects } from "./RecentProjects";
import type { SavedProject } from "../utils/projects";

interface Props {
  onFile: (file: File) => void;
  onContinueProject: (project: SavedProject, file: File) => void;
}

export function LandingHero({ onFile, onContinueProject }: Props) {
  return (
    <section
      className="mx-auto max-w-[680px] px-6 pt-20 pb-16"
      aria-labelledby="hero-headline"
    >
      <h1
        id="hero-headline"
        className="text-text-primary mb-5 leading-[1.1] font-extrabold tracking-[-0.03em]"
        style={{ fontSize: "clamp(40px, 6vw, 60px)" }}
      >
        Subtitles at
        <br />
        <span className="text-accent-light">light speed</span>⚡
      </h1>
      <p className="text-text-muted mb-9 text-[15px] leading-relaxed">
        Drop a video. Whisper transcribes it. Edit every word inline.
        <br />
        Export captions, render them onto the file, or both.
      </p>

      <DropZone onFile={onFile} />

      <RecentProjects onContinue={onContinueProject} />

      <dl className="border-border mt-16 grid grid-cols-3 gap-6 border-t pt-8">
        <div>
          <dt className="text-text-dim mb-1.5 text-[10px] font-bold tracking-[0.1em]">
            TRANSCRIPTION
          </dt>
          <dd className="text-text-muted text-sm">
            <a
              href="https://github.com/openai/whisper"
              target="_blank"
              rel="noreferrer"
              className="text-accent-light underline-offset-2 hover:underline"
            >
              Whisper AI
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-text-dim mb-1.5 text-[10px] font-bold tracking-[0.1em]">
            SPEAKERS
          </dt>
          <dd className="text-text-muted text-sm">
            <a
              href="https://huggingface.co/pyannote/speaker-diarization-3.1"
              target="_blank"
              rel="noreferrer"
              className="text-accent-light underline-offset-2 hover:underline"
            >
              pyannote community model
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-text-dim mb-1.5 text-[10px] font-bold tracking-[0.1em]">
            OUTPUT
          </dt>
          <dd className="text-text-muted text-sm">
            .srt · .vtt ·{" "}
            <span className="text-accent-light">mp4 · webm · mov</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
