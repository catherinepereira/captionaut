import { useRef, useState } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import { alignScript, burnCaptions, exportCaptions, errMsg, downloadBlob } from '../api'
import { StylePanel } from './StylePanel'
import styles from './Toolbar.module.css'

export function Toolbar() {
  const {
    state, jobId, captions, burnStyle, speakerColors,
    setState, setAlignment, setError,
  } = useCaptionStore()
  const scriptRef = useRef<HTMLInputElement>(null)
  const [styleOpen, setStyleOpen] = useState(false)

  const canEdit = state === 'editing' || state === 'burning'

  const handleScriptUpload = async (file: File) => {
    if (!jobId) return
    try {
      setAlignment(await alignScript(jobId, file))
    } catch (e) {
      setError(`Script alignment failed: ${errMsg(e)}`)
    }
  }

  const handleBurn = async () => {
    if (!jobId || captions.length === 0) return
    setState('burning')
    try {
      const blob = await burnCaptions(jobId, captions, burnStyle, speakerColors)
      downloadBlob(blob, 'captioned.mp4')
    } catch (e) {
      setError(`Burn-in failed: ${errMsg(e)}`)
    } finally {
      setState('editing')
    }
  }

  const handleExport = async (format: 'srt' | 'vtt') => {
    if (captions.length === 0) return
    try {
      const text = await exportCaptions(captions, format)
      downloadBlob(new Blob([text], { type: 'text/plain' }), `captions.${format}`)
    } catch (e) {
      setError(`Export failed: ${errMsg(e)}`)
    }
  }

  if (!canEdit) return null

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.left}>
          <input
            ref={scriptRef}
            type="file"
            accept=".txt,.srt"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScriptUpload(f) }}
          />
          <button className={styles.btn} onClick={() => scriptRef.current?.click()}>
            Import script
          </button>
          <button className={styles.btn} onClick={() => setStyleOpen(true)}>
            Style
          </button>
        </div>

        <div className={styles.right}>
          <button className={styles.btn} onClick={() => handleExport('srt')}>
            Export .srt
          </button>
          <button className={styles.btn} onClick={() => handleExport('vtt')}>
            Export .vtt
          </button>
          <button
            className={`${styles.btn} ${styles.primary}`}
            onClick={handleBurn}
            disabled={state === 'burning'}
          >
            {state === 'burning' ? 'Burning…' : 'Burn into video'}
          </button>
        </div>
      </div>
      <StylePanel open={styleOpen} onClose={() => setStyleOpen(false)} />
    </>
  )
}
