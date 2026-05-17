import { useState } from 'react'
import { useCaptionStore } from './stores/captionStore'
import { useGlobalKeybinds } from './hooks/useGlobalKeybinds'
import { useProjectPersistence } from './hooks/useProjectPersistence'
import { useVideoPipeline } from './hooks/useVideoPipeline'
import { AppHeader } from './components/AppHeader'
import { LandingHero } from './components/LandingHero'
import { BusyView } from './components/BusyView'
import { VideoPlayer } from './components/VideoPlayer'
import { CaptionTimeline } from './components/CaptionTimeline'
import { CaptionEditor } from './components/CaptionEditor'
import { Toolbar } from './components/Toolbar'
import { ErrorBanner } from './components/ErrorBanner'
import { ConfigScreen } from './components/ConfigScreen'
import { SpeakerPanel } from './components/SpeakerPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { ToastStack } from './components/ToastStack'
import { RestoreProjectModal } from './components/RestoreProjectModal'
import { ConfirmModal } from './components/ConfirmModal'

export function App() {
  const state = useCaptionStore((s) => s.state)
  const reset = useCaptionStore((s) => s.reset)
  const isReTranscribing = useCaptionStore((s) => s.isReTranscribing)
  const setReTranscribing = useCaptionStore((s) => s.setReTranscribing)
  const setState = useCaptionStore((s) => s.setState)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const {
    handleVideoFile, handleStartTranscription, continueProjectWithFile, handleReTranscribe,
    restorePrompt,
    reTranscribePromptOpen, resolveReTranscribe,
  } = useVideoPipeline()

  useGlobalKeybinds()
  useProjectPersistence()

  const isBusy = state === 'uploading' || state === 'transcribing'
  const isEditing = state === 'editing' || state === 'rendering'

  return (
    <div className="min-h-screen">
      <AppHeader onNewVideo={reset} onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ErrorBanner />

      <main>
        {state === 'idle' && (
          <LandingHero
            onFile={handleVideoFile}
            onContinueProject={continueProjectWithFile}
          />
        )}

        {state === 'configuring' && (
          <ConfigScreen
            onStart={handleStartTranscription}
            onCancel={() => {
              if (isReTranscribing) {
                setReTranscribing(false)
                setState('editing')
              } else {
                reset()
              }
            }}
          />
        )}

        {isBusy && <BusyView />}

        {isEditing && (
          <div className="grid gap-7 px-10 py-7 mx-auto items-start max-w-[1680px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_460px]">
            <div className="flex flex-col gap-3">
              <VideoPlayer />
              <CaptionTimeline />
              <Toolbar onReTranscribe={handleReTranscribe} />
            </div>
            <div className="lg:sticky lg:top-6">
              <SpeakerPanel />
              <CaptionEditor />
            </div>
          </div>
        )}
      </main>

      <RestoreProjectModal prompt={restorePrompt} />
      <ConfirmModal
        open={reTranscribePromptOpen}
        title="Re-transcribe?"
        message="Re-transcribing will replace your current captions, speakers, and edits."
        confirmLabel="Continue"
        cancelLabel="Cancel"
        onClose={() => resolveReTranscribe(false)}
        onConfirm={() => resolveReTranscribe(true)}
      />
      <ToastStack />
    </div>
  )
}

export default App
