import {NextResponse} from 'next/server';
import path from 'node:path';
import {publicPathToDisk, transcriptsDir} from '@/lib/files/localPaths';
import {getTranscriptionProvider} from '@/lib/transcription/registry';
import type {TranscriptionModel, TranscriptionRegistryConfig} from '@/lib/transcription/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    src?: string;
    model?: TranscriptionModel;
    projectId?: string;
    provider?: string;
  };

  if (!body.src) {
    return NextResponse.json({error: 'Missing source video path'}, {status: 400});
  }

  try {
    const inputPath = publicPathToDisk(body.src);
    const outputName = `${body.projectId ?? path.parse(inputPath).name}.transcript.json`;
    const outputPath = path.join(transcriptsDir, outputName);
    const provider = getTranscriptionProvider(body.provider as TranscriptionRegistryConfig['provider'] | undefined);
    const transcript = await provider.transcribe(inputPath, {model: body.model ?? 'small', outputPath});
    return NextResponse.json({transcript, outputPath});
  } catch (error) {
    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'Transcription failed'},
      {status: 500},
    );
  }
}
