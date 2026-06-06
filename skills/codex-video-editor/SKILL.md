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
- Hand the exact preview state back to Codex for final render.
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
10. Treat the editor as a minimal correction surface. Codex should still make the main edit decisions.

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
   - optional matched CTA/ad opener, transition, and ending card

   Codex should populate this JSON directly where possible. The preview editor is mainly for checking the result, dragging clips left/right, splitting a kept range into two source ranges, trimming clip handles, editing captions, muting source audio, previewing music, and adjusting music volume.

5. Choose music:
   - Use `src/lib/music/catalog.ts` for music brief presets.
   - Pick a brief based on tone, platform, speech density, and target age/audience.
   - Use `youtube-audio-library-import` when the user wants official YouTube Audio Library discovery or manual import guidance.
   - Prefer instrumental tracks for speech-heavy videos.
   - Keep music volume low by default, usually 0.16-0.24 under speech.
   - Enable ducking under speech unless the user explicitly wants a music-led edit.
   - For no-speech sections, use a `volumeAutomation` graph instead of one flat music level.
   - Set no-speech music near 0.75-0.9, speech bed near 0.16-0.24, and ramp over roughly 0.25-0.5 seconds.
   - Capture title, artist, source URL, license URL, and attribution in timeline JSON.
   - If the user wants no attribution, ask them to confirm a paid/no-attribution license or choose a CC0/public-domain source.

6. Preview:
   - Run the local Next.js app.
   - Use the preview/editor for small manual changes.
   - Do not render MP4 while iterating.
   - The app autosaves the current edit to browser local storage as a safety net.
   - The app also writes the active project to `projects/{projectId}.json` and polls that file for Codex-side edits.
   - Explain the main surfaces if the user is new:
     - Preview area: live video, captions, overlays, opener, ending.
     - Composite timeline: source rows, fixed caption row, separate music channel, transitions, ending block.
     - Left rails: mute source audio, hear music, and keep audio separate from visual tracks.
     - Music panel/workspace: preview attributed tracks and adjust the speech bed graph.
     - Template workspace: preview Remotion opener, caption, transition, and ending ideas.
   - If the user is stuck on style, open the Template workspace and let them browse a few options. Codex can then copy the chosen preset back into timeline JSON.

7. Export only on request:
   - Export timeline JSON.
   - Export captions.
   - Render final MP4 with Remotion/FFmpeg.
   - Run boundary diagnostics before showing the final render.

## Editor Handoff

Use the editor when the user needs to inspect or lightly correct the result. Avoid asking them to rebuild the edit manually.

Recommended pattern:

1. Codex creates or updates the timeline JSON.
2. Launch the editor and load the project. Prefer `projects/{projectId}.json` for live paired edits because the browser reads and writes that ignored workspace file.
3. Ask the user to check only the necessary controls:
   - move clip blocks left/right
   - trim clip starts/ends
   - click a caption once to edit text
   - click a clip to adjust source volume or mute
   - click music to adjust music volume and speech bed
4. After the user is satisfied, tell them to click **Render with Codex**.
5. Read the generated `projects/*.render-project.json` and `projects/*.render-edl.json`.
6. Render exactly that state. Do not reselect clips or change timing unless the files are internally invalid.

The render prompt created by the app is acceptable as the next Codex instruction. It includes paths and a serialized EDL with source ranges, caption layers, transitions, music automation, attribution, and total duration.

## Populating The Editor

When preparing a project for preview:

- Create source entries with stable `src`, `name`, `duration`, `volume`, and `muted`.
- Create clips with `rawStart`, `rawEnd`, `safeStart`, `safeEnd`, `timelineStart`, and `volume`.
- To split a clip, do not cut the source media. Create two clip objects that reference the same source file with different `safeStart`/`safeEnd` ranges. Subsequent source timestamps remain hidden in preview.
- Link captions to clips with `clipId` and segment ids where available.
- Keep captions on the caption channel; do not move them into source channels.
- Keep music on the music channel; do not mix music into visual clips in preview JSON.
- Let music tracks cover the full visual edit by default. If the user extends music in the timeline, preserve or regenerate a fade-out at the final music end.
- Store required music attribution on the music track so final export can create ending credits or description text.
- Use `projects/{projectId}.json` or app APIs for persistence; never commit private project JSON.

## Template Selection

Use the template catalog in `src/lib/templates/catalog.ts`.

If using an ad/CTA ending, consider a matched starter kit:

- `ad-cta-stinger` opening screen for the first bumper.
- `ad-stinger` transition around the promotional wrapper.
- `ad-cta-card` or `sponsor-end-card` for the final wrap-up.

The Template workspace has an **Ads / CTA** category for paired start/transition/end presets. Use it when the user wants an advertisement-like ending, sponsor segment, campaign CTA, or is unsure what style to choose.

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
