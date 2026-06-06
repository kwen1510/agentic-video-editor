import {NextResponse} from 'next/server';
import {buildClipCandidates} from '@/lib/clips/speechSafe';
import {publicPathToDisk} from '@/lib/files/localPaths';
import type {TranscriptThought} from '@/types/timeline';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    src?: string;
    thoughts?: TranscriptThought[];
    duration?: number;
  };

  if (!body.src || !body.thoughts || typeof body.duration !== 'number') {
    return NextResponse.json({error: 'Missing src, thoughts, or duration'}, {status: 400});
  }

  try {
    const inputPath = publicPathToDisk(body.src);
    const candidates = await buildClipCandidates(inputPath, body.thoughts, body.duration);
    return NextResponse.json({candidates});
  } catch (error) {
    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'Clip generation failed'},
      {status: 500},
    );
  }
}
