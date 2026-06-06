import {spawn} from 'node:child_process';
import {NextResponse} from 'next/server';
import {publicPathToDisk} from '@/lib/files/localPaths';
import {getClipTimelineWindows, getOpeningDuration, getTimelineDuration} from '@/lib/timeline';
import type {TimelineProject} from '@/types/timeline';

export const runtime = 'nodejs';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const extractRms = (diskPath: string, start: number, duration: number, samples: number) =>
  new Promise<number[]>((resolve, reject) => {
    const safeSamples = Math.max(8, Math.min(400, Math.round(samples)));
    const child = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      start.toFixed(3),
      '-i',
      diskPath,
      '-t',
      Math.max(0.05, duration).toFixed(3),
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      'f32le',
      'pipe:1',
    ]);

    const chunks: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `ffmpeg exited with ${code}`));
        return;
      }

      const buffer = Buffer.concat(chunks);
      const frameCount = Math.floor(buffer.length / 4);
      if (frameCount === 0) {
        resolve(Array(safeSamples).fill(0));
        return;
      }

      const values = Array.from({length: safeSamples}, (_, index) => {
        const frameStart = Math.floor((index / safeSamples) * frameCount);
        const frameEnd = Math.max(frameStart + 1, Math.floor(((index + 1) / safeSamples) * frameCount));
        let sum = 0;
        for (let frame = frameStart; frame < frameEnd; frame += 1) {
          const value = buffer.readFloatLE(frame * 4);
          sum += value * value;
        }
        return Math.sqrt(sum / Math.max(1, frameEnd - frameStart));
      });

      const max = Math.max(0.0001, ...values);
      resolve(values.map((value) => clamp(value / max, 0, 1)));
    });
  });

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      project?: TimelineProject;
      start?: number;
      end?: number;
      samples?: number;
    };
    const project = body.project;
    if (!project) {
      return NextResponse.json({error: 'Project JSON is required.'}, {status: 400});
    }

    const sampleCount = Math.max(24, Math.min(240, Math.round(body.samples ?? 88)));
    const viewStart = clamp(body.start ?? 0, 0, getTimelineDuration(project));
    const viewEnd = clamp(body.end ?? getTimelineDuration(project), viewStart + 0.05, getTimelineDuration(project));
    const viewDuration = Math.max(0.05, viewEnd - viewStart);
    const output = Array(sampleCount).fill(0) as number[];

    const place = async (timelineStart: number, timelineEnd: number, sourceSrc: string | undefined | null, sourceStart: number) => {
      const start = Math.max(viewStart, timelineStart);
      const end = Math.min(viewEnd, timelineEnd);
      if (!sourceSrc || end <= start) {
        return;
      }

      const sampleStart = clamp(Math.floor(((start - viewStart) / viewDuration) * sampleCount), 0, sampleCount - 1);
      const sampleEnd = clamp(Math.ceil(((end - viewStart) / viewDuration) * sampleCount), sampleStart + 1, sampleCount);
      const count = Math.max(1, sampleEnd - sampleStart);
      const sourceOffset = sourceStart + (start - timelineStart);
      const diskPath = publicPathToDisk(sourceSrc);
      const values = await extractRms(diskPath, sourceOffset, end - start, count);

      for (let index = 0; index < count; index += 1) {
        output[sampleStart + index] = Math.max(output[sampleStart + index] ?? 0, values[index] ?? 0);
      }
    };

    if (project.clips.length > 0) {
      for (const {clip, start, end} of getClipTimelineWindows(project)) {
        await place(start, end, clip.sourceSrc ?? project.sourceVideo?.src, clip.safeStart);
      }
    } else if (project.sourceVideo) {
      const openingDuration = getOpeningDuration(project);
      await place(
        openingDuration,
        openingDuration + project.sourceVideo.duration,
        project.sourceVideo.src,
        0,
      );
    }

    return NextResponse.json({
      start: viewStart,
      end: viewEnd,
      samples: output,
      source: 'ffmpeg-rms',
    });
  } catch (error) {
    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'Could not create waveform.'},
      {status: 500},
    );
  }
}
