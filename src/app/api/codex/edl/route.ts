import fs from 'node:fs/promises';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {buildCodexEdl} from '@/lib/codex/edl';
import {projectsDir, sanitizeFileName} from '@/lib/files/localPaths';
import type {TimelineProject} from '@/types/timeline';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as {project?: TimelineProject};

  if (!body.project) {
    return NextResponse.json({error: 'Missing project'}, {status: 400});
  }

  try {
    await fs.mkdir(projectsDir, {recursive: true});
    const edl = buildCodexEdl(body.project);
    const outputPath = path.join(projectsDir, `${sanitizeFileName(body.project.projectId)}.edl.json`);
    await fs.writeFile(outputPath, JSON.stringify(edl, null, 2), 'utf8');
    return NextResponse.json({edl, path: outputPath});
  } catch (error) {
    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'Failed to export EDL'},
      {status: 500},
    );
  }
}
