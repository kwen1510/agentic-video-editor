import type {Clip, TimelineProject} from '@/types/timeline';
import {getClipDuration, getClipTimelineWindows, getOpeningDuration, getTimelineDuration} from '@/lib/timeline';
import {publicPathToDisk} from '@/lib/files/localPaths';

export type CodexEdlRange = {
  source: string;
  start: number;
  end: number;
  rawStart: number;
  rawEnd: number;
  timelineStart: number;
  timelineEnd: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  boundaryMode: Clip['boundaryMode'];
  thoughtId?: string;
  reason: string;
};

export type CodexEdl = {
  version: 1;
  projectId: string;
  sources: Record<string, string>;
  ranges: CodexEdlRange[];
  openingScreen: TimelineProject['openingScreen'];
  endingScreen: TimelineProject['endingScreen'];
  transitions: NonNullable<TimelineProject['transitions']>;
  layers: TimelineProject['layers'];
  music: Array<TimelineProject['music'][number] & {diskPath: string}>;
  captions: TimelineProject['layers'];
  totalDurationSeconds: number;
  renderRules: string[];
  notes: string[];
};

const rangeFromClip = (clip: Clip, cursor: number): CodexEdlRange => {
  const duration = getClipDuration(clip);
  return {
    source: clip.sourceName ?? clip.sourceSrc ?? 'source',
    start: clip.safeStart,
    end: clip.safeEnd,
    rawStart: clip.rawStart,
    rawEnd: clip.rawEnd,
    timelineStart: cursor,
    timelineEnd: cursor + duration,
    volume: clip.volume,
    fadeIn: clip.fadeIn,
    fadeOut: clip.fadeOut,
    boundaryMode: clip.boundaryMode,
    thoughtId: clip.thoughtId,
    reason: clip.boundaryMode ? `${clip.boundaryMode} timeline clip` : 'timeline clip',
  };
};

export const buildCodexEdl = (project: TimelineProject): CodexEdl => {
  if (!project.sourceVideo) {
    throw new Error('Cannot build EDL without a source video');
  }

  const openingDuration = getOpeningDuration(project);
  const sourceVideos = project.sourceVideos?.length ? project.sourceVideos : [project.sourceVideo];
  const sourceEntries = sourceVideos.map((source, index) => {
    const key = source.name ?? source.id ?? source.src.split('/').at(-1) ?? `source_${index + 1}`;
    return [key, publicPathToDisk(source.src)] as const;
  });
  const ranges: CodexEdlRange[] = [];

  if (project.clips.length === 0) {
    ranges.push({
      source: project.sourceVideo.name ?? project.sourceVideo.src,
      start: 0,
      end: project.sourceVideo.duration,
      rawStart: 0,
      rawEnd: project.sourceVideo.duration,
      timelineStart: openingDuration,
      timelineEnd: openingDuration + project.sourceVideo.duration,
      volume: project.sourceVideo.muted ? 0 : project.sourceVideo.volume,
      fadeIn: 0.03,
      fadeOut: 0.03,
      boundaryMode: 'raw',
      reason: 'full source video',
    });
  } else {
    for (const {clip, start} of getClipTimelineWindows(project)) {
      const matchingSource = sourceVideos.find((source) => source.src === (clip.sourceSrc ?? project.sourceVideo?.src));
      const sourceVolume = matchingSource?.muted ? 0 : matchingSource?.volume ?? 1;
      const range = {
        ...rangeFromClip(clip, start),
        source: matchingSource?.name ?? clip.sourceName ?? clip.sourceSrc ?? 'source',
        volume: Math.max(0, Math.min(1, sourceVolume * clip.volume)),
      };
      ranges.push(range);
    }
  }

  return {
    version: 1,
    projectId: project.projectId,
    sources: Object.fromEntries(sourceEntries),
    ranges,
    openingScreen: project.openingScreen,
    endingScreen: project.endingScreen,
    transitions: project.transitions ?? [],
    layers: project.layers,
    music: project.music.map((track) => ({
      ...track,
      diskPath: publicPathToDisk(track.src),
    })),
    captions: project.layers.filter((layer) => layer.type === 'caption'),
    totalDurationSeconds: getTimelineDuration(project),
    renderRules: [
      'Preview remains live; do not render MP4 during editing.',
      'For final export, keep speech audio at clip volume; visual fades and transitions should use padded non-speech handles.',
      'Apply animated overlays after the base video is composed.',
      'Apply captions last so overlays cannot hide them.',
      'Run boundary diagnostics around every cut before showing the final MP4.',
    ],
    notes: [
      'This EDL is an adapter for Codex/export tooling. Timeline JSON remains the editable source of truth.',
      'Opening screen, layers, captions, and music are preserved for a later Remotion/FFmpeg export pass.',
    ],
  };
};
