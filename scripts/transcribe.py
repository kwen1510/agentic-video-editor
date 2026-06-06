#!/usr/bin/env python3
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def ffprobe_duration(path: str) -> float:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            check=True,
            text=True,
            capture_output=True,
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0


def detect_gpu() -> bool:
    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            return True
    except Exception:
        pass
    return shutil.which("nvidia-smi") is not None


def default_model_for_device(device: str, requested: str | None) -> str:
    if requested:
        return requested
    return "medium" if device == "cuda" else "small"


def main() -> int:
    parser = argparse.ArgumentParser(description="Local faster-whisper transcription with hardware fallback.")
    parser.add_argument("--input", required=True, help="Input video/audio path.")
    parser.add_argument("--model", default=None, choices=["tiny", "base", "small", "medium", "large-v3"])
    parser.add_argument("--output", required=True, help="Output transcript JSON path.")
    parser.add_argument("--language", default=None, help="Optional language code.")
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        return 2

    try:
        from faster_whisper import WhisperModel  # type: ignore
    except Exception as exc:
        print(
            "faster-whisper is not installed in this Python environment. "
            "Install it locally to enable transcription: pip install faster-whisper",
            file=sys.stderr,
        )
        print(str(exc), file=sys.stderr)
        return 3

    has_gpu = detect_gpu()
    device = "cuda" if has_gpu else "cpu"
    compute_type = "float16" if has_gpu else "int8"
    model_name = default_model_for_device(device, args.model)

    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
    except Exception as exc:
        if device == "cuda":
            device = "cpu"
            compute_type = "int8"
            model_name = args.model or "small"
            model = WhisperModel(model_name, device=device, compute_type=compute_type)
        else:
            raise exc

    vad_filter = True
    try:
        segments_iter, info = model.transcribe(str(input_path), language=args.language, vad_filter=True)
    except Exception as exc:
        message = str(exc).lower()
        if "vad" not in message and "onnxruntime" not in message and "array_api" not in message:
            raise
        vad_filter = False
        segments_iter, info = model.transcribe(str(input_path), language=args.language, vad_filter=False)
    segments = []
    for index, segment in enumerate(segments_iter, start=1):
        segments.append(
            {
                "id": f"seg_{index}",
                "start": float(segment.start),
                "end": float(segment.end),
                "text": segment.text.strip(),
            }
        )

    result = {
        "language": getattr(info, "language", args.language or "unknown"),
        "duration": ffprobe_duration(str(input_path)),
        "provider": "local-faster-whisper",
        "model": model_name,
        "vadFilter": vad_filter,
        "hardware": {"device": device, "computeType": compute_type},
        "segments": segments,
    }

    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    raise SystemExit(main())
