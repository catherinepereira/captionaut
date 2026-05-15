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


Position = Literal["top", "middle", "bottom"]


class BurnStyle(BaseModel):
    fontFamily: str = "Arial"
    fontSize: int = 48
    color: str = "#FFFFFF"
    outlineColor: str = "#000000"
    position: Position = "bottom"


class BurnRequest(BaseModel):
    job_id: str
    captions: list[Caption]
    style: BurnStyle | None = None
    speaker_colors: dict[str, str] | None = None


class ExportRequest(BaseModel):
    captions: list[Caption]
    format: Literal["srt", "vtt"]
