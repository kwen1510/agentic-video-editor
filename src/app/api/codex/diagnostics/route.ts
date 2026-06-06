import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {
  codexDir,
  publicDiagnosticsDir,
  publicPathToDisk,
  sanitizeFileName,
  scriptsDir,
} from '@/lib/files/localPaths';
import type {TranscriptResult, TranscriptThought} from '@/types/timeline';

export const runtime = 'nodejs';

const runPython = (args: string[]) =>
  new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
    const child = spawn('python', args, {stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({stdout, stderr});
      } else {
        reject(new Error(stderr || stdout || `python exited with ${code}`));
      }
    });
  });

export async function POST(request: Request) {
  const body = (await request.json()) as {
    src?: string;
    projectId?: string;
    start?: number;
    end?: number;
    nFrames?: number;
    transcript?: TranscriptResult | null;
    thoughts?: TranscriptThought[];
  };

  if (!body.src || !body.projectId || typeof body.start !== 'number' || typeof body.end !== 'number') {
    return NextResponse.json({error: 'Missing src, projectId, start, or end'}, {status: 400});
  }

  const start = Math.max(0, body.start);
  const end = Math.max(start + 0.25, body.end);
  const safeProjectId = sanitizeFileName(body.projectId);

  try {
    const inputPath = publicPathToDisk(body.src);
    const projectCodexDir = path.join(codexDir, safeProjectId);
    const projectDiagnosticsDir = path.join(publicDiagnosticsDir, safeProjectId);
    await fs.mkdir(projectCodexDir, {recursive: true});
    await fs.mkdir(projectDiagnosticsDir, {recursive: true});

    const transcriptPath = path.join(projectCodexDir, 'diagnostic-transcript.snapshot.json');
    await fs.writeFile(
      transcriptPath,
      JSON.stringify({segments: body.transcript?.segments ?? [], thoughts: body.thoughts ?? []}, null, 2),
      'utf8',
    );

    const startSlug = start.toFixed(2).replace('.', '_');
    const endSlug = end.toFixed(2).replace('.', '_');
    const filename = `timeline-${startSlug}-${endSlug}.png`;
    const outputPath = path.join(projectDiagnosticsDir, filename);
    await runPython([
      path.join(scriptsDir, 'timeline_view.py'),
      inputPath,
      start.toFixed(3),
      end.toFixed(3),
      '--output',
      outputPath,
      '--transcript',
      transcriptPath,
      '--n-frames',
      String(body.nFrames ?? 10),
    ]);

    return NextResponse.json({
      imageSrc: `/diagnostics/${safeProjectId}/${filename}`,
      path: outputPath,
    });
  } catch (error) {
    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'Failed to create diagnostic view'},
      {status: 500},
    );
  }
}
