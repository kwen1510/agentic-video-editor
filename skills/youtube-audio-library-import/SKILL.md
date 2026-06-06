---
name: youtube-audio-library-import
description: Source music from the official YouTube Audio Library for local video edits. Use when Codex needs to use browser automation to search or preview tracks in YouTube Studio, capture license and attribution metadata, and import a user-downloaded MP3 into the local editor without ripping ordinary YouTube videos.
---

# YouTube Audio Library Import

## Role

Use this skill to help a user find a soundtrack in the official YouTube Audio Library, record the license/attribution metadata, and add the officially downloaded MP3 to the local video editor.

Source of truth: YouTube Help, "Use music and sound effects from the Audio Library": https://support.google.com/youtube/answer/3376882

## Hard Rules

1. Use only the official Audio Library in YouTube Studio or `https://www.youtube.com/audiolibrary`.
2. Do not build or use a YouTube ripper, stream extractor, downloader endpoint scraper, or ordinary YouTube video downloader.
3. Treat YouTube Audio Library tracks as manual import assets: the user downloads the MP3 from YouTube Studio, then Codex imports the local file with metadata.
4. Do not handle account credentials. If sign-in is required, ask the user to take over the browser.
5. Do not claim a track is safe outside YouTube unless the displayed license supports that use. If uncertain, preserve the uncertainty in metadata.
6. Never commit downloaded MP3s, local manifests, source videos, transcripts, or rendered output to a public repository.

## Browser Automation

Codex may use the Browser skill to:

- Open YouTube Studio's Audio Library.
- Search by keyword, genre, mood, duration, artist, attribution requirement, or track title.
- Preview tracks with the official Play button.
- Read visible metadata such as title, artist, duration, license type, and attribution requirement.
- Open the Creative Commons/license dialog and copy attribution text if the UI provides it.

Codex should not use browser automation to:

- Enter passwords or 2FA codes.
- Bypass sign-in, region restrictions, or UI access controls.
- Scrape hidden media URLs.
- Download from normal YouTube watch pages.

If the user explicitly asks Codex to click the official Download button in YouTube Studio, confirm that it is the official Audio Library download action first. Otherwise, ask the user to click Download manually.

## Workflow

1. Clarify the music intent:
   - target platform
   - tone and energy
   - instrumental vs lyrics
   - whether attribution is acceptable
   - whether the final video will be posted only on YouTube or also elsewhere

2. Open the Audio Library:
   - Use `https://www.youtube.com/audiolibrary`.
   - If sign-in blocks access, stop and ask the user to sign in manually.

3. Search and preview:
   - Use YouTube's own search and filters.
   - Prefer `Attribution not required` when the user wants a low-friction background track.
   - Use `Attribution required` when Creative Commons attribution is acceptable.
   - Preview several tracks before choosing one.

4. Capture metadata before import:
   - title
   - artist
   - source URL or Audio Library page URL
   - license type
   - whether attribution is required
   - exact attribution text when required
   - download date
   - notes about YouTube-only or uncertain off-platform use

5. Download:
   - The user downloads the MP3 from the official Audio Library UI.
   - Ask the user for the downloaded file path, or inspect recent MP3 files in `~/Downloads` and ask for confirmation before using one.

6. Import into the local editor:
   - Copy the MP3 to `public/music/imports/` or another ignored local music folder.
   - Add or update `public/music/music-manifest.local.json`.
   - Keep the local manifest and MP3 ignored by git.
   - Use a stable id such as `youtube-audio-library-track-title-artist`.

Example manifest entry:

```json
{
  "id": "youtube-audio-library-track-title-artist",
  "name": "Track Title",
  "artist": "Artist Name",
  "src": "/music/imports/track-title-artist.mp3",
  "sourceUrl": "https://www.youtube.com/audiolibrary",
  "mood": "upbeat",
  "bpm": 0,
  "licence": "YouTube Audio Library",
  "licenseType": "YouTube Audio Library",
  "licenseUrl": "https://support.google.com/youtube/answer/3376882",
  "licenseStatus": "confirmed",
  "attributionRequired": false,
  "attribution": "",
  "style": "upbeat short-form",
  "vocal": "instrumental",
  "energy": "high",
  "tags": ["youtube-audio-library", "manual-import"]
}
```

For Creative Commons tracks, set `attributionRequired` to `true` and paste the exact copied attribution text into `attribution`.

## Editor Usage

After import:

- Add the track to the timeline from the Music panel.
- Use speech-aware automation rather than one flat volume when there are no-speech sections.
- Start with no-speech music around `0.8-1.0`, speech bed around `0.16-0.24`, and ramp around `0.25-0.5` seconds.
- Store attribution in timeline JSON so export can place it in ending credits or the video description.

## Repository Safety

Before committing:

```bash
git status --short
git check-ignore -v public/music/imports/*.mp3 public/music/music-manifest.local.json
```

Only commit source code, public docs, and skill files. Do not commit local YouTube Audio Library MP3s or user media.
