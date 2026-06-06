import {runFfmpeg} from './ffmpeg';

const parseVolume = (logs: string, key: 'mean_volume' | 'max_volume') => {
  const match = logs.match(new RegExp(`${key}:\\s*(-?[0-9.]+) dB`));
  return match ? Number(match[1]) : null;
};

export const measureWindowEnergy = async (inputPath: string, start: number, duration = 0.3) => {
  try {
    const {stderr} = await runFfmpeg([
      '-hide_banner',
      '-ss',
      Math.max(0, start).toFixed(3),
      '-t',
      duration.toFixed(3),
      '-i',
      inputPath,
      '-af',
      'volumedetect',
      '-vn',
      '-sn',
      '-dn',
      '-f',
      'null',
      '-',
    ]);
    return {
      meanVolumeDb: parseVolume(stderr, 'mean_volume'),
      maxVolumeDb: parseVolume(stderr, 'max_volume'),
    };
  } catch {
    return {meanVolumeDb: null, maxVolumeDb: null};
  }
};
