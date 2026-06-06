import fs from 'node:fs/promises';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {buildPackedTranscriptMarkdown} from '@/lib/codex/packTranscript';
import {codexDir, sanitizeFileName} from '@/lib/files/localPaths';
import type {TranscriptResult, TranscriptThought} from '@/types/timeline';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    projectId?: string;
    sourceName?: string;
    transcript?: TranscriptResult;
    thoughts?: TranscriptThought[];
  };

  if (!body.projectId || !body.transcript) {
    return NextResponse.json({error: 'Missing projectId or transcript'}, {status: 400});
  }

  try {
    const projectDir = path.join(codexDir, sanitizeFileName(body.projectId));
    await fs.mkdir(projectDir, {recursive: true});
    const markdown = buildPackedTranscriptMarkdown({
      projectId: body.projectId,
      sourceName: body.sourceName,
      transcript: body.transcript,
      thoughts: body.thoughts ?? [],
    });
    const outputPath = path.join(projectDir, 'takes_packed.md');
    await fs.writeFile(outputPath, markdown, 'utf8');
    return NextResponse.json({markdown, path: outputPath});
  } catch (error) {
    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'Failed to pack transcript'},
      {status: 500},
    );
  }
}
