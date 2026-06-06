import {runFfmpeg} from './ffmpeg';

export type SilenceWindow = {
  start: number;
  end: number;
};

export const parseSilenceLogs = (logs: string): SilenceWindow[] => {
  const windows: SilenceWindow[] = [];
  let activeStart: number | null = null;
  for (const line of logs.split('\n')) {
    const start = line.match(/silence_start:\s*([0-9.]+)/);
    if (start) {
      activeStart = Number(start[1]);
      continue;
    }
    const end = line.match(/silence_end:\s*([0-9.]+)/);
    if (end && activeStart !== null) {
      windows.push({start: activeStart, end: Number(end[1])});
      activeStart = null;
    }
  }
  return windows;
};

export const detectSilences = async (inputPath: string) => {
  const {stderr} = await runFfmpeg([
    '-hide_banner',
    '-i',
    inputPath,
    '-af',
    'silencedetect=n=-35dB:d=0.2',
    '-f',
    'null',
    '-',
  ]);
  return parseSilenceLogs(stderr);
};

export const nearestSilenceStartBefore = (silences: SilenceWindow[], boundary: number, tolerance = 1) => {
  const candidates = silences
    .flatMap((silence) => [silence.start, silence.end])
    .filter((point) => point <= boundary && boundary - point <= tolerance);
  return candidates.length ? Math.max(...candidates) : null;
};

export const nearestSilenceEndAfter = (silences: SilenceWindow[], boundary: number, tolerance = 1) => {
  const candidates = silences
    .flatMap((silence) => [silence.start, silence.end])
    .filter((point) => point >= boundary && point - boundary <= tolerance);
  return candidates.length ? Math.min(...candidates) : null;
};
