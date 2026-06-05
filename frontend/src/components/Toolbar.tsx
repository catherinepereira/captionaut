import { useRef, useState } from "react";
import { useCaptionStore } from "../stores/captionStore";
import {
  alignScript,
  renderCaptions,
  exportCaptions,
  errMsg,
  downloadBlob,
  type RenderFormat,
} from "../api";
import { StylePanel } from "./StylePanel";
import { RenderModal } from "./RenderModal";
import {
  SubtitleExportModal,
  type SubtitleFormat,
} from "./SubtitleExportModal";
import {
  buildCaptionautFile,
  parseCaptionautFile,
} from "../utils/captionautFile";

const btn =
  "bg-transparent border border-border text-text-primary text-[13px] font-medium px-4 py-2 rounded-md transition-colors hover:enabled:border-accent-light hover:enabled:text-accent-light disabled:opacity-50 disabled:cursor-default";
const primaryBtn =
  "bg-accent border border-accent text-white text-[13px] font-semibold px-4 py-2 rounded-md transition-colors hover:enabled:bg-accent-light hover:enabled:border-accent-light disabled:opacity-50 disabled:cursor-default";

interface Props {
  onReTranscribe: () => void;
}

export function Toolbar({ onReTranscribe }: Props) {
  const {
    state,
    jobId,
    captions,
    speakers,
    captionStyle,
    alignment,
    speakerColors,
    speakerOutlineColors,
    speakerOutlineThickness,
    speakerFontFamilies,
    speakerFontSizes,
    speakerPosX,
    speakerPosY,
    speakerAlign,
    videoFile,
    projectName,
    setState,
    setAlignment,
    setError,
    loadSavedSession,
    pushToast,
  } = useCaptionStore();
  const scriptRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [renderOpen, setRenderOpen] = useState(false);
  const [subtitleOpen, setSubtitleOpen] = useState(false);

  const canEdit = state === "editing" || state === "rendering";

  const handleScriptUpload = async (file: File) => {
    if (!jobId) return;
    try {
      setAlignment(await alignScript(jobId, file));
    } catch (e) {
      setError(`Script alignment failed: ${errMsg(e)}`);
    }
  };

  const handleRender = async (format: RenderFormat) => {
    if (!jobId || captions.length === 0) return;
    setState("rendering");
    try {
      const blob = await renderCaptions(
        jobId,
        captions,
        captionStyle,
        {
          colors: speakerColors,
          outlineColors: speakerOutlineColors,
          outlineThickness: speakerOutlineThickness,
          fontFamilies: speakerFontFamilies,
          fontSizes: speakerFontSizes,
          posX: speakerPosX,
          posY: speakerPosY,
          align: speakerAlign,
        },
        format,
      );
      downloadBlob(blob, `captioned.${format}`);
      setRenderOpen(false);
    } catch (e) {
      setError(`Render failed: ${errMsg(e)}`);
    } finally {
      setState("editing");
    }
  };

  const handleExportProject = () => {
    if (captions.length === 0) return;
    const file = buildCaptionautFile({
      sourceFileName: videoFile?.name ?? null,
      projectName: projectName ?? null,
      captions,
      speakers,
      speakerColors,
      speakerOutlineColors,
      speakerOutlineThickness,
      speakerFontFamilies,
      speakerFontSizes,
      speakerPosX,
      speakerPosY,
      speakerAlign,
      captionStyle,
      alignment,
    });
    const json = JSON.stringify(file, null, 2);
    const base = (projectName || videoFile?.name || "project").replace(
      /\.[^.]+$/,
      "",
    );
    downloadBlob(
      new Blob([json], { type: "application/json" }),
      `${base}.captionaut`,
    );
  };

  const handleImportProject = async (file: File) => {
    try {
      const text = await file.text();
      const data = parseCaptionautFile(text);
      loadSavedSession({ ...data, name: data.projectName });
      pushToast(
        "info",
        `Imported ${data.captions.length} caption${data.captions.length === 1 ? "" : "s"} from ${file.name}.`,
      );
    } catch (e) {
      setError(`Import failed: ${errMsg(e)}`);
    }
  };

  const handleExportSubtitles = async (format: SubtitleFormat) => {
    if (captions.length === 0) return;
    try {
      const text = await exportCaptions(captions, format);
      downloadBlob(
        new Blob([text], { type: "text/plain" }),
        `captions.${format}`,
      );
      setSubtitleOpen(false);
    } catch (e) {
      setError(`Export failed: ${errMsg(e)}`);
    }
  };

  if (!canEdit) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2.5 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            className={btn}
            onClick={onReTranscribe}
            disabled={!jobId || state === "rendering"}
            title="Re-run transcription with a different model or add speakers"
          >
            Re-transcribe
          </button>
          <input
            ref={scriptRef}
            type="file"
            accept=".txt,.srt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleScriptUpload(f);
            }}
          />
          <button className={btn} onClick={() => scriptRef.current?.click()}>
            Import script
          </button>
          <button className={btn} onClick={() => setStyleOpen(true)}>
            Style
          </button>
          <input
            ref={projectRef}
            type="file"
            accept=".captionaut,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportProject(f);
              if (projectRef.current) projectRef.current.value = "";
            }}
          />
          <button className={btn} onClick={() => projectRef.current?.click()}>
            Import .captionaut
          </button>
          <button
            className={btn}
            onClick={handleExportProject}
            disabled={captions.length === 0}
          >
            Export .captionaut
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={btn}
            onClick={() => setSubtitleOpen(true)}
            disabled={captions.length === 0}
          >
            Export subtitles
          </button>
          <button
            className={primaryBtn}
            onClick={() => setRenderOpen(true)}
            disabled={state === "rendering" || captions.length === 0}
          >
            {state === "rendering" ? "Rendering…" : "Render video"}
          </button>
        </div>
      </div>
      <StylePanel open={styleOpen} onClose={() => setStyleOpen(false)} />
      <RenderModal
        open={renderOpen}
        busy={state === "rendering"}
        onClose={() => setRenderOpen(false)}
        onConfirm={handleRender}
      />
      <SubtitleExportModal
        open={subtitleOpen}
        onClose={() => setSubtitleOpen(false)}
        onConfirm={handleExportSubtitles}
      />
    </>
  );
}
