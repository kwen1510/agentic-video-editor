import type {
  Clip,
  MusicTrack,
  MusicVolumeAutomation,
  MusicVolumeMode,
  MusicVolumePoint,
  TimelineProject,
  TimelineTransition,
} from '@/types/timeline';

export const formatTime = (time: number) => {
  const safe = Math.max(0, Number.isFinite(time) ? time : 0);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 1000);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis
    .toString()
    .padStart(3, '0')}`;
};

export const getOpeningDuration = (project: TimelineProject) =>
  project.openingScreen.enabled ? Math.max(0, project.openingScreen.duration) : 0;

export const getEndingDuration = (project: TimelineProject) =>
  project.endingScreen?.enabled ? Math.max(0, project.endingScreen.duration) : 0;

export const getClipDuration = (clip: Clip) => Math.max(0, clip.safeEnd - clip.safeStart);

export type ClipTimelineWindow = {
  clip: Clip;
  index: number;
  start: number;
  end: number;
};

export const getClipTimelineWindows = (project: TimelineProject, clips = project.clips): ClipTimelineWindow[] => {
  const openingDuration = getOpeningDuration(project);
  let cursor = openingDuration;

  return clips.map((clip, index) => {
    const duration = getClipDuration(clip);
    const explicitStart = typeof clip.timelineStart === 'number' && Number.isFinite(clip.timelineStart) ? clip.timelineStart : cursor;
    const start = Math.max(openingDuration, cursor, explicitStart);
    const end = start + duration;
    cursor = end;
    return {clip, index, start, end};
  });
};

export const getSourceTimelineDuration = (project: TimelineProject) => {
  if (project.clips.length > 0) {
    const openingDuration = getOpeningDuration(project);
    const lastClipEnd = Math.max(openingDuration, ...getClipTimelineWindows(project).map((window) => window.end));
    return Math.max(0, lastClipEnd - openingDuration);
  }
  return project.sourceVideo?.duration ?? 0;
};

export const getContentEnd = (project: TimelineProject) => getOpeningDuration(project) + getSourceTimelineDuration(project);

export const getVisualTimelineDuration = (project: TimelineProject) => {
  const mediaEnd = getContentEnd(project) + getEndingDuration(project);
  const layerEnd = Math.max(0, ...project.layers.map((layer) => layer.end));
  return Math.max(1, mediaEnd, layerEnd);
};

export const getTimelineDuration = (project: TimelineProject) => {
  const musicEnd = Math.max(0, ...project.music.map((track) => track.end));
  return Math.max(getVisualTimelineDuration(project), musicEnd);
};

export const getSourceForSrc = (project: TimelineProject, sourceSrc: string | null | undefined) => {
  const sources = project.sourceVideos?.length
    ? project.sourceVideos
    : project.sourceVideo
      ? [project.sourceVideo]
      : [];

  return sources.find((source) => source.src === sourceSrc) ?? project.sourceVideo;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const activeClipFadeAt = (project: TimelineProject, timelineTime: number) => {
  if (project.clips.length === 0) {
    return 1;
  }

  for (const {clip, start, end} of getClipTimelineWindows(project)) {
    const duration = getClipDuration(clip);
    if (timelineTime >= start && timelineTime < end) {
      const localTime = timelineTime - start;
      const speechStartLocal = Math.max(0, Math.min(duration, clip.rawStart - clip.safeStart));
      const speechEndLocal = Math.max(0, Math.min(duration, clip.rawEnd - clip.safeStart));
      const fadeInTail = speechStartLocal;
      const fadeOutTail = Math.max(0, duration - speechEndLocal);
      const fadeIn =
        clip.fadeIn > 0 && fadeInTail > 0 ? clamp01(localTime / Math.min(clip.fadeIn, fadeInTail)) : 1;
      const fadeOut =
        clip.fadeOut > 0 && fadeOutTail > 0
          ? clamp01((duration - localTime) / Math.min(clip.fadeOut, fadeOutTail))
          : 1;
      return Math.min(fadeIn, fadeOut);
    }
  }

  return 0;
};

export const resolveSourceTime = (project: TimelineProject, timelineTime: number) => {
  const openingDuration = getOpeningDuration(project);
  const contentEnd = getContentEnd(project);
  const sourceWindowTime = Math.max(0, timelineTime - openingDuration);

  if (timelineTime < openingDuration) {
    return {mode: 'opening' as const, sourceTime: 0, activeClip: null, sourceSrc: null};
  }

  if (timelineTime >= contentEnd && timelineTime < contentEnd + getEndingDuration(project)) {
    return {mode: 'ending' as const, sourceTime: timelineTime - contentEnd, activeClip: null, sourceSrc: null};
  }

  if (project.clips.length === 0) {
    return {mode: 'source' as const, sourceTime: sourceWindowTime, activeClip: null, sourceSrc: project.sourceVideo?.src ?? null};
  }

  for (const {clip, start, end} of getClipTimelineWindows(project)) {
    if (timelineTime >= start && timelineTime < end) {
      return {
        mode: 'clip' as const,
        sourceTime: clip.safeStart + (timelineTime - start),
        activeClip: clip,
        sourceSrc: clip.sourceSrc ?? project.sourceVideo?.src ?? null,
      };
    }
  }

  return {mode: 'gap' as const, sourceTime: 0, activeClip: null, sourceSrc: null};
};

export const activeVideoVolume = (project: TimelineProject, timelineTime: number) => {
  if (!project.sourceVideo) {
    return 0;
  }

  const resolved = resolveSourceTime(project, timelineTime);
  if (resolved.mode !== 'clip' && resolved.mode !== 'source') {
    return 0;
  }
  const source = getSourceForSrc(project, resolved.sourceSrc);
  if (!source || source.muted) {
    return 0;
  }

  const clipVolume = resolved.activeClip?.volume ?? 1;
  return Math.max(0, Math.min(1, source.volume * clipVolume));
};

export type TransitionTimelineWindow = {
  transition: TimelineTransition;
  start: number;
  end: number;
  boundaryTime: number;
  fromClip: Clip;
  toClip: Clip;
};

export const getTransitionWindows = (project: TimelineProject): TransitionTimelineWindow[] => {
  const transitions = project.transitions?.filter((transition) => transition.enabled) ?? [];
  if (transitions.length === 0 || project.clips.length < 2) {
    return [];
  }

  const clipWindows = getClipTimelineWindows(project);
  const byPair = new Map(transitions.map((transition) => [`${transition.fromClipId}->${transition.toClipId}`, transition]));
  const windows: TransitionTimelineWindow[] = [];

  for (let index = 0; index < clipWindows.length - 1; index += 1) {
    const from = clipWindows[index];
    const to = clipWindows[index + 1];
    const transition = byPair.get(`${from.clip.id}->${to.clip.id}`);
    if (!transition) {
      continue;
    }
    const duration = Math.max(0.05, transition.duration);
    const boundaryTime = from.end;
    windows.push({
      transition,
      start: boundaryTime,
      end: Math.min(getTimelineDuration(project), boundaryTime + duration),
      boundaryTime,
      fromClip: from.clip,
      toClip: to.clip,
    });
  }

  return windows;
};

export const getActiveTransitionWindow = (project: TimelineProject, timelineTime: number) =>
  getTransitionWindows(project).find((window) => timelineTime >= window.start && timelineTime < window.end) ?? null;

const pointId = (prefix: string, index: number) => `${prefix}_${index.toString().padStart(2, '0')}`;

export const sortedVolumePoints = (points: MusicVolumePoint[]) =>
  [...points]
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.volume))
    .map((point) => ({...point, time: Math.max(0, point.time), volume: clamp01(point.volume)}))
    .sort((a, b) => a.time - b.time);

export const musicAutomationLevelAt = (automation: MusicVolumeAutomation | undefined, fallbackVolume: number, localTime: number) => {
  if (!automation?.enabled || automation.points.length === 0) {
    return clamp01(fallbackVolume);
  }

  const points = sortedVolumePoints(automation.points);
  if (points.length === 0) {
    return clamp01(fallbackVolume);
  }
  if (localTime <= points[0].time) {
    return points[0].volume;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (localTime >= current.time && localTime <= next.time) {
      const span = Math.max(0.001, next.time - current.time);
      const progress = (localTime - current.time) / span;
      return clamp01(current.volume + (next.volume - current.volume) * progress);
    }
  }

  return points.at(-1)?.volume ?? clamp01(fallbackVolume);
};

type TimelineWindow = {
  start: number;
  end: number;
};

const normalizedWindows = (windows: TimelineWindow[], gapTolerance = 0): TimelineWindow[] => {
  const sorted = windows
    .map((window) => ({
      start: Math.max(0, Math.min(window.start, window.end)),
      end: Math.max(0, Math.max(window.start, window.end)),
    }))
    .filter((window) => window.end - window.start > 0.01)
    .sort((a, b) => a.start - b.start);

  const merged: TimelineWindow[] = [];
  for (const window of sorted) {
    const previous = merged.at(-1);
    if (previous && window.start - previous.end <= gapTolerance) {
      previous.end = Math.max(previous.end, window.end);
    } else {
      merged.push({...window});
    }
  }
  return merged;
};

export const getSpeechActivityWindows = (project: TimelineProject): TimelineWindow[] => {
  const captionWindows = normalizedWindows(
    project.layers
      .filter((layer) => layer.type === 'caption' && layer.text.trim() && layer.end > layer.start)
      .map((layer) => ({start: layer.start, end: layer.end})),
    0.18,
  );

  if (captionWindows.length > 0) {
    return captionWindows;
  }

  if (project.clips.length > 0) {
    return normalizedWindows(
      getClipTimelineWindows(project).map(({clip, start, end}) => {
        const clipDuration = Math.max(0.05, end - start);
        const speechStartOffset = Number.isFinite(clip.rawStart) ? Math.max(0, clip.rawStart - clip.safeStart) : 0;
        const speechEndOffset = Number.isFinite(clip.rawEnd) ? Math.min(clipDuration, clip.rawEnd - clip.safeStart) : clipDuration;
        return {
          start: start + clamp01(speechStartOffset / clipDuration) * clipDuration,
          end: start + clamp01(speechEndOffset / clipDuration) * clipDuration,
        };
      }),
      0.18,
    );
  }

  if (project.sourceVideo) {
    const openingDuration = getOpeningDuration(project);
    return [{start: openingDuration, end: openingDuration + project.sourceVideo.duration}];
  }

  return [];
};

const getTemplateBreakWindows = (project: TimelineProject): TimelineWindow[] => {
  const openingDuration = getOpeningDuration(project);
  const contentEnd = getContentEnd(project);
  const endingDuration = getEndingDuration(project);

  return normalizedWindows([
    ...(openingDuration > 0 ? [{start: 0, end: openingDuration}] : []),
    ...(endingDuration > 0 ? [{start: contentEnd, end: contentEnd + endingDuration}] : []),
    ...getTransitionWindows(project).map((window) => ({start: window.start, end: window.end})),
  ]);
};

const intersects = (a: TimelineWindow, b: TimelineWindow) => a.start < b.end && b.start < a.end;

const targetAutomationWindows = (
  project: TimelineProject,
  speechWindows: TimelineWindow[],
  mode: MusicVolumeMode,
  liftGapThreshold: number,
) => {
  const speech = normalizedWindows(speechWindows, 0.18);
  if (speech.length === 0) {
    return [];
  }

  if (mode === 'flat-speech-bed') {
    return [{start: speech[0].start, end: speech.at(-1)?.end ?? speech[0].end}];
  }

  if (mode === 'template-gaps') {
    const spokenSpan = {start: speech[0].start, end: speech.at(-1)?.end ?? speech[0].end};
    const templateBreaks = getTemplateBreakWindows(project);
    const windows: TimelineWindow[] = [];
    let cursor = spokenSpan.start;

    for (const template of templateBreaks) {
      const clipped = {
        start: Math.max(spokenSpan.start, template.start),
        end: Math.min(spokenSpan.end, template.end),
      };
      if (clipped.end <= clipped.start || !intersects(spokenSpan, clipped)) {
        continue;
      }
      if (clipped.start > cursor) {
        windows.push({start: cursor, end: clipped.start});
      }
      cursor = Math.max(cursor, clipped.end);
    }

    if (cursor < spokenSpan.end) {
      windows.push({start: cursor, end: spokenSpan.end});
    }

    return normalizedWindows(windows, 0.1);
  }

  return normalizedWindows(speech, Math.max(0.1, liftGapThreshold));
};

export const createSpeechAwareMusicAutomation = (
  project: TimelineProject,
  track: Pick<MusicTrack, 'start' | 'end' | 'volume'>,
  options?: Partial<Pick<MusicVolumeAutomation, 'focusVolume' | 'backgroundVolume' | 'rampDuration' | 'mode' | 'liftGapThreshold'>>,
): MusicVolumeAutomation => {
  const focusVolume = clamp01(options?.focusVolume ?? 1);
  const backgroundVolume = clamp01(options?.backgroundVolume ?? 0.18);
  const rampDuration = Math.max(0.05, options?.rampDuration ?? 0.35);
  const mode = options?.mode ?? 'smooth-gaps';
  const liftGapThreshold = Math.max(0.35, options?.liftGapThreshold ?? 1.15);
  const trackDuration = Math.max(0.05, track.end - track.start);
  const rawPoints: Array<Omit<MusicVolumePoint, 'id'>> = [
    {time: 0, volume: focusVolume},
    {time: trackDuration, volume: focusVolume},
  ];

  const speechWindows = targetAutomationWindows(
    project,
    getSpeechActivityWindows(project)
      .map((window) => ({
        start: Math.max(track.start, window.start),
        end: Math.min(track.end, window.end),
      }))
      .filter((window) => window.end > window.start),
    mode,
    liftGapThreshold,
  );

  for (const speech of speechWindows) {
    const start = Math.max(track.start, speech.start);
    const end = Math.min(track.end, speech.end);
    if (end <= start) {
      continue;
    }

    const localStart = start - track.start;
    const localEnd = end - track.start;
    rawPoints.push(
      {time: Math.max(0, localStart - rampDuration), volume: focusVolume},
      {time: localStart, volume: backgroundVolume},
      {time: localEnd, volume: backgroundVolume},
      {time: Math.min(trackDuration, localEnd + rampDuration), volume: focusVolume},
    );
  }

  const byTime = new Map<string, Omit<MusicVolumePoint, 'id'>>();
  for (const point of rawPoints) {
    const key = point.time.toFixed(3);
    const existing = byTime.get(key);
    byTime.set(key, {
      time: point.time,
      volume: existing ? Math.min(existing.volume, point.volume) : point.volume,
    });
  }

  const points = [...byTime.values()]
    .sort((a, b) => a.time - b.time)
    .map((point, index) => ({
      id: pointId('vol', index + 1),
      time: point.time,
      volume: clamp01(point.volume),
    }));

  return {
    enabled: true,
    points,
    focusVolume,
    backgroundVolume,
    rampDuration,
    mode,
    liftGapThreshold,
  };
};

export const musicVolumeAt = (
  track: {
    start: number;
    end: number;
    volume: number;
    muted?: boolean;
    fadeIn: number;
    fadeOut: number;
    duckUnderSpeech?: boolean;
    volumeAutomation?: MusicVolumeAutomation;
  },
  time: number,
  ducking: boolean,
) => {
  if (track.muted || time < track.start || time > track.end) {
    return 0;
  }
  const elapsed = time - track.start;
  const remaining = track.end - time;
  const fadeInFactor = track.fadeIn > 0 ? Math.min(1, elapsed / track.fadeIn) : 1;
  const fadeOutFactor = track.fadeOut > 0 ? Math.min(1, remaining / track.fadeOut) : 1;
  const graphLevel = musicAutomationLevelAt(track.volumeAutomation, track.volume, elapsed);
  const duckFactor = track.volumeAutomation?.enabled ? 1 : track.duckUnderSpeech && ducking ? 0.45 : 1;
  return Math.max(0, Math.min(1, graphLevel * fadeInFactor * fadeOutFactor * duckFactor));
};
