# Skills

Install the bundled skills into Codex by symlinking them into your Codex skills directory:

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
ln -sfn "$PWD/skills/codex-video-editor" "${CODEX_HOME:-$HOME/.codex}/skills/codex-video-editor"
ln -sfn "$PWD/skills/youtube-audio-library-import" "${CODEX_HOME:-$HOME/.codex}/skills/youtube-audio-library-import"
```

- `codex-video-editor` defines the Codex-first video editing workflow. The local Next.js app is the preview/manual tweak surface and can produce a Codex render packet from the exact timeline state.
- `youtube-audio-library-import` guides official YouTube Audio Library sourcing, browser-assisted preview/search, attribution capture, and local MP3 import without ripping ordinary YouTube videos.
