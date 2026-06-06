import fs from 'node:fs/promises';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {buildCodexEdl} from '@/lib/codex/edl';
import {projectsDir, sanitizeFileName} from '@/lib/files/localPaths';
import type {TimelineProject} from '@/types/timeline';

export const runtime = 'nodejs';

const renderPrompt = (project: TimelineProject, projectPath: string, edlPath: string, edl: unknown) => `Use $codex-video-editor to render the final MP4 for this local timeline.

The browser preview/editor has already been used for manual tweaks. Do not reselect clips unless the timeline is internally invalid. Treat the timeline JSON as the source of truth.

Local render packet:
- Project JSON: ${projectPath}
- Codex EDL JSON: ${edlPath}
- Project id: ${project.projectId}

Task:
1. Read the Project JSON and Codex EDL JSON from the paths above.
2. Verify local source video and music files exist.
3. Render a final MP4 from the exact timeline: opening screen, selected clips, transitions, overlays, captions, ending screen, source audio volume/mutes, and music volume automation.
4. Burn captions/overlays only in the final render, not during preview.
5. Include required music attribution in ending credits when possible, or report the attribution text for the video description.
6. Save the final MP4 under out/${sanitizeFileName(project.projectId)}.mp4.
7. Return the output path, duration, attribution text, and any render caveats.

Important rules:
- Do not upload local media or generated output to GitHub.
- Do not commit local project JSON, transcripts, videos, MP3s, diagnostics, or rendered MP4s.
- If direct render code is missing, create the smallest reliable Remotion/FFmpeg adapter needed for this EDL and keep the timeline JSON provider-agnostic.
- If a referenced music file is unavailable, keep the render blocked and ask for the local file rather than substituting a random track.

Codex EDL:
\`\`\`json
${JSON.stringify(edl, null, 2)}
\`\`\`
`;

export async function POST(request: Request) {
  const body = (await request.json()) as {project?: TimelineProject};

  if (!body.project) {
    return NextResponse.json({error: 'Missing project'}, {status: 400});
  }

  try {
    await fs.mkdir(projectsDir, {recursive: true});
    const safeProjectId = sanitizeFileName(body.project.projectId);
    const projectPath = path.join(projectsDir, `${safeProjectId}.render-project.json`);
    const edlPath = path.join(projectsDir, `${safeProjectId}.render-edl.json`);
    const promptPath = path.join(projectsDir, `${safeProjectId}.render-prompt.md`);
    const edl = buildCodexEdl(body.project);
    const prompt = renderPrompt(body.project, projectPath, edlPath, edl);

    await fs.writeFile(projectPath, `${JSON.stringify(body.project, null, 2)}\n`, 'utf8');
    await fs.writeFile(edlPath, `${JSON.stringify(edl, null, 2)}\n`, 'utf8');
    await fs.writeFile(promptPath, prompt, 'utf8');

    return NextResponse.json({
      prompt,
      paths: {
        project: projectPath,
        edl: edlPath,
        prompt: promptPath,
      },
      edl,
    });
  } catch (error) {
    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'Failed to create Codex render brief'},
      {status: 500},
    );
  }
}
