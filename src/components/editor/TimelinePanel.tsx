'use client';

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Copy, Film, Music2, Plus, Scissors, Sparkles, Trash2} from 'lucide-react';
import {formatTime, getClipTimelineWindows, getContentEnd, getOpeningDuration, getTimelineDuration, sortedVolumePoints} from '@/lib/timeline';
import {useEditorStore} from '@/store/editorStore';
import type {EndingScreen, EndingTemplateId, MusicTrack, TimelineLayer, TimelineTransition, TransitionStyle} from '@/types/timeline';

const minDuration = 0.25;
const rulerHeight = 26;
const rowHeight = 34;
const rowGap = 8;
const leftRail = 'w-[116px] shrink-0 border-r border-slate-800/90 pr-3 text-right';

type DragMode = 'move' | 'start' | 'end';

type VisualTrack = {
  id: string;
  label: string;
  detail: string;
  color: string;
  textColor: string;
  start: number;
  end: number;
  row: number;
  kind: 'opening' | 'ending' | 'source-idle' | 'source' | 'clip' | 'layer';
  layer?: TimelineLayer;
  clipId?: string;
};

type VisualRow = {
  id: string;
  label: string;
  detail: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const compactLabel = (label: string) =>
  label
    .replace(/\.(mp4|mov|m4v|webm)$/i, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const miniAutomationPolyline = (track: MusicTrack) => {
  const duration = Math.max(0.05, track.end - track.start);
  const points = track.volumeAutomation?.enabled
    ? sortedVolumePoints(track.volumeAutomation.points)
    : [
        {id: 'flat_1', time: 0, volume: track.volume},
        {id: 'flat_2', time: duration, volume: track.volume},
      ];
  return points
    .map((point) => {
      const x = (Math.max(0, Math.min(duration, point.time)) / duration) * 100;
      const y = 28 - Math.max(0, Math.min(1, point.volume)) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
};

const transitionStyleOptions: Array<{id: TransitionStyle; label: string}> = [
  {id: 'soft-fade', label: 'Soft fade'},
  {id: 'cross-dissolve', label: 'Cross dissolve'},
  {id: 'letterbox-reveal', label: 'Letterbox reveal'},
  {id: 'whip-pan', label: 'Whip pan'},
  {id: 'zoom-through', label: 'Zoom through'},
  {id: 'film-burn-flash', label: 'Film burn flash'},
];

const endingTemplateOptions: Array<{id: EndingTemplateId; label: string}> = [
  {id: 'simple-credits', label: 'Simple credits'},
  {id: 'thank-you', label: 'Thank you'},
  {id: 'next-steps', label: 'Next steps'},
  {id: 'social-follow', label: 'Social follow'},
  {id: 'minimal-roll', label: 'Minimal roll'},
];

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

type TransitionBoundary = TimelineTransition & {
  boundaryTime: number;
  active: boolean;
};

export const TimelinePanel: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const currentTime = useEditorStore((state) => state.currentTime);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const selectLayer = useEditorStore((state) => state.selectLayer);
  const selectClip = useEditorStore((state) => state.selectClip);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const duplicateLayer = useEditorStore((state) => state.duplicateLayer);
  const updateMusicTrack = useEditorStore((state) => state.updateMusicTrack);
  const removeMusicTrack = useEditorStore((state) => state.removeMusicTrack);
  const updateClip = useEditorStore((state) => state.updateClip);
  const moveClipRipple = useEditorStore((state) => state.moveClipRipple);
  const deleteClip = useEditorStore((state) => state.deleteClip);
  const updateAllSourceAudio = useEditorStore((state) => state.updateAllSourceAudio);
  const upsertTransition = useEditorStore((state) => state.upsertTransition);
  const removeTransition = useEditorStore((state) => state.removeTransition);
  const setEndingScreen = useEditorStore((state) => state.setEndingScreen);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const cleanupDragRef = useRef<(() => void) | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    kind: 'layer' | 'music' | 'clip';
    id: string;
    startX: number;
    start: number;
    end: number;
    sourceStart?: number;
    sourceEnd?: number;
  } | null>(null);

  const duration = Math.max(1, getTimelineDuration(project));
  const openingDuration = getOpeningDuration(project);
  const contentEnd = getContentEnd(project);
  const activeEndingScreen = project.endingScreen ?? defaultEndingScreen;

  const {visualRows, visualTracks} = useMemo<{visualRows: VisualRow[]; visualTracks: VisualTrack[]}>(() => {
    const tracks: VisualTrack[] = [];
    const rows: VisualRow[] = [];
    const sourceVideos = project.sourceVideos?.length
      ? project.sourceVideos
      : project.sourceVideo
        ? [project.sourceVideo]
        : [];

    if (project.openingScreen.enabled) {
      const row = rows.length;
      rows.push({id: 'opening', label: 'Opening', detail: 'template'});
      tracks.push({
        id: 'opening',
        label: project.openingScreen.templateId,
        detail: 'opening screen',
        color: 'bg-emerald-400',
        textColor: 'text-slate-950',
        start: 0,
        end: openingDuration,
        row,
        kind: 'opening',
      });
    }

    const sourceRowBySrc = new Map<string, number>();
    for (const source of sourceVideos) {
      const row = rows.length;
      const label = compactLabel(source.name ?? source.src.split('/').at(-1) ?? 'source');
      sourceRowBySrc.set(source.src, row);
      rows.push({id: source.src, label, detail: 'source channel'});
      tracks.push({
        id: `idle_${source.src}`,
        label,
        detail: project.clips.length > 0 ? 'unused ranges dimmed' : 'main video',
        color: 'bg-slate-700/55',
        textColor: 'text-slate-400',
        start: project.clips.length > 0 ? 0 : openingDuration,
        end: duration,
        row,
        kind: 'source-idle',
      });
    }

    for (const {clip, start, end} of getClipTimelineWindows(project)) {
      const row = sourceRowBySrc.get(clip.sourceSrc ?? project.sourceVideo?.src ?? '') ?? rows.length;
      if (row === rows.length) {
        rows.push({id: clip.sourceSrc ?? clip.id, label: clip.sourceName ?? 'Source clip', detail: 'source channel'});
      }
      tracks.push({
        id: clip.id,
        label: compactLabel(clip.sourceName ?? clip.id),
        detail: `${formatTime(start)} out · ${formatTime(clip.safeStart)}-${formatTime(clip.safeEnd)} src`,
        color: 'bg-amber-300',
        textColor: 'text-slate-950',
        start,
        end,
        row,
        kind: 'clip',
        clipId: clip.id,
      });
    }

    const captionLayers = project.layers.filter((layer) => layer.type === 'caption');
    const overlayLayers = project.layers.filter((layer) => layer.type !== 'caption');
    const captionRow =
      captionLayers.length > 0
        ? rows.push({id: 'captions', label: 'Captions', detail: 'burnable text'}) - 1
        : -1;
    const overlayRow =
      overlayLayers.length > 0
        ? rows.push({id: 'overlays', label: 'Overlays', detail: 'editable layers'}) - 1
        : -1;

    for (const layer of [...project.layers].sort((a, b) => a.zIndex - b.zIndex)) {
      const isCaption = layer.type === 'caption';
      const row = isCaption ? captionRow : overlayRow;
      tracks.push({
        id: layer.id,
        label: layer.text || layer.type,
        detail: `${layer.type} · z${layer.zIndex}`,
        color: isCaption ? 'bg-cyan-300' : 'bg-violet-300',
        textColor: 'text-slate-950',
        start: layer.start,
        end: layer.end,
        row,
        kind: 'layer',
        layer,
      });
    }

    if (project.endingScreen?.enabled) {
      const row = rows.length;
      const endingStart = getContentEnd(project);
      rows.push({id: 'ending', label: 'Ending', detail: 'template'});
      tracks.push({
        id: 'ending',
        label: project.endingScreen.templateId,
        detail: 'wrap-up screen',
        color: 'bg-teal-300',
        textColor: 'text-slate-950',
        start: endingStart,
        end: endingStart + project.endingScreen.duration,
        row,
        kind: 'ending',
      });
    }

    return {visualRows: rows, visualTracks: tracks};
  }, [
    duration,
    openingDuration,
    project,
  ]);

  const visualHeight = Math.max(214, rulerHeight + visualRows.length * (rowHeight + rowGap) + 16);
  const audioHeight = Math.max(84, rulerHeight + Math.max(1, project.music.length) * (rowHeight + rowGap) + 16);
  const selectedLayer = project.layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const selectedEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const allSourcesMuted = project.sourceVideos?.length
    ? project.sourceVideos.every((source) => source.muted)
    : project.sourceVideo?.muted ?? false;
  const allMusicMuted = project.music.length > 0 && project.music.every((track) => track.muted);
  const selectedTransition = (project.transitions ?? []).find((transition) => transition.id === selectedTransitionId) ?? null;
  const transitionBoundaries = useMemo<TransitionBoundary[]>(() => {
    const clipWindows = getClipTimelineWindows(project);
    return clipWindows.slice(0, -1).map((window, index) => {
      const nextWindow = clipWindows[index + 1];
      const existing = (project.transitions ?? []).find(
        (transition) => transition.fromClipId === window.clip.id && transition.toClipId === nextWindow.clip.id,
      );
      return {
        id: existing?.id ?? `transition_${window.clip.id}_${nextWindow.clip.id}`,
        fromClipId: window.clip.id,
        toClipId: nextWindow.clip.id,
        style: existing?.style ?? 'soft-fade',
        duration: existing?.duration ?? 0.45,
        enabled: existing?.enabled ?? false,
        boundaryTime: window.end,
        active: Boolean(existing?.enabled),
      };
    });
  }, [project]);

  useEffect(() => {
    if (selectedLayer?.type === 'caption') {
      selectedEditorRef.current?.focus();
    }
  }, [selectedLayer?.id, selectedLayer?.type]);

  useEffect(() => {
    if (selectedTransitionId && !selectedTransition) {
      setSelectedTransitionId(null);
    }
  }, [selectedTransition, selectedTransitionId]);

  const pointerTime = (clientX: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) {
      return 0;
    }
    const trackLeft = rect.left + 116;
    const trackWidth = rect.width - 116;
    return clamp(((clientX - trackLeft) / trackWidth) * duration, 0, duration);
  };

  const cleanupDrag = () => {
    cleanupDragRef.current?.();
    cleanupDragRef.current = null;
  };

  const moveDragTo = (clientX: number) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const trackWidth = rect.width - 116;
    const delta = ((clientX - drag.startX) / trackWidth) * duration;

    if (drag.kind === 'clip') {
      const clip = project.clips.find((item) => item.id === drag.id);
      if (!clip || typeof drag.sourceStart !== 'number' || typeof drag.sourceEnd !== 'number') {
        return;
      }
      if (drag.mode === 'move') {
        moveClipRipple(drag.id, drag.start + delta);
        return;
      }
      const source = (project.sourceVideos ?? []).find((item) => item.src === (clip.sourceSrc ?? project.sourceVideo?.src)) ?? project.sourceVideo;
      const sourceDuration = Math.max(drag.sourceEnd, source?.duration ?? drag.sourceEnd);

      if (drag.mode === 'start') {
        updateClip(drag.id, {
          safeStart: clamp(drag.sourceStart + delta, 0, drag.sourceEnd - minDuration),
        });
      }
      if (drag.mode === 'end') {
        updateClip(drag.id, {
          safeEnd: clamp(drag.sourceEnd + delta, drag.sourceStart + minDuration, sourceDuration),
        });
      }
      return;
    }

    let start = drag.start;
    let end = drag.end;

    if (drag.mode === 'move') {
      const length = end - start;
      start = clamp(drag.start + delta, 0, Math.max(0, duration - length));
      end = start + length;
    }
    if (drag.mode === 'start') {
      start = clamp(drag.start + delta, 0, drag.end - minDuration);
    }
    if (drag.mode === 'end') {
      end = clamp(drag.end + delta, drag.start + minDuration, duration);
    }

    if (drag.kind === 'layer') {
      updateLayer(drag.id, {start, end});
    }
    if (drag.kind === 'music') {
      updateMusicTrack(drag.id, {start, end});
    }
  };

  const finishDrag = () => {
    cleanupDrag();
    dragRef.current = null;
  };

  const startDrag = (
    event: React.PointerEvent | React.MouseEvent,
    kind: 'layer' | 'music' | 'clip',
    id: string,
    mode: DragMode,
    start: number,
    end: number,
  ) => {
    event.stopPropagation();
    cleanupDrag();
    const clip = kind === 'clip' ? project.clips.find((item) => item.id === id) : null;
    dragRef.current = {
      mode,
      kind,
      id,
      startX: event.clientX,
      start,
      end,
      sourceStart: clip?.safeStart,
      sourceEnd: clip?.safeEnd,
    };

    const onPointerMove = (pointerEvent: PointerEvent) => moveDragTo(pointerEvent.clientX);
    const onPointerUp = () => finishDrag();
    const onMouseMove = (mouseEvent: MouseEvent) => moveDragTo(mouseEvent.clientX);
    const onMouseUp = () => finishDrag();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, {once: true});
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp, {once: true});
    cleanupDragRef.current = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  };

  const moveDrag = (event: React.PointerEvent) => moveDragTo(event.clientX);

  const endDrag = () => finishDrag();

  const editLayerText = (layer: TimelineLayer) => {
    const nextText = window.prompt(layer.type === 'caption' ? 'Edit caption text' : 'Edit layer text', layer.text);
    if (nextText !== null) {
      updateLayer(layer.id, {text: nextText});
      selectLayer(layer.id);
    }
  };

  const openEditorPanel = (tab: 'clips' | 'music') => {
    window.dispatchEvent(new CustomEvent('agentic-video-editor:open-panel', {detail: {tab}}));
  };

  const activateTransition = (boundary: TransitionBoundary) => {
    const transition: TimelineTransition = {
      id: boundary.id,
      fromClipId: boundary.fromClipId,
      toClipId: boundary.toClipId,
      style: boundary.style,
      duration: boundary.duration,
      enabled: true,
    };
    upsertTransition(transition);
    setSelectedTransitionId(transition.id);
    setCurrentTime(boundary.boundaryTime);
  };

  const updateSelectedTransition = (patch: Partial<TimelineTransition>) => {
    if (!selectedTransition) {
      return;
    }
    upsertTransition({...selectedTransition, ...patch});
  };

  const updateEndingScreen = (patch: Partial<EndingScreen>, propsPatch?: Partial<EndingScreen['props']>) => {
    const current = project.endingScreen ?? defaultEndingScreen;
    setEndingScreen({
      ...current,
      ...patch,
      props: {
        ...current.props,
        ...(propsPatch ?? {}),
      },
    });
  };

  const enableEndingScreen = () => {
    updateEndingScreen({enabled: true});
    setCurrentTime(contentEnd);
  };

  const blockStyle = (start: number, end: number, row: number) => ({
    left: `${(start / duration) * 100}%`,
    width: `${Math.max(0.8, ((end - start) / duration) * 100)}%`,
    top: `${rulerHeight + row * (rowHeight + rowGap)}px`,
  });

  const ticks = useMemo(() => {
    const count = 7;
    return Array.from({length: count}, (_item, index) => {
      const time = (duration / (count - 1)) * index;
      return {time, left: `${(time / duration) * 100}%`};
    });
  }, [duration]);

  const gridBackground =
    'linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(180deg, rgba(148,163,184,0.08) 1px, transparent 1px)';

  return (
    <section className="border-t border-slate-800 bg-[#080d14] px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-black uppercase text-slate-100">Composite Timeline</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Each source video has its own channel. Chosen 30-second edit ranges are highlighted; unused ranges stay dimmed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={enableEndingScreen}
            className={`inline-flex items-center gap-1.5 rounded border px-3 py-2 text-[11px] font-black ${
              activeEndingScreen.enabled
                ? 'border-teal-300/50 bg-teal-300 text-slate-950'
                : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Plus size={13} />
            {activeEndingScreen.enabled ? 'Ending' : 'Add ending'}
          </button>
          <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-400">
            <Scissors size={14} />
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <div
        ref={timelineRef}
        onClick={(event) => setCurrentTime(pointerTime(event.clientX))}
        onMouseMove={(event) => moveDragTo(event.clientX)}
        onMouseUp={endDrag}
        className="relative space-y-3"
      >
        <div className="flex rounded border border-slate-800 bg-[#0d141d]">
          <div className={`${leftRail} py-3`}>
            <div className="flex items-center justify-end gap-2 text-[11px] font-black uppercase text-cyan-200">
              <Film size={14} />
              Visual
            </div>
            <div className="mt-1 text-[10px] font-semibold text-slate-500">multi-source</div>
            <div className="mt-3 grid gap-1">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  updateAllSourceAudio({muted: !allSourcesMuted});
                }}
                className={`rounded border px-2 py-1 text-[10px] font-black ${
                  allSourcesMuted
                    ? 'border-amber-300/60 bg-amber-300 text-slate-950'
                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {allSourcesMuted ? 'Source off' : 'Source sound'}
              </button>
            </div>
          </div>
          <div
            className="relative min-w-0 flex-1 overflow-hidden"
            style={{
              height: visualHeight,
              backgroundImage: gridBackground,
              backgroundSize: `${100 / 6}% ${rowHeight + rowGap}px`,
            }}
          >
            <div className="absolute left-0 right-0 top-0 h-[26px] border-b border-slate-800 bg-slate-950/65">
              {ticks.map((tick) => (
                <div key={tick.time} className="absolute top-1 font-mono text-[10px] text-slate-500" style={{left: tick.left}}>
                  {formatTime(tick.time)}
                </div>
              ))}
            </div>
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-40 w-0.5 bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.85)]"
              style={{left: `${(currentTime / duration) * 100}%`}}
            />

            {visualRows.map((row, index) => (
              <div
                key={row.id}
                className="pointer-events-none absolute left-2 z-10 max-w-44 truncate rounded bg-slate-950/80 px-2 py-1 text-[10px] font-black text-slate-300"
                style={{top: `${rulerHeight + index * (rowHeight + rowGap) + 5}px`}}
              >
                <span className="text-cyan-200">{row.label}</span>
                <span className="ml-1 text-slate-500">{row.detail}</span>
              </div>
            ))}

            {visualTracks.map((track) => (
              <div
                key={track.id}
                data-track-id={track.id}
                data-track-kind={track.kind}
                onPointerDown={(event) => {
                  if (track.kind === 'layer' && track.layer) {
                    selectLayer(track.layer.id);
                    startDrag(event, 'layer', track.layer.id, 'move', track.start, track.end);
                  }
                  if (track.kind === 'clip' && track.clipId) {
                    selectClip(track.clipId);
                    setCurrentTime(track.start);
                    startDrag(event, 'clip', track.clipId, 'move', track.start, track.end);
                  }
                }}
                onMouseDown={(event) => {
                  if (track.kind === 'layer' && track.layer) {
                    selectLayer(track.layer.id);
                    startDrag(event, 'layer', track.layer.id, 'move', track.start, track.end);
                  }
                  if (track.kind === 'clip' && track.clipId) {
                    selectClip(track.clipId);
                    setCurrentTime(track.start);
                    startDrag(event, 'clip', track.clipId, 'move', track.start, track.end);
                  }
                }}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onMouseMove={(event) => moveDragTo(event.clientX)}
                onMouseUp={endDrag}
                onClick={(event) => {
                  if (track.kind === 'clip' || track.kind === 'layer') {
                    event.stopPropagation();
                  }
                  if (track.kind === 'clip' && track.clipId) {
                    selectClip(track.clipId);
                    openEditorPanel('clips');
                  }
                }}
                onDoubleClick={(event) => {
                  if (track.kind === 'clip' && track.clipId) {
                    event.stopPropagation();
                    selectClip(track.clipId);
                    openEditorPanel('clips');
                  }
                  if (track.kind === 'layer' && track.layer) {
                    event.stopPropagation();
                    editLayerText(track.layer);
                  }
                }}
                className={`absolute h-[34px] rounded border px-3 py-1.5 text-[11px] font-black ${
                  track.kind === 'layer' && selectedLayerId === track.id
                    ? 'z-50 border-cyan-200 bg-cyan-300 text-slate-950'
                    : track.kind === 'clip' && selectedClipId === track.clipId
                      ? 'z-50 border-white bg-amber-200 text-slate-950 shadow-[0_0_0_2px_rgba(255,255,255,0.45)]'
                      : `${track.color} ${track.textColor} ${
                          track.kind === 'source-idle' ? 'z-0 border-slate-600/35 shadow-none' : 'z-30 border-white/20 shadow-lg'
                        }`
                }`}
                style={blockStyle(track.start, track.end, track.row)}
              >
                {(track.kind === 'layer' || track.kind === 'clip') && (
                  <span
                    data-track-handle="start"
                    onPointerDown={(event) =>
                      startDrag(event, track.kind === 'layer' ? 'layer' : 'clip', track.id, 'start', track.start, track.end)
                    }
                    onMouseDown={(event) =>
                      startDrag(event, track.kind === 'layer' ? 'layer' : 'clip', track.id, 'start', track.start, track.end)
                    }
                    className="absolute left-0 top-0 h-full w-3 cursor-ew-resize rounded-l border-l border-white/45 bg-black/40"
                  />
                )}
                <span className="block truncate pr-8">{track.label}</span>
                {track.kind !== 'source-idle' && (
                  <span className="block truncate text-[9px] font-bold opacity-70">{track.detail}</span>
                )}
                {track.kind === 'layer' && track.layer && (
                  <span
                    data-track-handle="end"
                    onPointerDown={(event) => startDrag(event, 'layer', track.layer!.id, 'end', track.start, track.end)}
                    onMouseDown={(event) => startDrag(event, 'layer', track.layer!.id, 'end', track.start, track.end)}
                    className="absolute right-0 top-0 h-full w-3 cursor-ew-resize rounded-r border-r border-white/45 bg-black/40"
                  />
                )}
                {track.kind === 'clip' && track.clipId && (
                  <>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteClip(track.clipId!);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      className="absolute right-2 top-2 text-slate-950/70"
                      title="Remove clip"
                    >
                      <Trash2 size={13} />
                    </button>
                    <span
                      data-track-handle="end"
                      onPointerDown={(event) => startDrag(event, 'clip', track.clipId!, 'end', track.start, track.end)}
                      onMouseDown={(event) => startDrag(event, 'clip', track.clipId!, 'end', track.start, track.end)}
                      className="absolute right-7 top-0 h-full w-3 cursor-ew-resize border-r border-white/45 bg-black/40"
                    />
                  </>
                )}
              </div>
            ))}

            {transitionBoundaries.map((boundary) => {
              const label = transitionStyleOptions.find((option) => option.id === boundary.style)?.label ?? boundary.style;
              const left = `${(boundary.boundaryTime / duration) * 100}%`;
              return (
                <React.Fragment key={boundary.id}>
                  {boundary.active && (
                    <div
                      className="pointer-events-none absolute bottom-0 top-[26px] z-20 w-px bg-amber-200/55 shadow-[0_0_16px_rgba(251,191,36,0.55)]"
                      style={{left}}
                    />
                  )}
                  <button
                    data-transition-boundary={boundary.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      activateTransition(boundary);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    className={`absolute top-[29px] z-[65] flex h-6 min-w-6 -translate-x-1/2 items-center justify-center rounded border px-1.5 text-[9px] font-black shadow-lg ${
                      selectedTransitionId === boundary.id
                        ? 'border-white bg-white text-slate-950'
                        : boundary.active
                          ? 'border-amber-100 bg-amber-300 text-slate-950'
                          : 'border-slate-600 bg-slate-950 text-slate-300 hover:border-amber-200 hover:text-amber-100'
                    }`}
                    style={{left}}
                    title={boundary.active ? `Edit ${label}` : 'Add transition at this cut'}
                  >
                    {boundary.active ? <Scissors size={12} /> : <Plus size={12} />}
                  </button>
                </React.Fragment>
              );
            })}

            {visualTracks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-600">
                Add a source video, opening, captions, or overlays.
              </div>
            )}
          </div>
        </div>

        <div className="flex rounded border border-rose-900/60 bg-[#120e16]">
          <div className={`${leftRail} py-3`}>
            <div className="flex items-center justify-end gap-2 text-[11px] font-black uppercase text-rose-200">
              <Music2 size={14} />
              Audio
            </div>
            <div className="mt-1 text-[10px] font-semibold text-slate-500">A1 music</div>
            <div className="mt-3 grid gap-1">
              <button
                disabled={project.music.length === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  const firstTrack = project.music[0];
                  if (!firstTrack) {
                    return;
                  }
                  updateAllSourceAudio({muted: true});
                  updateMusicTrack(firstTrack.id, {muted: false});
                  setCurrentTime(firstTrack.start);
                  setPlaying(true);
                }}
                className="rounded border border-rose-200/40 bg-rose-300 px-2 py-1 text-[10px] font-black text-slate-950 disabled:opacity-35"
              >
                Hear music
              </button>
              <button
                disabled={project.music.length === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  project.music.forEach((track) => updateMusicTrack(track.id, {muted: !allMusicMuted}));
                }}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-35"
              >
                {allMusicMuted ? 'Music off' : 'Music on'}
              </button>
            </div>
          </div>
          <div
            className="relative min-w-0 flex-1 overflow-hidden"
            style={{
              height: audioHeight,
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(251,113,133,0.14) 0 2px, transparent 2px 10px), linear-gradient(180deg, rgba(251,113,133,0.08) 1px, transparent 1px)',
              backgroundSize: `auto ${rowHeight + rowGap}px`,
            }}
          >
            <div className="absolute left-0 right-0 top-0 h-[26px] border-b border-rose-900/50 bg-slate-950/65">
              {ticks.map((tick) => (
                <div key={tick.time} className="absolute top-1 font-mono text-[10px] text-rose-200/60" style={{left: tick.left}}>
                  {formatTime(tick.time)}
                </div>
              ))}
            </div>
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-40 w-0.5 bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.85)]"
              style={{left: `${(currentTime / duration) * 100}%`}}
            />

            {project.music.length === 0 && (
              <div className="absolute inset-x-0 top-[34px] flex h-[34px] items-center justify-center rounded text-xs font-bold text-rose-200/45">
                Add music from the Music panel. It will stay separate from visual tracks.
              </div>
            )}

            {project.music.map((track, index) => (
              <div
                key={track.id}
                data-track-id={track.id}
                data-track-kind="music"
                onPointerDown={(event) => startDrag(event, 'music', track.id, 'move', track.start, track.end)}
                onMouseDown={(event) => startDrag(event, 'music', track.id, 'move', track.start, track.end)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onMouseMove={(event) => moveDragTo(event.clientX)}
                onMouseUp={endDrag}
                onClick={(event) => {
                  event.stopPropagation();
                  openEditorPanel('music');
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  openEditorPanel('music');
                }}
                className="absolute h-[34px] rounded border border-rose-100/20 bg-rose-400 px-3 py-1.5 text-[11px] font-black text-slate-950 shadow-lg"
                style={blockStyle(track.start, track.end, index)}
              >
                <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-70" viewBox="0 0 100 34" preserveAspectRatio="none">
                  <polyline
                    points={miniAutomationPolyline(track)}
                    fill="none"
                    stroke="#1d4ed8"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span
                  data-track-handle="start"
                  onPointerDown={(event) => startDrag(event, 'music', track.id, 'start', track.start, track.end)}
                  onMouseDown={(event) => startDrag(event, 'music', track.id, 'start', track.start, track.end)}
                  className="absolute left-0 top-0 z-20 h-full w-3 cursor-ew-resize rounded-l border-l border-white/45 bg-black/40"
                />
                <span className="relative z-10 block truncate pr-8">{track.name}</span>
                <span className="relative z-10 block text-[9px] font-bold opacity-70">
                  {track.volumeAutomation?.enabled
                    ? `${Math.round((track.volumeAutomation.focusVolume ?? 1) * 100)}% / ${Math.round(
                        (track.volumeAutomation.backgroundVolume ?? track.volume) * 100,
                      )}% speech`
                    : `flat ${Math.round(track.volume * 100)}%`}
                </span>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    removeMusicTrack(track.id);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="absolute right-2 top-2 z-20 text-slate-950/70"
                  title="Remove music"
                >
                  <Trash2 size={13} />
                </button>
                <span
                  data-track-handle="end"
                  onPointerDown={(event) => startDrag(event, 'music', track.id, 'end', track.start, track.end)}
                  onMouseDown={(event) => startDrag(event, 'music', track.id, 'end', track.start, track.end)}
                  className="absolute right-7 top-0 z-20 h-full w-3 cursor-ew-resize border-r border-white/45 bg-black/40"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedTransition && (
        <div className="mt-3 rounded border border-amber-300/35 bg-amber-300/10 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase text-amber-100">
              <Scissors size={14} />
              Transition at cut
            </div>
            <button
              onClick={() => {
                removeTransition(selectedTransition.id);
                setSelectedTransitionId(null);
              }}
              className="inline-flex items-center gap-1 rounded border border-amber-200/35 px-2 py-1 text-[10px] font-bold text-amber-100 hover:bg-amber-200/10"
            >
              <Trash2 size={12} />
              Remove
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
              Style
              <select
                value={selectedTransition.style}
                onChange={(event) => updateSelectedTransition({style: event.currentTarget.value as TransitionStyle})}
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold normal-case text-slate-100 outline-none focus:border-amber-200"
              >
                {transitionStyleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
              Duration
              <input
                type="number"
                min={0.05}
                max={2}
                step={0.05}
                value={selectedTransition.duration}
                onChange={(event) =>
                  updateSelectedTransition({duration: clamp(Number(event.currentTarget.value), 0.05, 2)})
                }
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold normal-case text-slate-100 outline-none focus:border-amber-200"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-slate-500">
            Preview applies the effect after the outgoing speech boundary, so it does not fade over the last spoken word.
          </p>
        </div>
      )}

      {activeEndingScreen.enabled && (
        <div className="mt-3 rounded border border-teal-300/35 bg-teal-300/10 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase text-teal-100">
              <Sparkles size={14} />
              Ending screen
            </div>
            <button
              onClick={() => updateEndingScreen({enabled: false})}
              className="rounded border border-teal-200/35 px-2 py-1 text-[10px] font-bold text-teal-100 hover:bg-teal-200/10"
            >
              Disable
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
              Template
              <select
                value={activeEndingScreen.templateId}
                onChange={(event) => updateEndingScreen({templateId: event.currentTarget.value as EndingTemplateId})}
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold normal-case text-slate-100 outline-none focus:border-teal-200"
              >
                {endingTemplateOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
              Seconds
              <input
                type="number"
                min={1}
                max={12}
                step={0.25}
                value={activeEndingScreen.duration}
                onChange={(event) => updateEndingScreen({duration: clamp(Number(event.currentTarget.value), 1, 12)})}
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold normal-case text-slate-100 outline-none focus:border-teal-200"
              />
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              value={activeEndingScreen.props.title}
              onChange={(event) => updateEndingScreen({}, {title: event.currentTarget.value})}
              className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-100 outline-none focus:border-teal-200"
              placeholder="Ending title"
            />
            <input
              value={activeEndingScreen.props.subtitle}
              onChange={(event) => updateEndingScreen({}, {subtitle: event.currentTarget.value})}
              className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-100 outline-none focus:border-teal-200"
              placeholder="Ending subtitle"
            />
          </div>
          <textarea
            value={activeEndingScreen.props.credits}
            onChange={(event) => updateEndingScreen({}, {credits: event.currentTarget.value})}
            className="mt-3 min-h-14 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-teal-200"
            placeholder="Credits, attribution, or next steps"
          />
        </div>
      )}

      {selectedLayer && (
        <div className="mt-3 rounded border border-slate-800 bg-slate-950/65 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[11px] font-black uppercase text-slate-400">
              {selectedLayer.type === 'caption' ? 'Caption text' : 'Layer text'}
            </div>
            <div className="font-mono text-[10px] text-slate-600">
              {formatTime(selectedLayer.start)} - {formatTime(selectedLayer.end)}
            </div>
          </div>
          <textarea
            ref={selectedEditorRef}
            value={selectedLayer.text}
            onChange={(event) => updateLayer(selectedLayer.id, {text: event.currentTarget.value})}
            className="min-h-16 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-300"
          />
          <div className="mt-2 flex gap-2">
          <button
            onClick={() => duplicateLayer(selectedLayer.id)}
            className="inline-flex items-center gap-2 rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
          >
            <Copy size={14} />
            Duplicate selected
          </button>
          <button
            onClick={() => deleteLayer(selectedLayer.id)}
            className="inline-flex items-center gap-2 rounded border border-rose-500/60 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/10"
          >
            <Trash2 size={14} />
            Delete selected
          </button>
          </div>
        </div>
      )}
    </section>
  );
};
