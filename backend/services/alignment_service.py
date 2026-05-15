from difflib import SequenceMatcher

from ..models.schemas import AlignmentResult, Caption


def align(captions: list[Caption], script: str) -> list[AlignmentResult]:
    script_lines = [ln.strip() for ln in script.splitlines() if ln.strip()]
    results = []
    for cap in captions:
        best_ratio = 0.0
        best_line = None
        for line in script_lines:
            ratio = SequenceMatcher(None, cap.text.lower(), line.lower()).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_line = line
        results.append(
            AlignmentResult(
                caption_id=cap.id,
                matched=best_ratio >= 0.6,
                script_text=best_line,
                similarity=round(best_ratio, 3),
            )
        )
    return results
