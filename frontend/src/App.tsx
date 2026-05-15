import { useEffect, useState } from 'react'
import { useCaptionStore } from './stores/captionStore'
import { loadSettings } from './utils/settings'
import { useGlobalKeybinds } from './hooks/useGlobalKeybinds'
import { useProjectPersistence } from './hooks/useProjectPersistence'
import { useVideoPipeline } from './hooks/useVideoPipeline'
import { AppHeader } from './components/AppHeader'
import { LandingHero } from './components/LandingHero'
import { BusyView } from './components/BusyView'
import { VideoPlayer } from './components/VideoPlayer'
import { CaptionEditor } from './components/CaptionEditor'
import { Toolbar } from './components/Toolbar'
import { ErrorBanner } from './components/ErrorBanner'
import { ConfigScreen } from './components/ConfigScreen'
import { SpeakerPanel } from './components/SpeakerPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { ToastStack } from './components/ToastStack'
import styles from './App.module.css'

export function App() {
  const state = useCaptionStore((s) => s.state)
  const reset = useCaptionStore((s) => s.reset)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { handleVideoFile, handleStartTranscription } = useVideoPipeline()

  useGlobalKeybinds()
  useProjectPersistence()

  // Apply the user's saved default burn style on first render.
  useEffect(() => {
    useCaptionStore.getState().setBurnStyle(loadSettings().defaultBurnStyle)
  }, [])

  const isBusy = state === 'uploading' || state === 'transcribing'
  const isEditing = state === 'editing' || state === 'burning'

  return (
    <div className={styles.app}>
      <AppHeader onNewVideo={reset} onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ErrorBanner />

      <main>
        {state === 'idle' && <LandingHero onFile={handleVideoFile} />}

        {state === 'configuring' && (
          <ConfigScreen onStart={handleStartTranscription} onCancel={reset} />
        )}

        {isBusy && <BusyView />}

        {isEditing && (
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
      </main>

      <ToastStack />
    </div>
  )
}

export default App
