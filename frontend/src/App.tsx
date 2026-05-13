import { useEffect, useRef } from 'react'
import { useCaptionStore } from './stores/captionStore'
import {
  uploadVideo, transcribeJob, alignScript, streamProgress, errMsg,
  type StreamHandle,
} from './api'
import { DropZone } from './components/DropZone'
import { VideoPlayer } from './components/VideoPlayer'
import { CaptionEditor } from './components/CaptionEditor'
import { Toolbar } from './components/Toolbar'
import { ErrorBanner } from './components/ErrorBanner'
import { ConfigScreen } from './components/ConfigScreen'
import { SpeakerPanel } from './components/SpeakerPanel'
import styles from './App.module.css'

export function App() {
  const {
    state, videoFile, jobId, transcribeProgress, transcribeConfig,
    setState, setVideoFile, setJobId, setCaptions, setAlignment, setSpeakers,
    setError, setTranscribeProgress, reset,
  } = useCaptionStore()
  const videoFileName = videoFile?.name ?? null

  const progressStreamRef = useRef<StreamHandle | null>(null)
  useEffect(() => () => { progressStreamRef.current?.close() }, [])
  useEffect(() => {
    if (state === 'idle') progressStreamRef.current?.close()
  }, [state])

  const handleVideoFile = async (file: File) => {
    reset()
    setVideoFile(file)
    setState('uploading')
    try {
      const id = await uploadVideo(file)
      setJobId(id)
      setState('configuring')
    } catch (err) {
      setError(`Upload failed: ${errMsg(err)}`)
      setState('idle')
    }
  }

  const handleStartTranscription = async () => {
    if (!jobId) return
    setState('transcribing')
    try {
      progressStreamRef.current = streamProgress(`/transcribe-progress/${jobId}`, {
        onProgress: setTranscribeProgress,
      })

      const { captions, speakers } = await transcribeJob(jobId, {
        modelSize: transcribeConfig.modelSize,
        initialPrompt: transcribeConfig.initialPrompt,
        diarization: transcribeConfig.diarization,
        denoise: transcribeConfig.denoise,
      })
      progressStreamRef.current?.close()
      setCaptions(captions)
      setSpeakers(speakers)
      setTranscribeProgress(100)

      if (transcribeConfig.scriptFile) {
        try {
          const results = await alignScript(jobId, transcribeConfig.scriptFile)
          setAlignment(results)
        } catch (e) {
          setError(`Script alignment failed: ${errMsg(e)}`)
        }
      }

      setState('editing')
    } catch (err) {
      progressStreamRef.current?.close()
      setError(`Transcription failed: ${errMsg(err)}`)
      setState('configuring')
    }
  }

  const isLanding = state === 'idle'
  const isBusy = state === 'uploading' || state === 'transcribing'

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.dot} />
          <span className={styles.logoText}>Captionaut</span>
          {videoFileName && !isLanding && (
            <>
              <span className={styles.separator}>/</span>
              <span className={styles.fileName}>{videoFileName}</span>
            </>
          )}
        </div>
        {(state === 'editing' || state === 'burning') && (
          <button className={styles.newBtn} onClick={reset}>
            + New video
          </button>
        )}
      </header>

      <ErrorBanner />

      {isLanding && (
        <section className={styles.hero}>
          <p className={styles.tagline}>LOCAL · PRIVATE · OFFLINE</p>
          <h1 className={styles.headline}>
            Captions that<br />
            <span className={styles.accent}>burn in.</span>
          </h1>
          <p className={styles.subheadline}>
            Drop a video. Whisper transcribes it. Edit every word inline.<br />
            Burn captions directly into the file.
          </p>

          <DropZone onFile={handleVideoFile} />

          <div className={styles.features}>
            <div className={styles.feature}>
              <p className={styles.featureLabel}>TRANSCRIPTION</p>
              <p className={styles.featureValue}>Whisper AI</p>
            </div>
            <div className={styles.feature}>
              <p className={styles.featureLabel}>OUTPUT</p>
              <p className={styles.featureValue}>.srt · .vtt · <span className={styles.accent}>burned in</span></p>
            </div>
            <div className={styles.feature}>
              <p className={styles.featureLabel}>PRIVACY</p>
              <p className={styles.featureValue}>100% <span className={styles.accent}>local</span></p>
            </div>
          </div>
        </section>
      )}

      {state === 'configuring' && (
        <ConfigScreen onStart={handleStartTranscription} onCancel={reset} />
      )}

      {isBusy && (
        <div className={styles.busy}>
          <div className={styles.spinner} />
          <p className={styles.busyTitle}>
            {state === 'uploading' ? 'Uploading video…' : 'Transcribing with Whisper…'}
          </p>
          {videoFileName && <p className={styles.busyFile}>{videoFileName}</p>}

          {state === 'transcribing' && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${transcribeProgress}%` }} />
              </div>
              <p className={styles.progressLabel}>{transcribeProgress}%</p>
            </div>
          )}

          <p className={styles.busySub}>
            {state === 'transcribing'
              ? 'Whisper processes about 5× faster than real-time on most machines.'
              : 'This may take a moment'}
          </p>
        </div>
      )}

      {(state === 'editing' || state === 'burning') && (
        <div className={styles.editor}>
          <div className={styles.editorLeft}>
            <VideoPlayer />
            <Toolbar />
          </div>
          <div className={styles.editorRight}>
            <SpeakerPanel />
            <CaptionEditor />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
