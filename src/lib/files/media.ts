import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {publicDir, uploadsDir} from './localPaths';

const videoExtensions = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv']);

export type LocalVideoAsset = {
  name: string;
  src: string;
  kind: 'upload' | 'sample';
  duration: number;
};

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

const listFolderVideos = async (folder: string, publicPrefix: string, kind: LocalVideoAsset['kind']) => {
  try {
    const items = await fs.readdir(folder, {withFileTypes: true});
    const videos = items
      .filter((item) => item.isFile() && videoExtensions.has(path.extname(item.name).toLowerCase()))
      .map((item) => ({
        name: item.name,
        src: `${publicPrefix}/${item.name}`,
        kind,
      }));
    return Promise.all(
      videos.map(async (video) => ({
        ...video,
        duration: await ffprobeDuration(path.join(folder, video.name)),
      })),
    );
  } catch {
    return [];
  }
};

export const listLocalVideos = async () => {
  const uploads = await listFolderVideos(uploadsDir, '/uploads', 'upload');
  const samples = await listFolderVideos(path.join(publicDir, 'videos'), '/videos', 'sample');
  return [...uploads, ...samples].sort((a, b) => a.name.localeCompare(b.name));
};
