import {NextResponse} from 'next/server';
import {groupTranscriptSegments} from '@/lib/transcript/grouping';
import type {TranscriptSegment} from '@/types/timeline';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    segments?: TranscriptSegment[];
    gapThreshold?: number;
    minimumDuration?: number;
  };

  if (!body.segments) {
    return NextResponse.json({error: 'Missing transcript segments'}, {status: 400});
  }

  return NextResponse.json({
    thoughts: groupTranscriptSegments(body.segments, {
      gapThreshold: body.gapThreshold,
      minimumDuration: body.minimumDuration,
    }),
  });
}
