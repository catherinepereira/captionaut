from typing import Literal

from pydantic import BaseModel


class Caption(BaseModel):
    id: int
    start: float
    end: float
    text: str
    speaker: str | None = None
    color_override: str | None = None
    outline_override: str | None = None
    outline_thickness: float | None = None
    font_family: str | None = None
    font_size: int | None = None


ModelSize = Literal["tiny", "base", "small", "medium", "large"]


class DiarizationOptions(BaseModel):
    enabled: bool = False
    hf_token: str | None = None
    num_speakers: int | None = None


class TranscribeRequest(BaseModel):
    model_size: ModelSize = "base"
    initial_prompt: str | None = None
    diarization: DiarizationOptions = DiarizationOptions()
    denoise: bool = False


class TranscriptionResponse(BaseModel):
    job_id: str
    captions: list[Caption]
    speakers: list[str] = []


class AlignmentResult(BaseModel):
    caption_id: int
    matched: bool
    script_text: str | None = None
    similarity: float


HorizontalAlign = Literal["left", "center", "right"]


class CaptionStyle(BaseModel):
    fontFamily: str = "Arial"
    fontSize: int = 48
    color: str = "#000000"
    outlineColor: str = "#FFFFFF"
    outlineThickness: float = 7.0
    posX: float = 50.0  # 0..100, percent of video width
    posY: float = 90.0  # 0..100, percent of video height
    align: HorizontalAlign = "center"


class RenderRequest(BaseModel):
    job_id: str
    captions: list[Caption]
    style: CaptionStyle | None = None
    speaker_colors: dict[str, str] | None = None
    speaker_outline_colors: dict[str, str] | None = None
    speaker_outline_thickness: dict[str, float] | None = None
    speaker_font_families: dict[str, str] | None = None
    speaker_font_sizes: dict[str, int] | None = None


class ExportRequest(BaseModel):
    captions: list[Caption]
    format: Literal["srt", "vtt"]
