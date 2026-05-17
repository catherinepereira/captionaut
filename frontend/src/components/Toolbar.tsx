import { useRef, useState } from 'react'
import { useCaptionStore } from '../stores/captionStore'
import { alignScript, burnCaptions, exportCaptions, errMsg, downloadBlob } from '../api'
import { StylePanel } from './StylePanel'
import { buildCaptionautFile, parseCaptionautFile } from '../utils/captionautFile'
import styles from './Toolbar.module.css'

export function Toolbar() {
  const {
    state, jobId, captions, speakers, burnStyle, alignment,
    speakerColors, speakerOutlineColors, speakerOutlineThickness,
    speakerFontFamilies, speakerFontSizes,
    videoFile,
    setState, setAlignment, setError, loadSavedSession, pushToast,
  } = useCaptionStore()
  const scriptRef = useRef<HTMLInputElement>(null)
  const projectRef = useRef<HTMLInputElement>(null)
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
      const blob = await burnCaptions(jobId, captions, burnStyle, {
        colors: speakerColors,
        outlineColors: speakerOutlineColors,
        outlineThickness: speakerOutlineThickness,
        fontFamilies: speakerFontFamilies,
        fontSizes: speakerFontSizes,
      })
      downloadBlob(blob, 'captioned.mp4')
    } catch (e) {
      setError(`Burn-in failed: ${errMsg(e)}`)
    } finally {
      setState('editing')
    }
  }

  const handleExportProject = () => {
    if (captions.length === 0) return
    const file = buildCaptionautFile({
      sourceFileName: videoFile?.name ?? null,
      captions,
      speakers,
      speakerColors,
      speakerOutlineColors,
      speakerOutlineThickness,
      speakerFontFamilies,
      speakerFontSizes,
      burnStyle,
      alignment,
    })
    const json = JSON.stringify(file, null, 2)
    const base = (videoFile?.name ?? 'project').replace(/\.[^.]+$/, '')
    downloadBlob(new Blob([json], { type: 'application/json' }), `${base}.captionaut`)
  }

  const handleImportProject = async (file: File) => {
    try {
      const text = await file.text()
      const data = parseCaptionautFile(text)
      loadSavedSession(data)
      pushToast('info', `Imported ${data.captions.length} caption${data.captions.length === 1 ? '' : 's'} from ${file.name}.`)
    } catch (e) {
      setError(`Import failed: ${errMsg(e)}`)
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
          <input
            ref={projectRef}
            type="file"
            accept=".captionaut,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleImportProject(f)
              if (projectRef.current) projectRef.current.value = ''
            }}
          />
          <button className={styles.btn} onClick={() => projectRef.current?.click()}>
            Import .captionaut
          </button>
          <button className={styles.btn} onClick={handleExportProject} disabled={captions.length === 0}>
            Export .captionaut
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
