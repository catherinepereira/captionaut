from pydantic import BaseModel
from typing import Literal, Optional


class Caption(BaseModel):
    id: int
    start: float
    end: float
    text: str
    speaker: Optional[str] = None


ModelSize = Literal["tiny", "base", "small", "medium", "large"]


class DiarizationOptions(BaseModel):
    enabled: bool = False
    hf_token: Optional[str] = None
    num_speakers: Optional[int] = None


class TranscribeRequest(BaseModel):
    model_size: ModelSize = "base"
    initial_prompt: Optional[str] = None
    diarization: DiarizationOptions = DiarizationOptions()
    denoise: bool = False


class TranscriptionResponse(BaseModel):
    job_id: str
    captions: list[Caption]
    speakers: list[str] = []


class AlignmentResult(BaseModel):
    caption_id: int
    matched: bool
    script_text: Optional[str] = None
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
    style: Optional[BurnStyle] = None
    speaker_colors: Optional[dict[str, str]] = None


class ExportRequest(BaseModel):
    captions: list[Caption]
    format: Literal["srt", "vtt"]
