import fs from 'node:fs/promises';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {listLocalVideos} from '@/lib/files/media';
import {workspaceRoot} from '@/lib/files/localPaths';
import type {Clip, SourceVideo, TimelineLayer, TimelineProject, TranscriptResult, TranscriptThought} from '@/types/timeline';

export const runtime = 'nodejs';

type FixedTranscriptFile = {
  language: string;
  model: string;
  transcripts: Array<{
    source: string;
    segments: Array<{start: number; end: number; text: string}>;
  }>;
};

const sourceMap: Record<string, {src: string; id: string; name: string}> = {
  'Videos/WhatsApp Video 2026-05-10 at 15.44.18.mp4': {
    src: '/videos/green-house-reflection.mp4',
    id: 'green-house',
    name: 'Green house reflection',
  },
  'Videos/WhatsApp Video 2026-05-10 at 15.44.20.mp4': {
    src: '/videos/red-house-reflection.mp4',
    id: 'red-house',
    name: 'Red house reflection',
  },
  'Videos/VID_20260517_233948_450.mp4': {
    src: '/videos/ria-reflection.mp4',
    id: 'ria',
    name: 'Ria reflection',
  },
  'Videos/VID_20260517_234013_713.mp4': {
    src: '/videos/nigel-reflection.mp4',
    id: 'nigel',
    name: 'Nigel reflection',
  },
};

const selectedCuts = [
  {
    id: 'clip_green_batchmates',
    source: 'Videos/WhatsApp Video 2026-05-10 at 15.44.18.mp4',
    start: 0,
    end: 6,
    caption: 'I really enjoyed how we managed to carve out time with my batchmates and housemates.',
    captions: [
      {start: 0, end: 2.2, text: 'I really enjoyed'},
      {start: 2.2, end: 4.4, text: 'spending time with my batchmates'},
      {start: 4.4, end: 6, text: 'and my housemates.'},
    ],
  },
  {
    id: 'clip_red_spirit',
    source: 'Videos/WhatsApp Video 2026-05-10 at 15.44.20.mp4',
    start: 0,
    end: 6,
    caption: 'I enjoyed the volleyball match and the house procession, seeing all the houses show spirit.',
    captions: [
      {start: 0, end: 2.1, text: 'I enjoyed the volleyball match'},
      {start: 2.1, end: 4.3, text: 'and the house procession,'},
      {start: 4.3, end: 6, text: 'seeing the houses show spirit.'},
    ],
  },
  {
    id: 'clip_ria_together',
    source: 'Videos/VID_20260517_233948_450.mp4',
    start: 11,
    end: 18,
    caption: 'It is really cool because you can see the whole school together to watch the performances.',
    captions: [
      {start: 0, end: 2.8, text: 'You can see the whole school together'},
      {start: 2.8, end: 5.2, text: 'to watch the performances'},
      {start: 5.2, end: 7, text: 'and appreciate the talent.'},
    ],
  },
  {
    id: 'clip_nigel_journey',
    source: 'Videos/VID_20260517_234013_713.mp4',
    start: 37,
    end: 45,
    caption: 'It is good to see my OG mates and acknowledge that this is the end to our journey.',
    captions: [
      {start: 0, end: 2.8, text: 'It is good to see my OG mates'},
      {start: 2.8, end: 5.2, text: 'and acknowledge this is'},
      {start: 5.2, end: 8, text: 'the end of our journey.'},
    ],
  },
];

const captionLayer = (cutId: string, index: number, text: string, start: number, end: number): TimelineLayer => ({
  id: `caption_${cutId}_${index + 1}`,
  clipId: cutId,
  type: 'caption',
  start,
  end,
  text,
  x: 108,
  y: 1520,
  scale: 1,
  opacity: 1,
  rotation: 0,
  zIndex: 40,
  animation: 'fade-up',
});

const hasLocalDemo = async () => {
  try {
    await fs.access(path.join(workspaceRoot, 'transcripts', 'fixed', 'cleaned-transcripts.json'));
    await fs.access(path.join(workspaceRoot, 'public', 'videos', 'green-house-reflection.mp4'));
    await fs.access(path.join(workspaceRoot, 'public', 'videos', 'red-house-reflection.mp4'));
    await fs.access(path.join(workspaceRoot, 'public', 'videos', 'ria-reflection.mp4'));
    await fs.access(path.join(workspaceRoot, 'public', 'videos', 'nigel-reflection.mp4'));
    return true;
  } catch {
    return false;
  }
};

export async function GET(request: Request) {
  const checkOnly = new URL(request.url).searchParams.get('check') === '1';
  const available = await hasLocalDemo();
  if (checkOnly) {
    return NextResponse.json({available});
  }
  if (!available) {
    return NextResponse.json(
      {
        available: false,
        error: 'Local Home Run demo media/transcripts are not bundled with the public tool.',
      },
      {status: 404},
    );
  }

  const fixedPath = path.join(workspaceRoot, 'transcripts', 'fixed', 'cleaned-transcripts.json');
  const fixed = JSON.parse(await fs.readFile(fixedPath, 'utf8')) as FixedTranscriptFile;
  const localVideos = await listLocalVideos();
  const durationBySrc = new Map(localVideos.map((video) => [video.src, video.duration]));

  const sourceVideos: SourceVideo[] = Object.values(sourceMap).map((source) => ({
    id: source.id,
    name: source.name,
    src: source.src,
    duration: durationBySrc.get(source.src) ?? 0,
    volume: 1,
    muted: false,
  }));

  const openingDuration = 3;
  let cursor = openingDuration;
  const clips: Clip[] = [];
  const layers: TimelineLayer[] = [];
  const thoughts: TranscriptThought[] = [];

  for (const cut of selectedCuts) {
    const source = sourceMap[cut.source];
    const duration = cut.end - cut.start;
    const timelineStart = cursor;
    const timelineEnd = cursor + duration;
    clips.push({
      id: cut.id,
      sourceSrc: source.src,
      sourceName: source.name,
      rawStart: cut.start,
      rawEnd: cut.end,
      paddedStart: Math.max(0, cut.start - 0.25),
      paddedEnd: cut.end + 0.25,
      safeStart: cut.start,
      safeEnd: cut.end,
      timelineStart,
      boundaryMode: 'raw',
      volume: 1,
      fadeIn: 0.35,
      fadeOut: 0.35,
      thoughtId: `thought_${cut.id}`,
    });
    cut.captions.forEach((caption, index) => {
      layers.push(
        captionLayer(
          cut.id,
          index,
          caption.text,
          timelineStart + caption.start,
          Math.min(timelineEnd, timelineStart + caption.end),
        ),
      );
    });
    thoughts.push({
      id: `thought_${cut.id}`,
      rawStart: cut.start,
      rawEnd: cut.end,
      timelineStart,
      timelineEnd,
      text: cut.caption,
      segmentIds: [cut.id],
      source: source.name,
      sourceSrc: source.src,
    });
    cursor = timelineEnd;
  }

  const project: TimelineProject = {
    projectId: 'home-run-30s',
    sourceVideo: sourceVideos[0] ?? null,
    sourceVideos,
    openingScreen: {
      templateId: 'bold-explainer',
      duration: openingDuration,
      enabled: true,
      props: {
        title: 'Home Run Reflections',
        subtitle: '30-second highlights',
        mood: 'positive',
        background: 'gradient',
      },
    },
    endingScreen: {
      templateId: 'thank-you',
      duration: 3,
      enabled: false,
      props: {
        title: 'Thank you',
        subtitle: 'Home Run reflections',
        credits: 'Edited with Codex',
        mood: 'positive',
        background: 'gradient',
      },
    },
    transitions: [],
    clips,
    layers,
    music: [
      {
        id: 'music_carefree_kevin_macleod',
        src: '/music/carefree-kevin-macleod.mp3',
        name: 'Carefree',
        artist: 'Kevin MacLeod',
        sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037',
        licenseType: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        licenseStatus: 'confirmed',
        attributionRequired: true,
        attribution: '"Carefree" Kevin MacLeod (incompetech.com), licensed under Creative Commons Attribution 4.0.',
        start: 0,
        end: 30,
        volume: 0.18,
        fadeIn: 1.25,
        fadeOut: 2,
        duckUnderSpeech: true,
        volumeAutomation: {
          enabled: true,
          focusVolume: 1,
          backgroundVolume: 0.18,
          rampDuration: 0.35,
          mode: 'smooth-gaps',
          liftGapThreshold: 1.15,
          points: [
            {id: 'vol_01', time: 0, volume: 1},
            {id: 'vol_02', time: 2.65, volume: 1},
            {id: 'vol_03', time: 3, volume: 0.18},
            {id: 'vol_04', time: 30, volume: 0.18},
          ],
        },
      },
    ],
  };

  const segments = fixed.transcripts.flatMap((entry) => {
    const source = sourceMap[entry.source];
    return entry.segments.map((segment, index) => ({
      id: `${source.id}_seg_${index + 1}`,
      start: segment.start,
      end: segment.end,
      text: segment.text,
      source: source.name,
      sourceSrc: source.src,
    }));
  });

  const transcript: TranscriptResult = {
    language: fixed.language,
    duration: Math.max(...sourceVideos.map((source) => source.duration)),
    provider: 'local-faster-whisper',
    model: fixed.model,
    hardware: {
      device: 'cpu',
      computeType: 'cached-fixed',
    },
    segments,
  };

  return NextResponse.json({project, transcript, thoughts});
}
