# Agentic Video Editor

A Codex-first video editing workflow with a lightweight local preview editor.

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
- add music from a local manifest
- draw speech-aware music volume automation graphs
- inspect transcript-driven clip choices
- save/load editable timeline JSON

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

## YouTube Audio Library

Use the official YouTube Audio Library at `https://www.youtube.com/audiolibrary` for YouTube-safe music discovery. YouTube's help page says tracks can be previewed in the Audio Library and downloaded as MP3s from YouTube Studio; Creative Commons tracks require attribution, while standard Audio Library tracks can be filtered by attribution-not-required.

For this public tool, treat YouTube Audio Library tracks as local/manual imports:

- preview/search in YouTube Studio
- download from the official Audio Library UI
- copy attribution text when required
- import the downloaded MP3 into the ignored local music library
- keep the metadata in `public/music/music-manifest.local.json` and timeline JSON

Source: https://support.google.com/youtube/answer/3376882

## Sample Music Attribution

The local demo music manifest may include downloaded MP3 samples from Incompetech. These are real web-downloaded tracks, not generated placeholder tones. They require attribution when used in a published/exported video.

Use the original track page as the source of truth before shipping a video. Keep the attribution text in timeline JSON and include it in the video description or ending credits.

Current local sample tracks:

- `"Carefree" Kevin MacLeod (incompetech.com), licensed under Creative Commons Attribution 4.0. Source: https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1400037 License: https://creativecommons.org/licenses/by/4.0/
- `"Clear Air" Kevin MacLeod (incompetech.com), licensed under Creative Commons Attribution 4.0. Source: https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100626 License: https://creativecommons.org/licenses/by/4.0/
- `"Werq" Kevin MacLeod (incompetech.com), licensed under Creative Commons Attribution 4.0. Source: https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1800005 License: https://creativecommons.org/licenses/by/4.0/
- `"Reunited" Kevin MacLeod (incompetech.com), licensed under Creative Commons Attribution 4.0. Source: https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1200068 License: https://creativecommons.org/licenses/by/4.0/
- `"Hot Pursuit" Kevin MacLeod (incompetech.com), licensed under Creative Commons Attribution 4.0. Source: https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1700084 License: https://creativecommons.org/licenses/by/4.0/
- `"Hep Cats" Kevin MacLeod (incompetech.com), licensed under Creative Commons Attribution 4.0. Source: https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1500022 License: https://creativecommons.org/licenses/by/4.0/

Additional local MoonPurr samples may be present in `public/music/imports/`. MoonPurr states that its tracks are usable in videos, streams, podcasts, games, and apps with attribution under Creative Commons Attribution 4.0. Use this attribution format in descriptions or ending credits:

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
