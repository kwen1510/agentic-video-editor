import {NextResponse} from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import {projectsDir, sanitizeFileName} from '@/lib/files/localPaths';
import type {TimelineProject} from '@/types/timeline';

export const runtime = 'nodejs';

const projectPath = (projectId: string) => path.join(projectsDir, `${sanitizeFileName(projectId)}.json`);

export async function GET(_request: Request, {params}: {params: Promise<{projectId: string}>}) {
  const {projectId} = await params;
  try {
    const body = await fs.readFile(projectPath(projectId), 'utf-8');
    return NextResponse.json(JSON.parse(body));
  } catch {
    return NextResponse.json({error: 'Project not found'}, {status: 404});
  }
}

export async function PUT(request: Request, {params}: {params: Promise<{projectId: string}>}) {
  const {projectId} = await params;
  const project = (await request.json()) as TimelineProject;
  await fs.mkdir(projectsDir, {recursive: true});
  await fs.writeFile(projectPath(projectId), JSON.stringify(project, null, 2));
  return NextResponse.json({ok: true, path: projectPath(projectId)});
}
