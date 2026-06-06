"""Create an on-demand filmstrip + waveform diagnostic PNG for Codex.

This is a local drill-down tool, not a renderer. It samples a short range of a
source video, draws a filmstrip, waveform, transcript labels, and detected
silence bands so Codex can inspect cut boundaries without scanning every frame.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


BG = (12, 18, 27)
PANEL = (18, 27, 39)
FG = (226, 232, 240)
DIM = (100, 116, 139)
CYAN = (103, 232, 249)
AMBER = (252, 211, 77)
SILENCE = (30, 64, 88, 150)


def run(cmd: list[str], capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        check=True,
        text=True,
        capture_output=capture,
        stdout=subprocess.DEVNULL if not capture else subprocess.PIPE,
        stderr=subprocess.DEVNULL if not capture else subprocess.PIPE,
    )


def load_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            try:
                return ImageFont.truetype(candidate, size)
            except OSError:
                continue
    return ImageFont.load_default()


def extract_frames(video: Path, start: float, end: float, count: int, dest: Path) -> list[Path]:
    count = max(1, count)
    if count == 1:
        times = [(start + end) / 2]
    else:
        step = (end - start) / (count - 1)
        times = [start + step * index for index in range(count)]

    paths: list[Path] = []
    for index, time in enumerate(times):
        out = dest / f"frame_{index:03d}.jpg"
        run([
            "ffmpeg",
            "-y",
            "-ss",
            f"{time:.3f}",
            "-i",
            str(video),
            "-frames:v",
            "1",
            "-q:v",
            "4",
            "-vf",
            "scale=280:-2",
            str(out),
        ])
        paths.append(out)
    return paths


def waveform(video: Path, start: float, end: float, samples: int) -> np.ndarray:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
        wav_path = Path(handle.name)
    try:
        result = subprocess.run([
            "ffmpeg",
            "-y",
            "-ss",
            f"{start:.3f}",
            "-i",
            str(video),
            "-t",
            f"{end - start:.3f}",
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            str(wav_path),
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode != 0 or not wav_path.exists() or wav_path.stat().st_size == 0:
            return np.zeros(samples)

        with wave.open(str(wav_path), "rb") as wav:
            pcm = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32)
        if pcm.size == 0:
            return np.zeros(samples)

        window = max(1, pcm.size // samples)
        usable = (pcm.size // window) * window
        env = np.sqrt(np.mean((pcm[:usable].reshape(-1, window) / 32768.0) ** 2, axis=1))
        if env.size < samples:
            env = np.pad(env, (0, samples - env.size))
        if env.size > samples:
            env = env[:samples]
        if env.max() > 0:
            env = env / env.max()
        return env
    finally:
        wav_path.unlink(missing_ok=True)


def detect_silences(video: Path, start: float, end: float) -> list[tuple[float, float]]:
    result = subprocess.run([
        "ffmpeg",
        "-hide_banner",
        "-ss",
        f"{start:.3f}",
        "-i",
        str(video),
        "-t",
        f"{end - start:.3f}",
        "-af",
        "silencedetect=n=-35dB:d=0.2",
        "-f",
        "null",
        "-",
    ], text=True, capture_output=True)
    silences: list[tuple[float, float]] = []
    active: float | None = None
    for line in result.stderr.splitlines():
        start_match = re.search(r"silence_start:\s*([0-9.]+)", line)
        if start_match:
            active = start + float(start_match.group(1))
            continue
        end_match = re.search(r"silence_end:\s*([0-9.]+)", line)
        if end_match and active is not None:
            silences.append((active, start + float(end_match.group(1))))
            active = None
    return silences


def transcript_units(path: Path | None, start: float, end: float) -> list[dict]:
    if not path or not path.exists():
        return []
    data = json.loads(path.read_text())
    raw_units = data.get("thoughts") or data.get("segments") or []
    units: list[dict] = []
    for item in raw_units:
        item_start = item.get("rawStart", item.get("start"))
        item_end = item.get("rawEnd", item.get("end"))
        text = str(item.get("text", "")).strip()
        if item_start is None or item_end is None or not text:
            continue
        if item_end <= start or item_start >= end:
            continue
        units.append({"start": float(item_start), "end": float(item_end), "text": text})
    return units


def render(video: Path, start: float, end: float, output: Path, transcript: Path | None, n_frames: int) -> None:
    if end <= start:
        raise SystemExit("end must be greater than start")

    header_font = load_font(24)
    label_font = load_font(16)
    small_font = load_font(13)

    width = 1800
    margin = 48
    film_y = 56
    film_h = 178
    wave_y = film_y + film_h + 30
    wave_h = 190
    transcript_y = wave_y + wave_h + 44
    height = transcript_y + 148
    track_w = width - margin * 2

    with tempfile.TemporaryDirectory() as tmp:
        frames = extract_frames(video, start, end, n_frames, Path(tmp))
        canvas = Image.new("RGB", (width, height), BG)
        draw = ImageDraw.Draw(canvas, "RGBA")

        draw.text((margin, 18), f"{video.name}  {start:.2f}s -> {end:.2f}s", fill=FG, font=header_font)

        x = margin
        frame_gap = 6
        slot_w = (track_w - frame_gap * (len(frames) - 1)) / max(1, len(frames))
        for frame_path in frames:
            img = Image.open(frame_path).convert("RGB")
            aspect = img.width / img.height
            draw_w = min(slot_w, film_h * aspect)
            resized = img.resize((int(draw_w), film_h), Image.LANCZOS)
            draw.rectangle((x, film_y, x + slot_w, film_y + film_h), fill=PANEL)
            canvas.paste(resized, (int(x + (slot_w - resized.width) / 2), film_y))
            x += slot_w + frame_gap

        def time_to_x(t: float) -> int:
            return int(margin + ((t - start) / (end - start)) * track_w)

        draw.rectangle((margin, wave_y, margin + track_w, wave_y + wave_h), fill=PANEL)
        for silence_start, silence_end in detect_silences(video, start, end):
            draw.rectangle(
                (time_to_x(max(start, silence_start)), wave_y, time_to_x(min(end, silence_end)), wave_y + wave_h),
                fill=SILENCE,
            )

        env = waveform(video, start, end, samples=int(track_w))
        mid = wave_y + wave_h // 2
        amp = wave_h // 2 - 10
        top: list[tuple[int, int]] = []
        bottom: list[tuple[int, int]] = []
        for index, value in enumerate(env):
            x_pos = margin + int(index * track_w / max(1, len(env) - 1))
            y_delta = int(value * amp)
            top.append((x_pos, mid - y_delta))
            bottom.append((x_pos, mid + y_delta))
        if top:
            draw.polygon(top + list(reversed(bottom)), fill=(*CYAN, 70))
            draw.line(top, fill=CYAN, width=1)
            draw.line(bottom, fill=CYAN, width=1)

        units = transcript_units(transcript, start, end)
        for unit in units:
            x0 = time_to_x(max(start, unit["start"]))
            x1 = time_to_x(min(end, unit["end"]))
            draw.rectangle((x0, transcript_y, x1, transcript_y + 20), fill=(*AMBER, 190))
            text = unit["text"]
            if len(text) > 84:
                text = text[:81].rstrip() + "..."
            draw.text((x0 + 4, transcript_y + 28), text, fill=FG, font=small_font)

        for index in range(7):
            frac = index / 6
            tick_time = start + (end - start) * frac
            tick_x = margin + int(track_w * frac)
            draw.line((tick_x, wave_y + wave_h + 4, tick_x, wave_y + wave_h + 12), fill=DIM, width=1)
            draw.text((tick_x - 24, wave_y + wave_h + 16), f"{tick_time:.2f}", fill=DIM, font=label_font)

        draw.text((margin, height - 36), "cyan = audio energy, blue bands = detected silence, amber = transcript units", fill=DIM, font=label_font)
        output.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(output, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a Codex video timeline diagnostic PNG")
    parser.add_argument("video", type=Path)
    parser.add_argument("start", type=float)
    parser.add_argument("end", type=float)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--transcript", type=Path, default=None)
    parser.add_argument("--n-frames", type=int, default=10)
    args = parser.parse_args()

    if not args.video.exists():
        sys.exit(f"video not found: {args.video}")
    render(args.video, args.start, args.end, args.output, args.transcript, args.n_frames)


if __name__ == "__main__":
    main()
