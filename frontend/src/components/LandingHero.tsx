import { DropZone } from './DropZone'
import styles from '../App.module.css'

interface Props {
  onFile: (file: File) => void
}

export function LandingHero({ onFile }: Props) {
  return (
    <section className={styles.hero} aria-labelledby="hero-headline">
      <p className={styles.tagline}>LOCAL · PRIVATE · OFFLINE</p>
      <h1 id="hero-headline" className={styles.headline}>
        Captions that<br />
        <span className={styles.accent}>burn in.</span>
      </h1>
      <p className={styles.subheadline}>
        Drop a video. Whisper transcribes it. Edit every word inline.<br />
        Burn captions directly into the file.
      </p>

      <DropZone onFile={onFile} />

      <dl className={styles.features}>
        <div>
          <dt className={styles.featureLabel}>TRANSCRIPTION</dt>
          <dd className={styles.featureValue}>Whisper AI</dd>
        </div>
        <div>
          <dt className={styles.featureLabel}>OUTPUT</dt>
          <dd className={styles.featureValue}>
            .srt · .vtt · <span className={styles.accent}>burned in</span>
          </dd>
        </div>
        <div>
          <dt className={styles.featureLabel}>PRIVACY</dt>
          <dd className={styles.featureValue}>
            100% <span className={styles.accent}>local</span>
          </dd>
        </div>
      </dl>
    </section>
  )
}
