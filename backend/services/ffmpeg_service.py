import logging
import os
import re
import shutil
import subprocess
import tempfile

from ..models.schemas import CaptionStyle, Caption

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


def _hex_to_ass_inline_color(hex_str: str) -> str | None:
    """Convert "#RRGGBB" to the inline-override form `&HBBGGRR&`.

    Inline color tags (`\\1c`, `\\3c`) take BGR without alpha and a trailing
    `&`. Returns None for invalid input so the caller can skip the override.
    """
    if not _HEX_COLOR_RE.match(hex_str or ""):
        return None
    h = hex_str.lstrip("#")
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f"&H{b}{g}{r}&".upper()


def _safe_font(font: str) -> str:
    return font if _FONT_NAME_RE.match(font or "") else "Arial"


def _safe_font_size(size: int) -> int:
    try:
        n = int(size)
    except (TypeError, ValueError):
        return 48
    return max(12, min(200, n))


def _safe_outline_thickness(thickness: float) -> float:
    try:
        n = float(thickness)
    except (TypeError, ValueError):
        return 7.0
    if n != n:  # NaN
        return 7.0
    return max(0.0, min(20.0, n))




def _escape_ass_text(text: str) -> str:
    """Sanitize caption text for an ASS Dialogue line.

    libass treats `{...}` as override-tag blocks, so braces are escaped to
    prevent injection. Newlines become `\\N`. Control chars are dropped.
    """
    if not text:
        return ""
    t = "".join(ch for ch in text if ch == "\t" or ord(ch) >= 0x20 or ch in "\r\n")
    t = t.replace("\r\n", "\n").replace("\r", "\n").replace("\n", r"\N")
    t = t.replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}")
    # The `\\` replace above clobbered the intentional `\N`. Restore it.
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


# ASS alignment uses numpad layout: rows are top(7/8/9), middle(4/5/6),
# bottom(1/2/3), columns are left/center/right. Anchor at the bottom row
# (1/2/3) so the visual "position" point sits at the text baseline, then use
# an inline \pos(x,y) override per caption to drop the text precisely.
PLAY_RES_X = 1920
PLAY_RES_Y = 1080

_ALIGN_NUM = {"left": 1, "center": 2, "right": 3}


def _clamp_pct(v: float, default: float) -> float:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return default
    if n != n:
        return default
    return max(0.0, min(100.0, n))


_STYLE_NAME_RE = re.compile(r"[^A-Za-z0-9_]")


def _safe_style_name(label: str) -> str:
    """ASS style names must be a single token (alphanumeric + underscore)."""
    cleaned = _STYLE_NAME_RE.sub("_", label or "")
    return cleaned[:32] or "Speaker"


def _style_line(
    name: str,
    font: str,
    font_size: int,
    primary: str,
    outline: str,
    alignment: int,
    outline_thickness: float,
) -> str:
    # The 17th field (Outline) is the border thickness in pixels, and ASS
    # accepts floats. Shadow stays at 1 to match the prior look.
    thickness = _safe_outline_thickness(outline_thickness)
    thickness_str = f"{thickness:g}"
    return (
        f"Style: {name},{font},{font_size},{primary},&H000000FF,{outline},"
        f"&H80000000,-1,0,0,0,100,100,0,0,1,{thickness_str},1,{alignment},10,10,0,1"
    )


def _build_ass(
    captions: list[Caption],
    style: CaptionStyle | None,
    speaker_colors: dict[str, str] | None = None,
    speaker_outline_colors: dict[str, str] | None = None,
    speaker_outline_thickness: dict[str, float] | None = None,
    speaker_font_families: dict[str, str] | None = None,
    speaker_font_sizes: dict[str, int] | None = None,
    speaker_pos_x: dict[str, float] | None = None,
    speaker_pos_y: dict[str, float] | None = None,
    speaker_align: dict[str, str] | None = None,
) -> str:
    st = style or CaptionStyle()
    default_primary = _hex_to_ass_color(st.color)
    default_outline = _hex_to_ass_color(st.outlineColor)
    font = _safe_font(st.fontFamily)
    font_size = _safe_font_size(st.fontSize)
    outline_thickness = _safe_outline_thickness(st.outlineThickness)
    default_align = _ALIGN_NUM.get(st.align, 2)
    default_pos_x_pct = _clamp_pct(st.posX, 50.0)
    default_pos_y_pct = _clamp_pct(st.posY, 90.0)

    # One Style per detected speaker, plus Default for unattributed captions.
    # Each speaker carries its own primary, outline, thickness, font, and size.
    speaker_style_names: dict[str, str] = {}
    style_lines: list[str] = [
        _style_line(
            "Default", font, font_size, default_primary, default_outline,
            default_align, outline_thickness,
        ),
    ]
    if speaker_colors:
        for label, color in speaker_colors.items():
            name = _safe_style_name(label)
            speaker_style_names[label] = name
            primary = _hex_to_ass_color(color)
            outline_color = _hex_to_ass_color(
                (speaker_outline_colors or {}).get(label, st.outlineColor)
            )
            sp_thickness = (speaker_outline_thickness or {}).get(label, outline_thickness)
            sp_font = _safe_font((speaker_font_families or {}).get(label, font))
            sp_size = _safe_font_size((speaker_font_sizes or {}).get(label, font_size))
            sp_align = _ALIGN_NUM.get((speaker_align or {}).get(label, ""), default_align)
            style_lines.append(
                _style_line(
                    name, sp_font, sp_size, primary, outline_color,
                    sp_align, sp_thickness,
                )
            )

    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {PLAY_RES_X}",
        f"PlayResY: {PLAY_RES_Y}",
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

        # Resolve position + alignment with hierarchy: global < speaker < caption.
        sp_label = cap.speaker or ""
        eff_pos_x_pct = default_pos_x_pct
        eff_pos_y_pct = default_pos_y_pct
        if sp_label and speaker_pos_x and sp_label in speaker_pos_x:
            eff_pos_x_pct = _clamp_pct(speaker_pos_x[sp_label], default_pos_x_pct)
        if sp_label and speaker_pos_y and sp_label in speaker_pos_y:
            eff_pos_y_pct = _clamp_pct(speaker_pos_y[sp_label], default_pos_y_pct)
        if cap.pos_x_override is not None:
            eff_pos_x_pct = _clamp_pct(cap.pos_x_override, eff_pos_x_pct)
        if cap.pos_y_override is not None:
            eff_pos_y_pct = _clamp_pct(cap.pos_y_override, eff_pos_y_pct)

        eff_align = default_align
        if sp_label and speaker_align and sp_label in speaker_align:
            eff_align = _ALIGN_NUM.get(speaker_align[sp_label], default_align)
        if cap.align_override:
            eff_align = _ALIGN_NUM.get(cap.align_override, eff_align)

        pos_x = round(eff_pos_x_pct * PLAY_RES_X / 100)
        pos_y = round(eff_pos_y_pct * PLAY_RES_Y / 100)

        # Per-caption overrides take precedence over the speaker / default
        # style. Emitted as inline `{...}` tags to avoid minting a Style per
        # caption. `\pos` anchors the line at the user-chosen X%/Y% point in
        # the video frame. `\an` re-anchors alignment.
        override_tags = f"\\an{eff_align}\\pos({pos_x},{pos_y})"
        primary_override = _hex_to_ass_inline_color(cap.color_override or "")
        outline_override = _hex_to_ass_inline_color(cap.outline_override or "")
        if primary_override:
            override_tags += f"\\1c{primary_override}"
        if outline_override:
            override_tags += f"\\3c{outline_override}"
        if cap.outline_thickness is not None:
            override_tags += f"\\bord{_safe_outline_thickness(cap.outline_thickness):g}"
        if cap.font_family:
            override_tags += f"\\fn{_safe_font(cap.font_family)}"
        if cap.font_size is not None:
            override_tags += f"\\fs{_safe_font_size(cap.font_size)}"
        safe_text = f"{{{override_tags}}}{safe_text}"

        lines.append(
            f"Dialogue: 0,{_format_ass_ts(cap.start)},{_format_ass_ts(cap.end)},"
            f"{style_name},,0,0,0,,{safe_text}"
        )
    return "\n".join(lines)


# Codec + container flags keyed by the user-facing format selector. Each entry
# lists the additional ffmpeg arguments inserted before the output path.
_FORMAT_FLAGS: dict[str, list[str]] = {
    "mp4": [
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
    ],
    "webm": [
        "-c:v", "libvpx-vp9",
        "-b:v", "0",
        "-crf", "32",
        "-row-mt", "1",
        "-pix_fmt", "yuv420p",
        "-c:a", "libopus",
        "-b:a", "128k",
    ],
    "mov": [
        "-c:v", "prores_ks",
        "-profile:v", "3",  # HQ
        "-pix_fmt", "yuv422p10le",
        "-c:a", "pcm_s16le",
    ],
}


def render_captions(
    video_path: str,
    captions: list[Caption],
    output_path: str,
    style: CaptionStyle | None = None,
    format: str = "mp4",
    speaker_colors: dict[str, str] | None = None,
    speaker_outline_colors: dict[str, str] | None = None,
    speaker_outline_thickness: dict[str, float] | None = None,
    speaker_font_families: dict[str, str] | None = None,
    speaker_font_sizes: dict[str, int] | None = None,
    speaker_pos_x: dict[str, float] | None = None,
    speaker_pos_y: dict[str, float] | None = None,
    speaker_align: dict[str, str] | None = None,
) -> str:
    # Write the .ass next to the input video so ffmpeg gets a bare
    # filename for the `ass=` filter. Windows paths break libavfilter's
    # argument parser otherwise: backslashes get treated as escapes and the
    # drive-letter colon as an option separator.
    video_dir = os.path.dirname(os.path.abspath(video_path)) or "."
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".ass", delete=False, encoding="utf-8", dir=video_dir,
    ) as f:
        f.write(_build_ass(
            captions,
            style,
            speaker_colors=speaker_colors,
            speaker_outline_colors=speaker_outline_colors,
            speaker_outline_thickness=speaker_outline_thickness,
            speaker_font_families=speaker_font_families,
            speaker_font_sizes=speaker_font_sizes,
            speaker_pos_x=speaker_pos_x,
            speaker_pos_y=speaker_pos_y,
            speaker_align=speaker_align,
        ))
        ass_path = f.name

    fmt_flags = _FORMAT_FLAGS.get(format)
    if fmt_flags is None:
        raise ValueError(f"Unsupported render format: {format!r}")

    try:
        cmd = [
            _ffmpeg(),
            "-y",
            "-i",
            video_path,
            "-vf",
            f"ass={os.path.basename(ass_path)}",
            *fmt_flags,
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=video_dir)
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
