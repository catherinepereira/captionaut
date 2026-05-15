"""Unit tests for service-layer helpers (no model loads required)."""

from backend.models.schemas import Caption
from backend.services import alignment_service, diarize_service, ffmpeg_service


def _caption(id_: int, start: float, end: float, text: str = "x") -> Caption:
    return Caption(id=id_, start=start, end=end, text=text)


def test_assign_speakers_picks_dominant_overlap():
    captions = [
        _caption(0, 0.0, 2.0),
        _caption(1, 2.0, 4.0),
        _caption(2, 4.0, 6.0),
    ]
    turns = [
        (0.0, 2.5, "SPEAKER_00"),
        (2.5, 5.0, "SPEAKER_01"),
        (5.5, 6.0, "SPEAKER_00"),
    ]
    out = diarize_service.assign_speakers(captions, turns)
    # id=2: SPEAKER_01 overlaps 1.0s, SPEAKER_00 overlaps 0.5s → SPEAKER_01 wins
    assert [c.speaker for c in out] == ["SPEAKER_00", "SPEAKER_01", "SPEAKER_01"]


def test_assign_speakers_empty_turns_passes_through():
    captions = [_caption(0, 0, 1)]
    assert diarize_service.assign_speakers(captions, []) is captions


def test_escape_ass_text_neutralizes_override_tags():
    raw = "{\\fnComic Sans}hello"
    escaped = ffmpeg_service._escape_ass_text(raw)
    # Curly braces escaped so libass treats them as literal text
    assert r"\{" in escaped
    assert "{" not in escaped.replace(r"\{", "").replace(r"\}", "")


def test_escape_ass_text_normalizes_newlines():
    escaped = ffmpeg_service._escape_ass_text("line one\nline two")
    assert r"\N" in escaped
    assert "\n" not in escaped


def test_escape_cue_text_strips_dashes():
    escaped = ffmpeg_service._escape_cue_text("middle --> arrow")
    assert "-->" not in escaped


def test_hex_to_ass_color_inverts_byte_order():
    # &HAABBGGRR ordering: red FF0000 → &H000000FF
    assert ffmpeg_service._hex_to_ass_color("#FF0000") == "&H000000FF"
    assert ffmpeg_service._hex_to_ass_color("#00FF00") == "&H0000FF00"


def test_hex_to_ass_color_rejects_garbage():
    assert ffmpeg_service._hex_to_ass_color("not a color") == "&H00FFFFFF"
    assert ffmpeg_service._hex_to_ass_color("#GGGGGG") == "&H00FFFFFF"


def test_to_srt_renders_sequential_blocks():
    captions = [
        _caption(0, 0.0, 1.0, "first"),
        _caption(1, 1.0, 2.0, "second"),
    ]
    out = ffmpeg_service.to_srt(captions)
    assert "1\n00:00:00,000 --> 00:00:01,000\nfirst" in out
    assert "2\n00:00:01,000 --> 00:00:02,000\nsecond" in out


def test_to_vtt_starts_with_header():
    out = ffmpeg_service.to_vtt([_caption(0, 0.0, 1.0, "hi")])
    assert out.startswith("WEBVTT")


def test_alignment_matches_close_text():
    captions = [_caption(0, 0, 1, "Hello there friend")]
    results = alignment_service.align(captions, "Hello there friend\nUnrelated line")
    assert results[0].matched is True
    assert results[0].similarity > 0.9
