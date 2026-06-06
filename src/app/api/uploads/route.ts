import {NextResponse} from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {listLocalVideos} from '@/lib/files/media';
import {sanitizeFileName, uploadsDir} from '@/lib/files/localPaths';

export const runtime = 'nodejs';

const ffprobeDuration = (inputPath: string) =>
  new Promise<number>((resolve) => {
    const child = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ]);
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.on('close', () => {
      const value = Number(stdout.trim());
      resolve(Number.isFinite(value) ? value : 0);
    });
    child.on('error', () => resolve(0));
  });

export async function GET() {
  await fs.mkdir(uploadsDir, {recursive: true});
  const videos = await listLocalVideos();
  return NextResponse.json({videos});
}

export async function POST(request: Request) {
  await fs.mkdir(uploadsDir, {recursive: true});
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({error: 'Missing file'}, {status: 400});
  }

  const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const diskPath = path.join(uploadsDir, safeName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(diskPath, bytes);
  const duration = await ffprobeDuration(diskPath);

  return NextResponse.json({
    video: {
      name: safeName,
      src: `/uploads/${safeName}`,
      duration,
      kind: 'upload',
    },
  });
}
