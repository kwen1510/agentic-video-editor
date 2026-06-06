import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {localMusicManifestPath, musicImportsDir, sanitizeFileName} from '@/lib/files/localPaths';
import type {MusicManifestItem} from '@/types/timeline';

export const runtime = 'nodejs';

const maxBytes = 75 * 1024 * 1024;
const audioExtensions = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']);

type ImportBody = {
  name?: string;
  artist?: string;
  downloadUrl?: string;
  sourceUrl?: string;
  mood?: string;
  bpm?: number;
  style?: string;
  vocal?: MusicManifestItem['vocal'];
  energy?: MusicManifestItem['energy'];
  licenseType?: string;
  licenseUrl?: string;
  attributionRequired?: boolean;
  attribution?: string;
  licenseConfirmed?: boolean;
  tags?: string[];
};

const extensionFromContentType = (contentType: string) => {
  if (contentType.includes('mpeg')) {
    return '.mp3';
  }
  if (contentType.includes('wav')) {
    return '.wav';
  }
  if (contentType.includes('ogg')) {
    return '.ogg';
  }
  if (contentType.includes('flac')) {
    return '.flac';
  }
  if (contentType.includes('aac')) {
    return '.aac';
  }
  if (contentType.includes('mp4') || contentType.includes('m4a')) {
    return '.m4a';
  }
  return '';
};

const loadManifest = async () => {
  try {
    const raw = await fs.readFile(localMusicManifestPath, 'utf8');
    const parsed = JSON.parse(raw) as MusicManifestItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeManifest = async (manifest: MusicManifestItem[]) => {
  await fs.mkdir(path.dirname(localMusicManifestPath), {recursive: true});
  await fs.writeFile(localMusicManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
};

export async function POST(request: Request) {
  const body = (await request.json()) as ImportBody;

  if (!body.licenseConfirmed) {
    return NextResponse.json({error: 'Confirm the track license before importing.'}, {status: 400});
  }
  if (!body.name?.trim()) {
    return NextResponse.json({error: 'Track name is required.'}, {status: 400});
  }
  if (!body.downloadUrl?.trim()) {
    return NextResponse.json({error: 'A direct audio download URL is required.'}, {status: 400});
  }
  if (!body.licenseType?.trim()) {
    return NextResponse.json({error: 'License type is required.'}, {status: 400});
  }
  if (body.attributionRequired && !body.attribution?.trim()) {
    return NextResponse.json({error: 'Attribution text is required for this license.'}, {status: 400});
  }

  let url: URL;
  try {
    url = new URL(body.downloadUrl);
  } catch {
    return NextResponse.json({error: 'Download URL is invalid.'}, {status: 400});
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return NextResponse.json({error: 'Only http/https audio URLs are supported.'}, {status: 400});
  }

  const response = await fetch(url, {redirect: 'follow'});
  if (!response.ok) {
    return NextResponse.json({error: `Could not download audio: ${response.status}`}, {status: 400});
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > maxBytes) {
    return NextResponse.json({error: 'Audio file is larger than 75 MB.'}, {status: 400});
  }

  const urlExtension = path.extname(url.pathname).toLowerCase();
  const extension = audioExtensions.has(urlExtension) ? urlExtension : extensionFromContentType(contentType);
  if (!extension || (!contentType.startsWith('audio/') && !audioExtensions.has(urlExtension) && contentType !== 'application/octet-stream')) {
    return NextResponse.json({error: 'The URL must point directly to an audio file.'}, {status: 400});
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) {
    return NextResponse.json({error: 'Audio file is larger than 75 MB.'}, {status: 400});
  }

  await fs.mkdir(musicImportsDir, {recursive: true});
  const baseName = sanitizeFileName(`${body.artist ? `${body.artist}-` : ''}${body.name}`);
  const fileName = `${Date.now()}-${baseName}${extension}`;
  const diskPath = path.join(musicImportsDir, fileName);
  await fs.writeFile(diskPath, bytes);

  const item: MusicManifestItem = {
    id: `music_${randomUUID().slice(0, 8)}`,
    name: body.name.trim(),
    artist: body.artist?.trim() || undefined,
    src: `/music/imports/${fileName}`,
    sourceUrl: body.sourceUrl?.trim() || body.downloadUrl.trim(),
    mood: body.mood?.trim() || body.style?.trim() || 'creator',
    bpm: Number.isFinite(body.bpm) ? Number(body.bpm) : 0,
    licence: body.licenseType.trim(),
    licenseType: body.licenseType.trim(),
    licenseUrl: body.licenseUrl?.trim() || undefined,
    licenseStatus: 'confirmed',
    attributionRequired: Boolean(body.attributionRequired),
    attribution: body.attribution?.trim() ?? '',
    style: body.style?.trim() || undefined,
    vocal: body.vocal ?? 'either',
    energy: body.energy ?? 'medium',
    tags: body.tags?.filter(Boolean).map((tag) => tag.trim()).filter(Boolean) ?? [],
  };

  const manifest = await loadManifest();
  manifest.unshift(item);
  await writeManifest(manifest);

  return NextResponse.json({track: item, manifest});
}
