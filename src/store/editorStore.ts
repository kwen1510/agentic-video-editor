'use client';

import {create} from 'zustand';
import {
  getClipDuration,
  getClipTimelineWindows,
  getOpeningDuration,
  getVisualTimelineDuration,
  sortedVolumePoints,
} from '@/lib/timeline';
import type {
  Clip,
  ClipCandidate,
  EndingScreen,
  EndingTemplateId,
  MusicTrack,
  OpeningScreen,
  OpeningTemplateId,
  SourceVideo,
  TimelineLayer,
  TimelineProject,
  TimelineTransition,
  TranscriptResult,
  TranscriptThought,
} from '@/types/timeline';

const defaultOpeningScreen: OpeningScreen = {
  templateId: 'calm-academic',
  duration: 4,
  enabled: false,
  props: {
    title: 'Home Run Reflections',
    subtitle: 'Student voices',
    mood: 'calm',
    background: 'gradient',
  },
};

const defaultEndingScreen: EndingScreen = {
  templateId: 'thank-you',
  duration: 3,
  enabled: false,
  props: {
    title: 'Thank you',
    subtitle: 'A short wrap-up for this edit',
    credits: 'Edited with Codex',
    mood: 'positive',
    background: 'gradient',
  },
};

const withProjectDefaults = (project: TimelineProject): TimelineProject => ({
  ...project,
  sourceVideos: project.sourceVideos ?? (project.sourceVideo ? [project.sourceVideo] : []),
  transitions: project.transitions ?? [],
  endingScreen: project.endingScreen ?? defaultEndingScreen,
});

export const createEmptyProject = (): TimelineProject => ({
  projectId: `project-${new Date().toISOString().slice(0, 10)}`,
  sourceVideo: null,
  sourceVideos: [],
  openingScreen: defaultOpeningScreen,
  endingScreen: defaultEndingScreen,
  transitions: [],
  clips: [],
  layers: [],
  music: [],
});

type EditorState = {
  project: TimelineProject;
  currentTime: number;
  isPlaying: boolean;
  selectedLayerId: string | null;
  selectedClipId: string | null;
  transcript: TranscriptResult | null;
  thoughts: TranscriptThought[];
  candidates: ClipCandidate[];
  setProject: (project: TimelineProject) => void;
  patchProject: (patch: Partial<TimelineProject>) => void;
  setSourceVideo: (sourceVideo: SourceVideo) => void;
  updateSourceVideo: (src: string, patch: Partial<SourceVideo>) => void;
  updateAllSourceAudio: (patch: Pick<Partial<SourceVideo>, 'volume' | 'muted'>) => void;
  setOpeningScreen: (openingScreen: OpeningScreen) => void;
  setOpeningTemplate: (templateId: OpeningTemplateId) => void;
  setEndingScreen: (endingScreen: EndingScreen) => void;
  setEndingTemplate: (templateId: EndingTemplateId) => void;
  upsertTransition: (transition: TimelineTransition) => void;
  removeTransition: (id: string) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  addLayer: (type?: TimelineLayer['type']) => TimelineLayer;
  updateLayer: (id: string, patch: Partial<TimelineLayer>) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  selectClip: (id: string | null) => void;
  addMusicTrack: (track: MusicTrack) => void;
  updateMusicTrack: (id: string, patch: Partial<MusicTrack>) => void;
  removeMusicTrack: (id: string) => void;
  updateClip: (id: string, patch: Partial<Clip>) => void;
  moveClipRipple: (id: string, timelineStart: number) => void;
  splitClip: (id: string, sourceTime?: number) => void;
  addClip: (clip: Clip) => void;
  reorderClip: (id: string, targetIndex: number) => void;
  deleteClip: (id: string) => void;
  setTranscript: (transcript: TranscriptResult | null) => void;
  setThoughts: (thoughts: TranscriptThought[]) => void;
  setCandidates: (candidates: ClipCandidate[]) => void;
  applyJson: (json: string) => void;
};

const makeLayer = (time: number, type: TimelineLayer['type'] = 'text'): TimelineLayer => ({
  id: `layer_${crypto.randomUUID().slice(0, 8)}`,
  type,
  start: Math.max(0, time),
  end: Math.max(3, time + 5),
  text:
    type === 'caption'
      ? 'Editable caption'
      : type === 'lower-third'
        ? 'Speaker name'
        : type === 'arrow'
          ? 'Label'
          : 'Key idea',
  x: type === 'caption' ? 120 : 96,
  y: type === 'caption' ? 790 : 120,
  scale: type === 'card' ? 1.1 : 1,
  opacity: 1,
  rotation: 0,
  zIndex: type === 'caption' ? 30 : 20,
  animation: type === 'text' || type === 'card' ? 'fade-up' : 'none',
});

type ClipWindow = {start: number; end: number};

const compactClipTimeline = (project: TimelineProject, clips: Clip[]) => {
  let cursor = getOpeningDuration(project);
  return clips.map((clip) => {
    const next = {...clip, timelineStart: cursor};
    cursor += getClipDuration(next);
    return next;
  });
};

const clipWindows = (project: TimelineProject, clips = project.clips) => {
  const windows = new Map<string, ClipWindow>();
  for (const {clip, start, end} of getClipTimelineWindows(project, clips)) {
    windows.set(clip.id, {start, end});
  }

  return windows;
};

const automationWithEndPoint = (track: MusicTrack, end: number) => {
  const automation = track.volumeAutomation;
  if (!automation?.enabled) {
    return automation;
  }

  const duration = Math.max(0.05, end - track.start);
  const points = sortedVolumePoints(automation.points).filter((point) => point.time < duration - 0.001);
  const endVolume = automation.focusVolume ?? points.at(-1)?.volume ?? track.volume;

  return {
    ...automation,
    points: [
      ...points,
      {
        id: `vol_${(points.length + 1).toString().padStart(2, '0')}`,
        time: duration,
        volume: endVolume,
      },
    ],
  };
};

const normalizeMusicTrack = (track: MusicTrack): MusicTrack => {
  const duration = Math.max(0.05, track.end - track.start);
  const fadeOut = Math.max(0.75, Math.min(track.fadeOut || 2, Math.max(0.75, duration / 2)));
  const fadeIn = Math.max(0, Math.min(track.fadeIn || 0, Math.max(0, duration - fadeOut)));
  const normalized = {
    ...track,
    fadeIn,
    fadeOut,
  };

  return {
    ...normalized,
    volumeAutomation: automationWithEndPoint(normalized, normalized.end),
  };
};

const extendMusicToVisualEnd = (project: TimelineProject): TimelineProject => {
  if (project.music.length === 0) {
    return project;
  }

  const visualEnd = getVisualTimelineDuration(project);
  return {
    ...project,
    music: project.music.map((track) => {
      const end = Math.max(track.end, visualEnd);
      if (Math.abs(end - track.end) < 0.001) {
        return normalizeMusicTrack(track);
      }
      return normalizeMusicTrack({
        ...track,
        end,
      });
    }),
  };
};

const layerClipId = (layer: TimelineLayer, clips: Clip[]) => {
  if (layer.clipId) {
    return layer.clipId;
  }

  return clips.find((clip) => layer.id.includes(clip.id))?.id ?? null;
};

const clampLayerWindow = (start: number, end: number, window: ClipWindow) => {
  const safeStart = Math.min(Math.max(start, window.start), Math.max(window.start, window.end - 0.05));
  const safeEnd = Math.min(Math.max(end, safeStart + 0.05), window.end);
  return {start: safeStart, end: safeEnd};
};

const shiftLinkedLayers = (project: TimelineProject, clips: Clip[]) => {
  const oldWindows = clipWindows(project);
  const nextProject = {...project, clips};
  const newWindows = clipWindows(nextProject, clips);

  return project.layers.map((layer) => {
    const clipId = layerClipId(layer, project.clips);
    if (!clipId) {
      return layer;
    }

    const oldWindow = oldWindows.get(clipId);
    const newWindow = newWindows.get(clipId);
    if (!oldWindow || !newWindow) {
      return layer;
    }

    const localStart = layer.start - oldWindow.start;
    const localEnd = layer.end - oldWindow.start;
    const synced = clampLayerWindow(newWindow.start + localStart, newWindow.start + localEnd, newWindow);
    return {
      ...layer,
      clipId,
      start: synced.start,
      end: synced.end,
    };
  });
};

const splitCaptionText = (text: string, count: number) => {
  const words = text.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const chunkSize = Math.ceil(words.length / Math.max(1, count));
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += chunkSize) {
    chunks.push(words.slice(index, index + chunkSize).join(' '));
  }
  return chunks;
};

const existingCaptionTextBySegment = (layers: TimelineLayer[]) => {
  const bySegment = new Map<string, string>();
  for (const layer of layers) {
    if (layer.type !== 'caption' || !layer.segmentIds?.length) {
      continue;
    }
    bySegment.set(layer.segmentIds.join('|'), layer.text);
  }
  return bySegment;
};

const patchCaptionGaps = (captions: TimelineLayer[], window: ClipWindow) => {
  if (captions.length === 0) {
    return captions;
  }

  const sorted = [...captions].sort((a, b) => a.start - b.start);
  sorted[0] = {...sorted[0], start: window.start};

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (current.start > previous.end) {
      sorted[index - 1] = {...previous, end: current.start};
    }
    if (current.start < sorted[index - 1].end) {
      sorted[index] = {...current, start: sorted[index - 1].end};
    }
  }

  const last = sorted.at(-1);
  if (last && last.end < window.end) {
    sorted[sorted.length - 1] = {...last, end: window.end};
  }

  return sorted.map((caption) => clampLayerWindow(caption.start, caption.end, window)).map((time, index) => ({
    ...sorted[index],
    start: time.start,
    end: time.end,
  }));
};

const buildTranscriptCaptionLayers = (project: TimelineProject, clips: Clip[], transcript: TranscriptResult | null) => {
  if (!transcript) {
    return [];
  }

  const textBySegment = existingCaptionTextBySegment(project.layers);
  const nextProject = {...project, clips};
  const windows = getClipTimelineWindows(nextProject, clips);
  const captions: TimelineLayer[] = [];

  for (const {clip, start, end} of windows) {
    const sourceSrc = clip.sourceSrc ?? project.sourceVideo?.src;
    const window = {start, end};
    const clipCaptions: TimelineLayer[] = [];
    const matchingSegments = transcript.segments.filter((segment) => {
      const sameSource = sourceSrc ? segment.sourceSrc === sourceSrc : true;
      return sameSource && segment.end > clip.safeStart && segment.start < clip.safeEnd;
    });

    for (const segment of matchingSegments) {
      const sourceStart = Math.max(segment.start, clip.safeStart);
      const sourceEnd = Math.min(segment.end, clip.safeEnd);
      const sourceDuration = Math.max(0.05, sourceEnd - sourceStart);
      const segmentDuration = Math.max(0.05, segment.end - segment.start);
      const words = segment.text.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
      const startWord = Math.max(0, Math.floor(words.length * ((sourceStart - segment.start) / segmentDuration)));
      const endWord = Math.min(words.length, Math.ceil(words.length * ((sourceEnd - segment.start) / segmentDuration)));
      const visibleWords = words.slice(startWord, Math.max(startWord + 1, endWord));
      const visibleText = visibleWords.join(' ') || segment.text;
      const chunkCount = Math.max(1, Math.min(Math.ceil(visibleWords.length / 6), Math.max(1, Math.floor(sourceDuration / 0.8))));
      const chunks = splitCaptionText(visibleText, chunkCount);

      chunks.forEach((chunk, chunkIndex) => {
        const chunkStart = sourceStart + (sourceDuration / chunks.length) * chunkIndex;
        const chunkEnd = chunkIndex === chunks.length - 1 ? sourceEnd : sourceStart + (sourceDuration / chunks.length) * (chunkIndex + 1);
        const segmentIds = [`${segment.id}:${chunkIndex + 1}`];
        const id = `caption_${clip.id}_${segment.id}_${chunkIndex + 1}`;
        clipCaptions.push({
          id,
          clipId: clip.id,
          sourceStart: chunkStart,
          sourceEnd: chunkEnd,
          segmentIds,
          type: 'caption',
          start: start + (chunkStart - clip.safeStart),
          end: start + (chunkEnd - clip.safeStart),
          text: textBySegment.get(segmentIds.join('|')) ?? chunk,
          x: 108,
          y: 1520,
          scale: 1,
          opacity: 1,
          rotation: 0,
          zIndex: 40,
          animation: 'fade-up',
        });
      });
    }

    captions.push(...patchCaptionGaps(clipCaptions, window));
  }

  return captions;
};

const patchExistingCaptionGaps = (project: TimelineProject, clips: Clip[], layers: TimelineLayer[]) => {
  const nextProject = {...project, clips};
  const windows = new Map(getClipTimelineWindows(nextProject, clips).map(({clip, start, end}) => [clip.id, {start, end}]));
  const patchedIds = new Set<string>();
  const patched: TimelineLayer[] = [];

  for (const clip of clips) {
    const window = windows.get(clip.id);
    if (!window) {
      continue;
    }
    const captions = layers.filter((layer) => layer.type === 'caption' && layerClipId(layer, clips) === clip.id);
    const filled = patchCaptionGaps(captions, window);
    filled.forEach((layer) => {
      patchedIds.add(layer.id);
      patched.push(layer);
    });
  }

  return [...layers.filter((layer) => !patchedIds.has(layer.id)), ...patched];
};

const syncClipLinkedLayers = (project: TimelineProject, clips: Clip[], transcript: TranscriptResult | null) => {
  const shiftedLayers = shiftLinkedLayers(project, clips);
  const transcriptCaptions = buildTranscriptCaptionLayers(project, clips, transcript);
  if (transcriptCaptions.length === 0) {
    return patchExistingCaptionGaps(project, clips, shiftedLayers);
  }

  const replacedClipIds = new Set(transcriptCaptions.map((layer) => layer.clipId).filter(Boolean));
  return [
    ...shiftedLayers.filter((layer) => layer.type !== 'caption' || !replacedClipIds.has(layer.clipId)),
    ...transcriptCaptions,
  ];
};

const clipWindowList = (project: TimelineProject, clips = project.clips) => getClipTimelineWindows(project, clips);

const applyClipPatchWithRipple = (project: TimelineProject, id: string, patch: Partial<Clip>) => {
  const index = project.clips.findIndex((clip) => clip.id === id);
  if (index < 0) {
    return project.clips;
  }

  const patchedClips = project.clips.map((clip) => (clip.id === id ? {...clip, ...patch} : clip));
  return compactClipTimeline(project, patchedClips);
};

const applyClipMoveRipple = (project: TimelineProject, id: string, requestedStart: number) => {
  const index = project.clips.findIndex((clip) => clip.id === id);
  if (index < 0) {
    return project.clips;
  }

  const windows = clipWindowList(project);
  const currentWindow = windows[index];
  if (!currentWindow) {
    return project.clips;
  }

  const movingClip = project.clips[index];
  const remainingClips = project.clips.filter((clip) => clip.id !== id);
  const remainingWindows = windows.filter(({clip}) => clip.id !== id);
  let targetIndex = remainingClips.length;

  for (let windowIndex = 0; windowIndex < remainingWindows.length; windowIndex += 1) {
    const window = remainingWindows[windowIndex];
    const midpoint = window.start + (window.end - window.start) / 2;
    if (requestedStart < midpoint) {
      targetIndex = windowIndex;
      break;
    }
  }

  const reordered = [...remainingClips];
  reordered.splice(targetIndex, 0, movingClip);
  return compactClipTimeline(project, reordered);
};

const normalizeSplitRawBounds = (clip: Clip): Clip => {
  const safeStart = Math.min(clip.safeStart, clip.safeEnd - 0.05);
  const safeEnd = Math.max(clip.safeEnd, safeStart + 0.05);
  let rawStart = Math.max(safeStart, Math.min(clip.rawStart, safeEnd - 0.05));
  let rawEnd = Math.min(safeEnd, Math.max(clip.rawEnd, rawStart + 0.05));

  if (rawEnd <= rawStart) {
    rawStart = safeStart;
    rawEnd = safeEnd;
  }

  return {
    ...clip,
    safeStart,
    safeEnd,
    rawStart,
    rawEnd,
    paddedStart: typeof clip.paddedStart === 'number' ? Math.max(safeStart, Math.min(clip.paddedStart, safeEnd)) : clip.paddedStart,
    paddedEnd: typeof clip.paddedEnd === 'number' ? Math.max(safeStart, Math.min(clip.paddedEnd, safeEnd)) : clip.paddedEnd,
  };
};

const splitClipAtSourceTime = (project: TimelineProject, id: string, sourceTime?: number) => {
  const index = project.clips.findIndex((clip) => clip.id === id);
  if (index < 0) {
    return project.clips;
  }

  const clip = project.clips[index];
  const splitAt = Math.max(
    clip.safeStart + 0.25,
    Math.min(typeof sourceTime === 'number' ? sourceTime : (clip.safeStart + clip.safeEnd) / 2, clip.safeEnd - 0.25),
  );

  if (clip.safeEnd - clip.safeStart < 0.5 || splitAt <= clip.safeStart || splitAt >= clip.safeEnd) {
    return project.clips;
  }

  const windows = clipWindowList(project);
  const currentWindow = windows[index];
  const first = normalizeSplitRawBounds({
    ...clip,
    safeEnd: splitAt,
    rawEnd: Math.min(clip.rawEnd, splitAt),
    paddedEnd: typeof clip.paddedEnd === 'number' ? Math.min(clip.paddedEnd, splitAt) : clip.paddedEnd,
  });
  const secondId = `clip_${crypto.randomUUID().slice(0, 8)}`;
  const second = normalizeSplitRawBounds({
    ...clip,
    id: secondId,
    safeStart: splitAt,
    rawStart: Math.max(clip.rawStart, splitAt),
    paddedStart: typeof clip.paddedStart === 'number' ? Math.max(clip.paddedStart, splitAt) : clip.paddedStart,
    timelineStart: currentWindow ? currentWindow.start + getClipDuration(first) : undefined,
  });

  const clips = [...project.clips];
  clips.splice(index, 1, first, second);
  return compactClipTimeline(project, clips);
};

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createEmptyProject(),
  currentTime: 0,
  isPlaying: false,
  selectedLayerId: null,
  selectedClipId: null,
  transcript: null,
  thoughts: [],
  candidates: [],
  setProject: (project) =>
    set(() => {
      const nextProject = withProjectDefaults(project);
      const clips = compactClipTimeline(nextProject, nextProject.clips);
      return {
        project: extendMusicToVisualEnd({
          ...nextProject,
          clips,
          layers: syncClipLinkedLayers(nextProject, clips, null),
        }),
        currentTime: 0,
        isPlaying: false,
        selectedLayerId: null,
        selectedClipId: null,
      };
    }),
  patchProject: (patch) =>
    set(({project, transcript}) => {
      const nextProject = withProjectDefaults({...project, ...patch});
      if (!patch.clips) {
        return {project: extendMusicToVisualEnd(nextProject)};
      }
      const clips = compactClipTimeline(nextProject, nextProject.clips);
      return {
        project: extendMusicToVisualEnd({
          ...nextProject,
          clips,
          layers: syncClipLinkedLayers(nextProject, clips, transcript),
        }),
      };
    }),
  setSourceVideo: (sourceVideo) =>
    set(({project}) => ({
      project: {...project, sourceVideo, sourceVideos: [sourceVideo]},
      selectedClipId: null,
    })),
  updateSourceVideo: (src, patch) =>
    set(({project}) => {
      const sourceVideo = project.sourceVideo?.src === src ? {...project.sourceVideo, ...patch} : project.sourceVideo;
      const sourceVideos =
        project.sourceVideos?.map((source) => (source.src === src ? {...source, ...patch} : source)) ??
        (sourceVideo ? [sourceVideo] : []);

      return {
        project: {
          ...project,
          sourceVideo,
          sourceVideos,
        },
      };
    }),
  updateAllSourceAudio: (patch) =>
    set(({project}) => {
      const sourceVideo = project.sourceVideo ? {...project.sourceVideo, ...patch} : null;
      const sourceVideos = project.sourceVideos?.length
        ? project.sourceVideos.map((source) => ({...source, ...patch}))
        : sourceVideo
          ? [sourceVideo]
          : [];

      return {
        project: {
          ...project,
          sourceVideo,
          sourceVideos,
        },
      };
    }),
  setOpeningScreen: (openingScreen) =>
    set(({project}) => {
      const nextProject = {...project, openingScreen};
      const clips = compactClipTimeline(nextProject, nextProject.clips);
      const openingDelta = getOpeningDuration(nextProject) - getOpeningDuration(project);
      return {
        project: extendMusicToVisualEnd({
          ...nextProject,
          clips,
          layers: project.layers.map((layer) => ({
            ...layer,
            start: Math.max(0, layer.start + openingDelta),
            end: Math.max(0.05, layer.end + openingDelta),
          })),
        }),
      };
    }),
  setOpeningTemplate: (templateId) =>
    set(({project}) => ({
      project: {
        ...project,
        openingScreen: {
          ...project.openingScreen,
          templateId,
        },
      },
    })),
  setEndingScreen: (endingScreen) =>
    set(({project}) => ({
      project: extendMusicToVisualEnd({...project, endingScreen}),
    })),
  setEndingTemplate: (templateId) =>
    set(({project}) => ({
      project: {
        ...project,
        endingScreen: {
          ...(project.endingScreen ?? defaultEndingScreen),
          templateId,
        },
      },
    })),
  upsertTransition: (transition) =>
    set(({project}) => {
      const transitions = project.transitions ?? [];
      const exists = transitions.some((item) => item.id === transition.id);
      return {
        project: {
          ...project,
          transitions: exists
            ? transitions.map((item) => (item.id === transition.id ? transition : item))
            : [...transitions, transition],
        },
      };
    }),
  removeTransition: (id) =>
    set(({project}) => ({
      project: {
        ...project,
        transitions: (project.transitions ?? []).filter((transition) => transition.id !== id),
      },
    })),
  setCurrentTime: (time) => set({currentTime: Math.max(0, time)}),
  setPlaying: (isPlaying) => set({isPlaying}),
  addLayer: (type) => {
    const layer = makeLayer(get().currentTime, type);
    set(({project}) => ({
      project: {...project, layers: [...project.layers, layer]},
      selectedLayerId: layer.id,
    }));
    return layer;
  },
  updateLayer: (id, patch) =>
    set(({project}) => ({
      project: {
        ...project,
        layers: project.layers.map((layer) => (layer.id === id ? {...layer, ...patch} : layer)),
      },
    })),
  deleteLayer: (id) =>
    set(({project, selectedLayerId}) => ({
      project: {...project, layers: project.layers.filter((layer) => layer.id !== id)},
      selectedLayerId: selectedLayerId === id ? null : selectedLayerId,
    })),
  duplicateLayer: (id) =>
    set(({project}) => {
      const layer = project.layers.find((item) => item.id === id);
      if (!layer) {
        return {project};
      }
      const duplicate = {
        ...layer,
        id: `layer_${crypto.randomUUID().slice(0, 8)}`,
        x: layer.x + 32,
        y: layer.y + 32,
      };
      return {
        project: {...project, layers: [...project.layers, duplicate]},
        selectedLayerId: duplicate.id,
      };
    }),
  selectLayer: (selectedLayerId) => set({selectedLayerId}),
  selectClip: (selectedClipId) => set({selectedClipId}),
  addMusicTrack: (track) =>
    set(({project}) => ({
      project: {...project, music: [...project.music, normalizeMusicTrack(track)]},
    })),
  updateMusicTrack: (id, patch) =>
    set(({project}) => ({
      project: {
        ...project,
        music: project.music.map((track) => (track.id === id ? normalizeMusicTrack({...track, ...patch}) : track)),
      },
    })),
  removeMusicTrack: (id) =>
    set(({project}) => ({
      project: {...project, music: project.music.filter((track) => track.id !== id)},
    })),
  updateClip: (id, patch) =>
    set(({project, transcript}) => {
      const clips = applyClipPatchWithRipple(project, id, patch);
      return {
        project: extendMusicToVisualEnd({
          ...project,
          clips,
          layers: syncClipLinkedLayers(project, clips, transcript),
        }),
      };
    }),
  moveClipRipple: (id, timelineStart) =>
    set(({project, transcript}) => {
      const clips = applyClipMoveRipple(project, id, timelineStart);
      return {
        project: extendMusicToVisualEnd({
          ...project,
          clips,
          layers: syncClipLinkedLayers(project, clips, transcript),
        }),
      };
    }),
  splitClip: (id, sourceTime) =>
    set(({project, transcript}) => {
      const clips = splitClipAtSourceTime(project, id, sourceTime);
      const didSplit = clips.length > project.clips.length;
      const index = clips.findIndex((clip) => clip.id === id);
      const nextClip = didSplit && index >= 0 ? clips[index + 1] : null;
      return {
        project: extendMusicToVisualEnd({
          ...project,
          clips,
          layers: syncClipLinkedLayers(project, clips, transcript),
        }),
        selectedClipId: nextClip?.id ?? id,
      };
    }),
  addClip: (clip) =>
    set(({project, transcript}) => {
      const clips = compactClipTimeline(project, [...project.clips, clip]);
      return {
        project: extendMusicToVisualEnd({
          ...project,
          clips,
          layers: syncClipLinkedLayers(project, clips, transcript),
        }),
      };
    }),
  reorderClip: (id, targetIndex) =>
    set(({project}) => {
      const currentIndex = project.clips.findIndex((clip) => clip.id === id);
      if (currentIndex < 0) {
        return {project};
      }

      const clips = [...project.clips];
      const [clip] = clips.splice(currentIndex, 1);
      const nextIndex = Math.max(0, Math.min(clips.length, targetIndex));
      clips.splice(nextIndex, 0, clip);

      const compacted = compactClipTimeline(project, clips);
      return {project: extendMusicToVisualEnd({...project, clips: compacted, layers: syncClipLinkedLayers(project, compacted, get().transcript)})};
    }),
  deleteClip: (id) =>
    set(({project, transcript, selectedClipId}) => {
      const clips = compactClipTimeline(project, project.clips.filter((clip) => clip.id !== id));
      return {
        project: extendMusicToVisualEnd({
          ...project,
          clips,
          transitions: (project.transitions ?? []).filter(
            (transition) => transition.fromClipId !== id && transition.toClipId !== id,
          ),
          layers: syncClipLinkedLayers(
            {...project, layers: project.layers.filter((layer) => layer.clipId !== id)},
            clips,
            transcript,
          ),
        }),
        selectedClipId: selectedClipId === id ? null : selectedClipId,
      };
    }),
  setTranscript: (transcript) =>
    set(({project}) => ({
      transcript,
      project: transcript
        ? {
            ...project,
            layers: syncClipLinkedLayers(project, project.clips, transcript),
          }
        : project,
    })),
  setThoughts: (thoughts) => set({thoughts}),
  setCandidates: (candidates) => set({candidates}),
  applyJson: (json) => {
    const parsed = JSON.parse(json) as TimelineProject;
    get().setProject(parsed);
  },
}));
