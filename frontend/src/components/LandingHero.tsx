import { DropZone } from './DropZone'
import styles from '../App.module.css'

interface Props {
  onFile: (file: File) => void
}

export function LandingHero({ onFile }: Props) {
  return (
    <section className={styles.hero} aria-labelledby="hero-headline">
      <p className={styles.tagline}>SUBTITLES AT LIGHT SPEED</p>
      <h1 id="hero-headline" className={styles.headline}>
        Captions for<br />
        <span className={styles.accent}>every frame.</span>
      </h1>
      <p className={styles.subheadline}>
        Drop a video. Whisper transcribes it. Edit every word inline.<br />
        Export captions, render them onto the file, or both.
      </p>

      <DropZone onFile={onFile} />

      <dl className={styles.features}>
        <div>
          <dt className={styles.featureLabel}>TRANSCRIPTION</dt>
          <dd className={styles.featureValue}>Whisper AI</dd>
        </div>
        <div>
          <dt className={styles.featureLabel}>SPEAKERS</dt>
          <dd className={styles.featureValue}>
            <span className={styles.accent}>auto-detected</span>
          </dd>
        </div>
        <div>
          <dt className={styles.featureLabel}>OUTPUT</dt>
          <dd className={styles.featureValue}>
            .srt · .vtt · <span className={styles.accent}>mp4</span>
          </dd>
        </div>
      </dl>
    </section>
  )
}
