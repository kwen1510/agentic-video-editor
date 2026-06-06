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

type ParsedImportRequest = {
  body: ImportBody;
  file: File | null;
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

const booleanFromField = (value: FormDataEntryValue | null) => value === 'true' || value === 'on' || value === '1';

const stringFromField = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : undefined);

const parseImportRequest = async (request: Request): Promise<ParsedImportRequest> => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return {
      body: (await request.json()) as ImportBody,
      file: null,
    };
  }

  const form = await request.formData();
  const fileField = form.get('file');
  return {
    body: {
      name: stringFromField(form.get('name')),
      artist: stringFromField(form.get('artist')),
      downloadUrl: stringFromField(form.get('downloadUrl')),
      sourceUrl: stringFromField(form.get('sourceUrl')),
      mood: stringFromField(form.get('mood')),
      bpm: Number(stringFromField(form.get('bpm')) ?? 0),
      style: stringFromField(form.get('style')),
      vocal: stringFromField(form.get('vocal')) as MusicManifestItem['vocal'],
      energy: stringFromField(form.get('energy')) as MusicManifestItem['energy'],
      licenseType: stringFromField(form.get('licenseType')),
      licenseUrl: stringFromField(form.get('licenseUrl')),
      attributionRequired: booleanFromField(form.get('attributionRequired')),
      attribution: stringFromField(form.get('attribution')),
      licenseConfirmed: booleanFromField(form.get('licenseConfirmed')),
      tags: stringFromField(form.get('tags'))
        ?.split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    },
    file: typeof File !== 'undefined' && fileField instanceof File ? fileField : null,
  };
};

const importedFileName = (body: ImportBody, extension: string) => {
  const baseName = sanitizeFileName(`${body.artist ? `${body.artist}-` : ''}${body.name}`);
  return `${Date.now()}-${baseName}${extension}`;
};

export async function POST(request: Request) {
  const {body, file} = await parseImportRequest(request);

  if (!body.licenseConfirmed) {
    return NextResponse.json({error: 'Confirm the track license before importing.'}, {status: 400});
  }
  if (!body.name?.trim()) {
    return NextResponse.json({error: 'Track name is required.'}, {status: 400});
  }
  if (!file && !body.downloadUrl?.trim()) {
    return NextResponse.json({error: 'Choose a local audio file or provide a direct audio download URL.'}, {status: 400});
  }
  if (!body.licenseType?.trim()) {
    return NextResponse.json({error: 'License type is required.'}, {status: 400});
  }
  if (body.attributionRequired && !body.attribution?.trim()) {
    return NextResponse.json({error: 'Attribution text is required for this license.'}, {status: 400});
  }

  let bytes: Buffer;
  let extension = '';

  if (file) {
    if (file.size > maxBytes) {
      return NextResponse.json({error: 'Audio file is larger than 75 MB.'}, {status: 400});
    }
    const fileExtension = path.extname(file.name).toLowerCase();
    const fileType = file.type.toLowerCase();
    extension = audioExtensions.has(fileExtension) ? fileExtension : extensionFromContentType(fileType);
    if (!extension || (!fileType.startsWith('audio/') && !audioExtensions.has(fileExtension))) {
      return NextResponse.json({error: 'Choose an audio file such as MP3, WAV, M4A, OGG, AAC, or FLAC.'}, {status: 400});
    }
    bytes = Buffer.from(await file.arrayBuffer());
  } else {
    let url: URL;
    try {
      url = new URL(body.downloadUrl ?? '');
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

    const responseContentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > maxBytes) {
      return NextResponse.json({error: 'Audio file is larger than 75 MB.'}, {status: 400});
    }

    const urlExtension = path.extname(url.pathname).toLowerCase();
    extension = audioExtensions.has(urlExtension) ? urlExtension : extensionFromContentType(responseContentType);
    if (
      !extension ||
      (!responseContentType.startsWith('audio/') && !audioExtensions.has(urlExtension) && responseContentType !== 'application/octet-stream')
    ) {
      return NextResponse.json({error: 'The URL must point directly to an audio file.'}, {status: 400});
    }

    bytes = Buffer.from(await response.arrayBuffer());
  }

  if (bytes.length > maxBytes) {
    return NextResponse.json({error: 'Audio file is larger than 75 MB.'}, {status: 400});
  }

  await fs.mkdir(musicImportsDir, {recursive: true});
  const fileName = importedFileName(body, extension);
  const diskPath = path.join(musicImportsDir, fileName);
  await fs.writeFile(diskPath, bytes);

  const item: MusicManifestItem = {
    id: `music_${randomUUID().slice(0, 8)}`,
    name: body.name.trim(),
    artist: body.artist?.trim() || undefined,
    src: `/music/imports/${fileName}`,
    sourceUrl: body.sourceUrl?.trim() || body.downloadUrl?.trim() || undefined,
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
