---
name: codex-video-editor
description: Edit videos with Codex using local transcript/timeline JSON, Remotion templates, FFmpeg diagnostics, and the local preview editor. Use when the user wants Codex to choose clips, create captions, inspect cut boundaries, apply Remotion styles, or prepare final export instructions without repeatedly rendering MP4s.
---

# Codex Video Editor

## Role

Codex is the editor brain. The local preview app is the viewer/tweak surface.

Use this skill to:

- Inventory source videos.
- Transcribe locally with faster-whisper when available.
- Pack transcripts into a compact reading view.
- Select clips from transcript evidence.
- Generate timeline JSON.
- Preview and tweak in the local editor.
- Use Remotion template presets for openers, captions, overlays, and transitions.
- Suggest music direction from curated briefs before importing tracks.
- Render only when the user explicitly asks for export.

## Hard Rules

1. Do not render MP4s during normal editing. Preview with timeline JSON.
2. Do not commit or publish user media, transcripts, generated videos, or local project JSON.
3. Keep the timeline JSON as the editable source of truth.
4. Prefer local transcription first. Use provider abstractions for future cloud transcription.
5. Apply captions/overlays live in preview. Burn into video only during final export.
6. When exporting, apply subtitles after overlays.
7. Use short fades at clip boundaries to avoid audio pops.
8. Keep sample/demo footage out of public repository commits.
9. Do not assume music is safe because it is "free" or "royalty free"; require source URL, license, and attribution text.

## Public Repository Layout

```text
skills/codex-video-editor/     Codex workflow skill
scripts/                       Local helper scripts
src/app/                       Next.js preview/editor app
src/components/remotion/        Remotion template components
src/lib/templates/              Template catalog/preset JSON
src/lib/music/                  Music source catalog and Codex music briefs
public/music/                   User-provided music manifest
public/uploads/                 Local user uploads, ignored by git
```

## Workflow

1. Ask for the desired output:
   - target length
   - tone/style
   - target platform/aspect
   - must-keep or must-cut moments

2. Transcribe:
   - Use `scripts/transcribe.py`.
   - Prefer GPU/CUDA when available.
   - Fall back to CPU when needed.
   - Keep transcript schema provider-agnostic.

3. Read:
   - Pack transcript with the app's Codex tab or API.
   - Use transcript ranges for first-pass edit decisions.
   - Use diagnostic filmstrip/waveform only at ambiguous cuts.

4. Build timeline JSON:
   - opening screen
   - source clips
   - captions
   - overlays
   - music
   - music volume automation
   - fades/transitions

5. Choose music:
   - Use `src/lib/music/catalog.ts` for music brief presets.
   - Pick a brief based on tone, platform, speech density, and target age/audience.
   - Prefer instrumental tracks for speech-heavy videos.
   - Keep music volume low by default, usually 0.16-0.24 under speech.
   - Enable ducking under speech unless the user explicitly wants a music-led edit.
   - For no-speech sections, use a `volumeAutomation` graph instead of one flat music level.
   - Set no-speech music near 0.8-1.0, speech bed near 0.16-0.24, and ramp over roughly 0.5-0.8 seconds.
   - Capture title, artist, source URL, license URL, and attribution in timeline JSON.
   - If the user wants no attribution, ask them to confirm a paid/no-attribution license or choose a CC0/public-domain source.

6. Preview:
   - Run the local Next.js app.
   - Use the preview/editor for small manual changes.
   - Do not render MP4 while iterating.

7. Export only on request:
   - Export timeline JSON.
   - Export captions.
   - Render final MP4 with Remotion/FFmpeg.
   - Run boundary diagnostics before showing the final render.

## Template Selection

Use the template catalog in `src/lib/templates/catalog.ts`.

Example intent:

```json
{
  "videoType": "interview",
  "opener": "documentary",
  "subtitleStyle": "premium-documentary",
  "transitionStyle": "fade"
}
```

Translate that into timeline JSON and Remotion component props. If the user asks for a style not in the catalog, create a new preset rather than mutating an unrelated one.

## Music Selection

Use the music catalog in `src/lib/music/catalog.ts`.

Example intent:

```json
{
  "musicIntent": {
    "preset": "upbeat-shortform",
    "searchPrompt": "upbeat instrumental creator music, 90-120 bpm, positive, no heavy vocals",
    "mix": {
      "defaultVolume": 0.22,
      "duckUnderSpeech": true,
      "fadeIn": 2,
      "fadeOut": 2
    }
  }
}
```

When suggesting music, give the user 2-4 brief choices such as:

- Upbeat Short-Form for energetic recaps.
- Lo-Fi Study Beat for teaching/reflection.
- Warm Documentary for interviews.
- Gen Z Pop Energy for social clips.

Then direct them to the Music workspace or the Music panel to import a specific track. Do not download or add a track unless the license is confirmed.

## Local Commands

```bash
npm install
npm run dev
python scripts/transcribe.py --input public/uploads/input.mp4 --model small --output transcripts/input.transcript.json
```

The preview app runs at `http://127.0.0.1:3001` when launched with:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3001
```

## What Not To Do

- Do not upload user footage to a public repository.
- Do not assume bundled sample media exists.
- Do not use cloud transcription unless the provider is explicitly configured.
- Do not turn the app into an AI generator that constantly renders files.
- Do not hide timeline JSON from the user.
