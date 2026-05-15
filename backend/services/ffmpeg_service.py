import logging
import os
import re
import shutil
import subprocess
import tempfile

from ..models.schemas import BurnStyle, Caption

log = logging.getLogger(__name__)

_HEX_COLOR_RE = re.compile(r"^#?[0-9A-Fa-f]{6}$")
_FONT_NAME_RE = re.compile(r"^[A-Za-z0-9 _-]{1,64}$")


def _ffmpeg() -> str:
    env = os.environ.get("FFMPEG_BIN")
    if env and os.path.isfile(env):
        return env
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError("ffmpeg not found. Install ffmpeg or set FFMPEG_BIN.")


def _format_srt_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")


def _format_vtt_ts(seconds: float) -> str:
    return _format_srt_ts(seconds).replace(",", ".")


def _format_ass_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    cs = int((s % 1) * 100)
    return f"{h}:{m:02d}:{int(s):02d}.{cs:02d}"


def _hex_to_ass_color(hex_str: str) -> str:
    """Convert "#RRGGBB" to ASS's &HAABBGGRR. Unrecognized input → white."""
    if not _HEX_COLOR_RE.match(hex_str or ""):
        return "&H00FFFFFF"
    h = hex_str.lstrip("#")
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f"&H00{b}{g}{r}".upper()


def _safe_font(font: str) -> str:
    return font if _FONT_NAME_RE.match(font or "") else "Arial"


def _safe_font_size(size: int) -> int:
    try:
        n = int(size)
    except (TypeError, ValueError):
        return 48
    return max(12, min(200, n))


def _escape_ass_text(text: str) -> str:
    """Sanitize caption text for an ASS Dialogue line.

    libass treats `{...}` as override-tag blocks; we escape braces to prevent
    injection. Newlines become `\\N`. Control chars are dropped.
    """
    if not text:
        return ""
    t = "".join(ch for ch in text if ch == "\t" or ord(ch) >= 0x20 or ch in "\r\n")
    t = t.replace("\r\n", "\n").replace("\r", "\n").replace("\n", r"\N")
    t = t.replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}")
    # The `\\` replace above clobbered our intentional `\N`. Restore it.
    t = t.replace(r"\\N", r"\N")
    return t


def _escape_cue_text(text: str) -> str:
    """Sanitize caption text for SRT/VTT cue body. Drops newlines and `-->`."""
    if not text:
        return ""
    t = "".join(ch for ch in text if ch == "\t" or ord(ch) >= 0x20 or ch in "\r\n")
    t = t.replace("\r\n", " ").replace("\r", " ").replace("\n", " ")
    t = t.replace("-->", "→")
    return t.strip()


def _sanitize_stderr(stderr: str) -> str:
    """Trim FFmpeg stderr for safe display: hide the home dir and keep the tail."""
    if not stderr:
        return ""
    home = os.path.expanduser("~")
    cleaned = stderr.replace(home, "~")
    tail = cleaned.strip().splitlines()[-5:]
    return " | ".join(tail)


# ASS alignment numpad: 2=bottom-center, 5=middle-center, 8=top-center
_POSITION_PARAMS = {
    "top": {"alignment": 8, "margin_v": 30},
    "middle": {"alignment": 5, "margin_v": 0},
    "bottom": {"alignment": 2, "margin_v": 30},
}


_STYLE_NAME_RE = re.compile(r"[^A-Za-z0-9_]")


def _safe_style_name(label: str) -> str:
    """ASS style names must be a single token (alphanumeric + underscore)."""
    cleaned = _STYLE_NAME_RE.sub("_", label or "")
    return cleaned[:32] or "Speaker"


def _style_line(
    name: str, font: str, font_size: int, primary: str, outline: str, alignment: int, margin_v: int
) -> str:
    return (
        f"Style: {name},{font},{font_size},{primary},&H000000FF,{outline},"
        f"&H80000000,-1,0,0,0,100,100,0,0,1,3,1,{alignment},10,10,{margin_v},1"
    )


def _build_ass(
    captions: list[Caption],
    style: BurnStyle | None,
    speaker_colors: dict[str, str] | None = None,
) -> str:
    st = style or BurnStyle()
    default_primary = _hex_to_ass_color(st.color)
    outline = _hex_to_ass_color(st.outlineColor)
    font = _safe_font(st.fontFamily)
    font_size = _safe_font_size(st.fontSize)
    pos = _POSITION_PARAMS.get(st.position, _POSITION_PARAMS["bottom"])
    alignment = pos["alignment"]
    margin_v = pos["margin_v"]

    # One Style per detected speaker, plus Default for unattributed captions.
    speaker_style_names: dict[str, str] = {}
    style_lines: list[str] = [
        _style_line("Default", font, font_size, default_primary, outline, alignment, margin_v),
    ]
    if speaker_colors:
        for label, color in speaker_colors.items():
            name = _safe_style_name(label)
            speaker_style_names[label] = name
            primary = _hex_to_ass_color(color)
            style_lines.append(
                _style_line(name, font, font_size, primary, outline, alignment, margin_v)
            )

    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1920",
        "PlayResY: 1080",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        *style_lines,
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for cap in captions:
        safe_text = _escape_ass_text(cap.text)
        style_name = speaker_style_names.get(cap.speaker or "", "Default")
        lines.append(
            f"Dialogue: 0,{_format_ass_ts(cap.start)},{_format_ass_ts(cap.end)},"
            f"{style_name},,0,0,0,,{safe_text}"
        )
    return "\n".join(lines)


def burn_captions(
    video_path: str,
    captions: list[Caption],
    output_path: str,
    style: BurnStyle | None = None,
    speaker_colors: dict[str, str] | None = None,
) -> str:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".ass", delete=False, encoding="utf-8") as f:
        f.write(_build_ass(captions, style, speaker_colors))
        ass_path = f.name

    try:
        cmd = [
            _ffmpeg(),
            "-y",
            "-i",
            video_path,
            "-vf",
            f"ass={ass_path}",
            "-c:a",
            "copy",
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            log.error("FFmpeg failed: %s", result.stderr)
            raise RuntimeError(f"FFmpeg failed: {_sanitize_stderr(result.stderr)}")
    finally:
        os.unlink(ass_path)

    return output_path


def to_srt(captions: list[Caption]) -> str:
    blocks = []
    for i, cap in enumerate(captions, 1):
        blocks.append(
            f"{i}\n{_format_srt_ts(cap.start)} --> {_format_srt_ts(cap.end)}\n"
            f"{_escape_cue_text(cap.text)}\n"
        )
    return "\n".join(blocks)


def to_vtt(captions: list[Caption]) -> str:
    lines = ["WEBVTT", ""]
    for cap in captions:
        lines.append(
            f"{_format_vtt_ts(cap.start)} --> {_format_vtt_ts(cap.end)}\n"
            f"{_escape_cue_text(cap.text)}\n"
        )
    return "\n".join(lines)
