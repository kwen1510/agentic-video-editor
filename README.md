# Agentic Video Editor

A Codex-first video editing workflow with a lightweight local preview editor.

## Codex Handoff Pitch

Paste the GitHub repo URL into Codex and ask:

```text
Install this repository locally and test that the Agentic Video Editor works as intended.

Follow the README exactly:
1. Clone the repo.
2. Install Node dependencies.
3. Install the bundled Codex skills.
4. Run typecheck, lint, and production build.
5. Start the Next.js dev server on an available localhost port.
6. Open and smoke-test the editor, template workspace, and music workspace.
7. Confirm that the editor previews timeline JSON live and does not render MP4s during editing.
8. Do not commit or upload any example videos, user media, transcripts, local music imports, project JSON, or rendered output.

After testing, report the local URL, what passed, what failed, and any missing local prerequisites such as FFmpeg, Python, CUDA, or faster-whisper.
```

This repo is meant to be shared as an installable Codex workflow, not as a bundle of example media. A receiving user should bring their own videos and music, or manually import licensed/attribution-friendly tracks.

The system has four parts:

1. **Codex skill**: editing workflow, transcript reading, clip decisions, diagnostics, and export orchestration.
2. **Remotion template workspace**: starter looks for interview clips, openers, subtitles, and transitions.
3. **Music workspace**: curated music-direction briefs and attribution-friendly source guides.
4. **Preview editor**: local JSON timeline preview with small manual tweaks before explicit final export.

## What This Is

This app is not an AI video generator that repeatedly renders MP4s. It stores edits as timeline JSON and previews them live.

Use it to:

- upload/select local videos
- preview source clips
- add/edit overlays and captions
- preview Remotion opening screens
- browse paired Ads/CTA Remotion kits for matched starting bumpers, transitions, and ending cards
- add music from a local manifest
- draw speech-aware music volume automation graphs
- inspect transcript-driven clip choices
- save/load editable timeline JSON
- autosave the current edit in browser local storage
- autosave the live project JSON to `projects/{projectId}.json` for Codex/user pairing
- create a Codex render packet from the exact preview state
- split a kept clip into two JSON source ranges without cutting the original media file
- extend music on the audio channel while keeping the final fade at the edit end

Final MP4 export is intentionally separate and should only run when requested.

## Quick Start

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open:

- Editor: http://127.0.0.1:3001
- Template workspace: http://127.0.0.1:3001/templates
- Music workspace: http://127.0.0.1:3001/music

## Codex Install And Verification Checklist

Use this section when a new Codex session is handed only the GitHub URL.

### 1. Clone And Install

```bash
git clone https://github.com/kwen1510/agentic-video-editor.git
cd agentic-video-editor
npm install
```

### 2. Install Bundled Skills

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
ln -sfn "$PWD/skills/codex-video-editor" "${CODEX_HOME:-$HOME/.codex}/skills/codex-video-editor"
ln -sfn "$PWD/skills/youtube-audio-library-import" "${CODEX_HOME:-$HOME/.codex}/skills/youtube-audio-library-import"
```

Then restart or refresh the Codex session if skills are not detected automatically.

### 3. Verify The App Builds

```bash
npm run typecheck
npm run lint
npm run build
```

All three commands should pass before any handoff.

### 4. Launch The Local Preview Editor

Use port `3001` unless it is already taken.

```bash
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open:

- `http://127.0.0.1:3001/`
- `http://127.0.0.1:3001/templates`
- `http://127.0.0.1:3001/music`

### 5. Smoke-Test Expected Behavior

In the editor:

- The page loads without console errors.
- The composite timeline is visible.
- Source video, caption, opening, transition, ending, and music controls are separate channels.
- Clicking a caption opens a modal, not a new panel under the timeline.
- Clicking **Start**, **Add transition**, or **Add ending** opens a modal.
- Clip blocks drag left/right on their own source rows.
- Split clips appear as separate draggable source rows and are compacted flush with the rest of the edit.
- Caption blocks stay on the caption row.
- Music stays on the audio channel.
- Music blocks can be extended/truncated from the timeline and keep an ending fade.
- Source audio can be muted separately from music.
- Music can be previewed from the music panel/workspace.
- **Render with Codex** creates a render handoff prompt instead of automatically rendering an MP4.

In the template workspace:

- Opening, subtitle, transition, interview, and ending/CTA examples are visible.
- Template examples are previewable as Remotion-style animations or starter looks.

In the music workspace:

- Music direction briefs are visible.
- The page explains license and attribution requirements.
- Local music imports are treated as user-provided and remain ignored by git.

### 6. Optional Local Transcription Check

Transcription needs Python dependencies and local hardware support. Install only when the user wants local Whisper transcription:

```bash
pip install -r scripts/requirements.txt
python scripts/transcribe.py --help
```

For real transcription, place a local video in `public/uploads/` and run:

```bash
python scripts/transcribe.py --input public/uploads/input.mp4 --model small --output transcripts/input.transcript.json
```

The script should prefer CUDA/GPU when available and fall back to CPU. Missing CUDA is not an app install failure; it just means transcription uses CPU.

### 7. Public Repo Safety Check

Before committing or pushing, run:

```bash
git status --short
git ls-files | rg '\.(mp4|mov|m4v|webm|mp3|wav|m4a)$|public/music/imports|public/uploads|public/videos|Videos/' || true
```

Expected result: no tracked private media files. Do not push user videos, transcripts, local music imports, render packets, or output MP4s.

## Install The Codex Skill

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
ln -sfn "$PWD/skills/codex-video-editor" "${CODEX_HOME:-$HOME/.codex}/skills/codex-video-editor"
ln -sfn "$PWD/skills/youtube-audio-library-import" "${CODEX_HOME:-$HOME/.codex}/skills/youtube-audio-library-import"
```

`youtube-audio-library-import` is for official YouTube Audio Library sourcing. It can use browser automation to search and preview tracks in YouTube Studio, but imports are manual: download the MP3 from YouTube Studio, then add the local file with title, artist, license, source URL, and attribution metadata. Do not rip music from ordinary YouTube videos.

## Local Media

User media is intentionally ignored by git. Put local files here:

```text
public/uploads/
public/music/
public/sfx/
```

For private/local music testing, create `public/music/music-manifest.local.json`.
It is ignored by git and takes precedence over the tracked public manifest.
Use `public/music/music-manifest.json` only for assets you intentionally want in the public package.

## Codex Render Handoff

The editor has a **Render with Codex** button in the composite timeline. It does not silently render an MP4. It writes a local render packet under `projects/`:

- `*.render-project.json`
- `*.render-edl.json`
- `*.render-prompt.md`

Copy the generated prompt into Codex. Codex should use the saved project/EDL as the source of truth, verify local files exist, then render the final MP4 explicitly. The `projects/` folder is ignored by git so private timelines and media paths do not enter the public repository.

The browser editor also autosaves the current project, transcript, and grouped thoughts to local storage. This is a safety net for interactive tweaking; file export/render packets are still the durable handoff format.

## Live Codex Workspace Sync

While the editor is open, it also writes the active timeline to:

```text
projects/{projectId}.json
```

That file is ignored by git. Codex can safely edit it during a paired session, and the browser will poll for changes and refresh the preview state. This is the intended lightweight workflow:

1. Codex creates or updates `projects/{projectId}.json`.
2. The user previews the edit and makes only small timing, caption, volume, music, split, and mute changes.
3. The editor autosaves those changes back to the same workspace JSON.
4. Codex reads the updated JSON or the **Render with Codex** packet when the user is ready to export.

Avoid exposing extra knobs to basic users. Major creative changes should be made by Codex through timeline JSON, then previewed in the app.

## YouTube Audio Library

Use the official YouTube Audio Library at `https://www.youtube.com/audiolibrary` for YouTube-safe music discovery. YouTube's help page says tracks can be previewed in the Audio Library and downloaded as MP3s from YouTube Studio; Creative Commons tracks require attribution, while standard Audio Library tracks can be filtered by attribution-not-required.

For this public tool, treat YouTube Audio Library tracks as local/manual imports:

- preview/search in YouTube Studio
- download from the official Audio Library UI
- copy attribution text when required
- import the downloaded MP3 into the ignored local music library with the Music panel file picker
- keep the metadata in `public/music/music-manifest.local.json` and timeline JSON

Source: https://support.google.com/youtube/answer/3376882

## Playable Local Examples

The public repository does not bundle MP3s. Local demo manifests may include downloaded MP3 samples for previewing what a music direction feels like. These are real web-downloaded tracks, not generated placeholder tones, and they must be attributed when used in a published/exported video.

MoonPurr samples may be present in `public/music/imports/`. MoonPurr states that its tracks are usable in videos, streams, podcasts, games, and apps with attribution under Creative Commons Attribution 4.0. Use this attribution format in descriptions or ending credits:

- Music: `"Jellybeans Dancing"` by MoonPurr, licensed under Creative Commons Attribution 4.0. Source: https://www.moonpurr.com/
- Music: `"Paper Airplane Parade"` by MoonPurr, licensed under Creative Commons Attribution 4.0. Source: https://www.moonpurr.com/
- Music: `"Morning Pancakes"` by MoonPurr, licensed under Creative Commons Attribution 4.0. Source: https://www.moonpurr.com/
- Music: `"Bubble Train"` by MoonPurr, licensed under Creative Commons Attribution 4.0. Source: https://www.moonpurr.com/
- Music: `"System Override"` by MoonPurr, licensed under Creative Commons Attribution 4.0. Source: https://www.moonpurr.com/

MoonPurr source: https://www.moonpurr.com/ License: https://creativecommons.org/licenses/by/4.0/

## Transcription

Install Python requirements:

```bash
pip install -r scripts/requirements.txt
```

Run local transcription:

```bash
python scripts/transcribe.py --input public/uploads/input.mp4 --model small --output transcripts/input.transcript.json
```

The transcription provider architecture is prepared for future cloud providers, but the active provider is local faster-whisper.

## Repository Safety

Do not commit:

- source videos
- uploaded media
- generated MP4s
- transcripts
- diagnostics
- local project JSON

The `.gitignore` is configured to keep those out of the public repository.
