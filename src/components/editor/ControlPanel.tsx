'use client';

import Image from 'next/image';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Player} from '@remotion/player';
import {
  ArrowRight,
  BookOpen,
  Captions,
  ChevronDown,
  ChevronUp,
  Copy,
  FileJson,
  FolderOpen,
  Layers,
  Loader2,
  Music,
  Save,
  Scissors,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {OpeningTemplateComposition, openingTemplateOptions} from '@/components/remotion/OpeningTemplates';
import {musicBriefGuides, musicSourceCards, sourceName} from '@/lib/music/catalog';
import {
  createSpeechAwareMusicAutomation,
  formatTime,
  getClipDuration,
  getClipTimelineWindows,
  getSpeechActivityWindows,
  getVisualTimelineDuration,
  resolveSourceTime,
  sortedVolumePoints,
} from '@/lib/timeline';
import {createEmptyProject, useEditorStore} from '@/store/editorStore';
import type {
  Clip,
  ClipCandidate,
  ClipCandidateVersion,
  MusicManifestItem,
  MusicTrack,
  MusicVolumeAutomation,
  MusicVolumeMode,
  MusicVolumePoint,
  TimelineLayer,
  TimelineProject,
  TranscriptResult,
  TranscriptThought,
} from '@/types/timeline';

type VideoAsset = {
  name: string;
  src: string;
  kind: string;
  duration?: number;
};

const tabButton = (active: boolean) =>
  `rounded px-3 py-2 text-xs font-black uppercase tracking-normal ${
    active ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
  }`;

const FieldLabel: React.FC<{children: React.ReactNode}> = ({children}) => (
  <label className="mb-1 block text-[11px] font-black uppercase text-slate-500">{children}</label>
);

const NumberField: React.FC<{
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}> = ({label, value, step = 0.1, min, max, onChange}) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
    />
  </div>
);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const minClipDuration = 0.25;

const flatAutomation = (track: MusicTrack): MusicVolumeAutomation => {
  const duration = Math.max(0.05, track.end - track.start);
  return {
    enabled: true,
    focusVolume: Math.max(track.volume, 0.8),
    backgroundVolume: track.volume,
    rampDuration: 0.35,
    mode: 'smooth-gaps',
    liftGapThreshold: 1.15,
    points: [
      {id: 'vol_01', time: 0, volume: track.volume},
      {id: 'vol_02', time: duration, volume: track.volume},
    ],
  };
};

const automationModeOptions: Array<{id: MusicVolumeMode; label: string; hint: string}> = [
  {id: 'smooth-gaps', label: 'Smooth gaps', hint: 'Long pauses rise; short pauses stay low.'},
  {id: 'template-gaps', label: 'Templates only', hint: 'Raise mainly on opener, transitions, and ending.'},
  {id: 'flat-speech-bed', label: 'Hold low', hint: 'Keep music steady under the whole spoken edit.'},
];

const VolumeSlider: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
}> = ({label, value, onChange}) => (
  <div>
    <div className="mb-1 flex justify-between text-xs font-bold text-slate-400">
      <span>{label}</span>
      <span>{Math.round(clamp(value, 0, 1) * 100)}%</span>
    </div>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={clamp(value, 0, 1)}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      className="w-full"
    />
  </div>
);

const MusicVolumeGraph: React.FC<{
  project: TimelineProject;
  track: MusicTrack;
  onChange: (patch: Partial<MusicTrack>) => void;
}> = ({project, track, onChange}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const projectRef = useRef(project);
  const [dragPointId, setDragPointId] = useState<string | null>(null);
  const [waveformSamples, setWaveformSamples] = useState<number[] | null>(null);
  const trackDuration = Math.max(0.05, track.end - track.start);
  const automation = track.volumeAutomation ?? flatAutomation(track);
  const mode = automation.mode ?? 'smooth-gaps';
  const liftGapThreshold = automation.liftGapThreshold ?? 1.15;
  const points = sortedVolumePoints(automation.points.length > 0 ? automation.points : flatAutomation(track).points);
  const width = 360;
  const height = 156;
  const padLeft = 34;
  const padRight = 18;
  const padTop = 14;
  const padBottom = 28;
  const graphWidth = width - padLeft - padRight;
  const graphHeight = height - padTop - padBottom;

  const xForTime = (time: number) => padLeft + (clamp(time, 0, trackDuration) / trackDuration) * graphWidth;
  const yForVolume = (volume: number) => padTop + (1 - clamp(volume, 0, 1)) * graphHeight;
  const timeForX = (x: number) => clamp(((x - padLeft) / graphWidth) * trackDuration, 0, trackDuration);
  const volumeForY = (y: number) => clamp(1 - (y - padTop) / graphHeight, 0, 1);
  const polyline = points.map((point) => `${xForTime(point.time)},${yForVolume(point.volume)}`).join(' ');

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const speechWindows = useMemo(() => {
    return getSpeechActivityWindows(project)
      .map((window) => ({
        start: clamp(window.start - track.start, 0, trackDuration),
        end: clamp(window.end - track.start, 0, trackDuration),
      }))
      .filter((window) => window.end - window.start > 0.01);
  }, [project, track.start, trackDuration]);

  const speechMarkers = speechWindows.flatMap((window) => [window.start, window.end]);

  const waveformProjectKey = useMemo(
    () =>
      JSON.stringify({
        sourceVideo: project.sourceVideo?.src,
        sourceVideos: project.sourceVideos?.map((source) => source.src),
        opening: project.openingScreen.enabled ? project.openingScreen.duration : 0,
        clips: project.clips.map((clip) => ({
          id: clip.id,
          sourceSrc: clip.sourceSrc,
          safeStart: clip.safeStart,
          safeEnd: clip.safeEnd,
          timelineStart: clip.timelineStart,
        })),
      }),
    [project],
  );

  useEffect(() => {
    const controller = new AbortController();
    setWaveformSamples(null);
    fetch('/api/audio/waveform', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        project: projectRef.current,
        start: track.start,
        end: track.end,
        samples: 88,
      }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: {samples?: number[]} | null) => {
        if (!controller.signal.aborted && Array.isArray(data?.samples)) {
          setWaveformSamples(data.samples.map((sample) => clamp(Number(sample) || 0, 0, 1)));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setWaveformSamples(null);
        }
      });

    return () => controller.abort();
  }, [track.end, track.start, waveformProjectKey]);

  const waveformBars = useMemo(() => {
    const count = waveformSamples?.length ?? 88;
    return Array.from({length: count}, (_, index) => {
      const start = (index / count) * trackDuration;
      const end = ((index + 1) / count) * trackDuration;
      const center = (start + end) / 2;
      const active = speechWindows.some((window) => center >= window.start && center <= window.end);
      const wave = Math.sin(index * 1.91) * 0.5 + Math.sin(index * 0.47) * 0.28 + 0.5;
      const amplitude = waveformSamples
        ? clamp(0.04 + (waveformSamples[index] ?? 0) * 0.82, 0.03, 0.88)
        : active
          ? clamp(0.22 + Math.abs(wave) * 0.56, 0.18, 0.82)
          : clamp(0.04 + Math.abs(wave) * 0.09, 0.03, 0.16);
      return {
        x: padLeft + (start / trackDuration) * graphWidth,
        width: Math.max(1.2, (graphWidth / count) * 0.62),
        height: amplitude * graphHeight * 0.46,
        active,
      };
    });
  }, [speechWindows, trackDuration, graphWidth, graphHeight, waveformSamples]);

  const setAutomation = (nextAutomation: MusicVolumeAutomation) =>
    onChange({
      volumeAutomation: {
        ...nextAutomation,
        points: sortedVolumePoints(nextAutomation.points).map((point, index) => ({
          ...point,
          id: point.id || `vol_${index + 1}`,
          time: clamp(point.time, 0, trackDuration),
        })),
      },
    });

  const applySpeechGraph = (patch?: Partial<Pick<MusicVolumeAutomation, 'focusVolume' | 'backgroundVolume' | 'rampDuration'>>) => {
    const next = createSpeechAwareMusicAutomation(project, track, {
      focusVolume: patch?.focusVolume ?? automation.focusVolume,
      backgroundVolume: patch?.backgroundVolume ?? automation.backgroundVolume,
      rampDuration: patch?.rampDuration ?? automation.rampDuration,
      mode,
      liftGapThreshold,
    });
    setAutomation(next);
  };

  const applyMode = (nextMode: MusicVolumeMode) => {
    const next = createSpeechAwareMusicAutomation(project, track, {
      focusVolume: automation.focusVolume,
      backgroundVolume: automation.backgroundVolume,
      rampDuration: automation.rampDuration,
      mode: nextMode,
      liftGapThreshold,
    });
    setAutomation(next);
  };

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    return {time: timeForX(x), volume: volumeForY(y)};
  };

  const updatePoint = (pointId: string, next: Pick<MusicVolumePoint, 'time' | 'volume'>) => {
    setAutomation({
      ...automation,
      enabled: true,
      points: points.map((point) =>
        point.id === pointId
          ? {
              ...point,
              time: clamp(next.time, 0, trackDuration),
              volume: clamp(next.volume, 0, 1),
            }
          : point,
      ),
    });
  };

  return (
    <div className="mt-3 rounded border border-slate-800 bg-[#070b12] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-black uppercase text-rose-100">Music volume graph</div>
          <div className="text-[10px] font-bold text-slate-500">
            Blue line is music level; cyan bars show {waveformSamples ? 'local FFmpeg source waveform' : 'detected speech activity'}.
          </div>
        </div>
        <div className="rounded bg-slate-900 px-2 py-1 text-[10px] font-black uppercase text-cyan-100">Auto</div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {automationModeOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => applyMode(option.id)}
            title={option.hint}
            className={`rounded border px-2 py-2 text-[10px] font-black uppercase ${
              mode === option.id
                ? 'border-cyan-300 bg-cyan-300 text-slate-950'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full cursor-default rounded bg-[linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(180deg,rgba(148,163,184,0.08)_1px,transparent_1px)]"
        onPointerMove={(event) => {
          if (!dragPointId) {
            return;
          }
          const next = pointFromEvent(event);
          if (next) {
            updatePoint(dragPointId, next);
          }
        }}
        onPointerUp={() => setDragPointId(null)}
        onPointerLeave={() => setDragPointId(null)}
      >
        <defs>
          <marker id="axis-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="5" refY="3.5">
            <path d="M0,0 L0,7 L6,3.5 z" fill="#cbd5e1" />
          </marker>
        </defs>

        {speechWindows.map((window, index) => (
          <rect
            key={`${window.start}-${window.end}-${index}`}
            x={xForTime(window.start)}
            y={padTop}
            width={Math.max(1, xForTime(window.end) - xForTime(window.start))}
            height={graphHeight}
            fill="#22d3ee"
            opacity="0.07"
          />
        ))}

        {[0.25, 0.5, 0.75, 1].map((volume) => (
          <line key={volume} x1={padLeft} x2={width - padRight} y1={yForVolume(volume)} y2={yForVolume(volume)} stroke="#1e293b" strokeWidth="1" />
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const x = padLeft + graphWidth * ratio;
          return <line key={ratio} x1={x} x2={x} y1={padTop} y2={height - padBottom} stroke="#1e293b" strokeWidth="1" />;
        })}
        {speechMarkers.map((time, index) => (
          <line
            key={`${time}-${index}`}
            x1={xForTime(time)}
            x2={xForTime(time)}
            y1={padTop}
            y2={height - padBottom}
            stroke="#f8fafc"
            strokeDasharray="5 5"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
        ))}

        {waveformBars.map((bar, index) => {
          const y = height - padBottom - bar.height;
          return (
            <rect
              key={index}
              x={bar.x}
              y={y}
              width={bar.width}
              height={bar.height}
              rx="1"
              fill={bar.active ? '#67e8f9' : '#64748b'}
              opacity={bar.active ? '0.34' : '0.16'}
            />
          );
        })}

        <line x1={padLeft} x2={padLeft} y1={height - padBottom} y2={padTop - 6} stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#axis-arrow)" />
        <line x1={padLeft} x2={width - padRight + 8} y1={height - padBottom} y2={height - padBottom} stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#axis-arrow)" />
        <text x={2} y={padTop + 5} fill="#94a3b8" fontSize="9" fontWeight="800">
          Vol
        </text>
        <text x={width - 48} y={height - 7} fill="#94a3b8" fontSize="9" fontWeight="800">
          Time
        </text>
        <text x={padLeft - 24} y={yForVolume(1) + 3} fill="#94a3b8" fontSize="9">
          100
        </text>
        <text x={padLeft - 18} y={yForVolume(0.5) + 3} fill="#94a3b8" fontSize="9">
          50
        </text>
        <text x={padLeft - 12} y={height - padBottom + 12} fill="#94a3b8" fontSize="9">
          0
        </text>

        <polyline points={polyline} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point) => (
          <circle
            key={point.id}
            cx={xForTime(point.time)}
            cy={yForVolume(point.volume)}
            r="5.5"
            fill="#dbeafe"
            stroke="#1d4ed8"
            strokeWidth="2"
            onPointerDown={(event) => {
              event.stopPropagation();
              setDragPointId(point.id);
            }}
            onClick={(event) => event.stopPropagation()}
            className="cursor-grab"
          />
        ))}
      </svg>

      <div className="mt-3 space-y-3">
        <VolumeSlider label="No speech music" value={automation.focusVolume} onChange={(focusVolume) => applySpeechGraph({focusVolume})} />
        <VolumeSlider label="Under speech" value={automation.backgroundVolume} onChange={(backgroundVolume) => applySpeechGraph({backgroundVolume})} />
        <NumberField
          label="Ramp seconds"
          value={automation.rampDuration}
          min={0.05}
          max={2}
          step={0.05}
          onChange={(rampDuration) => applySpeechGraph({rampDuration: clamp(rampDuration, 0.05, 2)})}
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => applySpeechGraph()}
          className="rounded bg-blue-500 px-3 py-2 text-xs font-black text-white hover:bg-blue-400"
        >
          Auto speech graph
        </button>
      </div>
      <div className="mt-2 font-mono text-[10px] text-slate-500">
        {points.length} draggable nodes · {formatTime(track.start)}-{formatTime(track.end)}
      </div>
    </div>
  );
};

const SourcePanel: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const setSourceVideo = useEditorStore((state) => state.setSourceVideo);
  const patchProject = useEditorStore((state) => state.patchProject);
  const setProject = useEditorStore((state) => state.setProject);
  const setTranscript = useEditorStore((state) => state.setTranscript);
  const setThoughts = useEditorStore((state) => state.setThoughts);
  const updateAllSourceAudio = useEditorStore((state) => state.updateAllSourceAudio);
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [demoAvailable, setDemoAvailable] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const refresh = async () => {
    const response = await fetch('/api/uploads');
    const data = (await response.json()) as {videos: VideoAsset[]};
    setVideos(data.videos);
  };

  useEffect(() => {
    void refresh();
    void fetch('/api/projects/home-run-seed?check=1')
      .then((response) => response.json())
      .then((data: {available?: boolean}) => setDemoAvailable(Boolean(data.available)))
      .catch(() => setDemoAvailable(false));
  }, []);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/uploads', {method: 'POST', body: formData});
      const data = (await response.json()) as {video: VideoAsset; error?: string};
      if (!response.ok) {
        throw new Error(data.error ?? 'Upload failed');
      }
      setSourceVideo({
        src: data.video.src,
        duration: data.video.duration ?? 0,
        volume: 1,
        muted: false,
      });
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const loadLocalDemo = async () => {
    setDemoLoading(true);
    try {
      const response = await fetch('/api/projects/home-run-seed');
      const data = (await response.json()) as {
        project?: TimelineProject;
        transcript?: TranscriptResult;
        thoughts?: TranscriptThought[];
        error?: string;
      };
      if (!response.ok || !data.project) {
        throw new Error(data.error ?? 'Local demo is unavailable');
      }
      setProject(data.project);
      setTranscript(data.transcript ?? null);
      setThoughts(data.thoughts ?? []);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {demoAvailable && (
        <div className="rounded border border-amber-400/35 bg-amber-300/10 p-3">
          <div className="text-xs font-black uppercase text-amber-200">Local demo</div>
          <button
            onClick={loadLocalDemo}
            disabled={demoLoading}
            className="mt-2 w-full rounded bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
          >
            {demoLoading ? 'Loading demo...' : 'Load Home Run 30s edit'}
          </button>
        </div>
      )}

      <div className="rounded border border-slate-800 bg-slate-950/55 p-3">
        <FieldLabel>Upload source video</FieldLabel>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-slate-600 px-3 py-4 text-sm font-bold text-slate-300 hover:border-cyan-400 hover:text-cyan-200">
          {uploading ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />}
          <span>{uploading ? 'Uploading...' : 'Choose video file'}</span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                void upload(file);
              }
            }}
          />
        </label>
      </div>

      <div>
        <FieldLabel>Local videos</FieldLabel>
        <div className="max-h-48 space-y-2 overflow-auto pr-1">
          {videos.map((video) => (
            <button
              key={video.src}
              onClick={() =>
                setSourceVideo({
                  src: video.src,
                  duration: video.duration ?? 0,
                  volume: project.sourceVideo?.volume ?? 1,
                  muted: project.sourceVideo?.muted ?? false,
                })
              }
              className={`w-full rounded border px-3 py-2 text-left text-xs font-bold ${
                project.sourceVideo?.src === video.src
                  ? 'border-cyan-400 bg-cyan-400/10 text-cyan-100'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="truncate">{video.name}</div>
              <div className="mt-1 text-[10px] uppercase text-slate-500">{video.kind}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded border border-slate-800 bg-slate-950/55 p-3">
        <FieldLabel>Source audio</FieldLabel>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm font-bold text-slate-300">
            <span>Mute all source videos</span>
            <input
              type="checkbox"
              checked={project.sourceVideos?.length ? project.sourceVideos.every((source) => source.muted) : project.sourceVideo?.muted ?? false}
              disabled={!project.sourceVideo}
              onChange={(event) => updateAllSourceAudio({muted: event.currentTarget.checked})}
            />
          </label>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>All source volume</span>
              <span>{Math.round((project.sourceVideo?.volume ?? 0) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={project.sourceVideo?.volume ?? 0}
              disabled={!project.sourceVideo}
              onChange={(event) => updateAllSourceAudio({volume: Number(event.currentTarget.value)})}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => patchProject({clips: []})}
        className="w-full rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
      >
        Use full source video
      </button>
    </div>
  );
};

const ClipsPanel: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const currentTime = useEditorStore((state) => state.currentTime);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const addClip = useEditorStore((state) => state.addClip);
  const updateClip = useEditorStore((state) => state.updateClip);
  const deleteClip = useEditorStore((state) => state.deleteClip);
  const reorderClip = useEditorStore((state) => state.reorderClip);
  const splitClip = useEditorStore((state) => state.splitClip);
  const selectClip = useEditorStore((state) => state.selectClip);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(6);

  const source = project.sourceVideo;
  const sourceDuration = source?.duration ?? 0;
  const sourceName = source?.name ?? source?.src.split('/').at(-1) ?? 'source';
  const resolvedPlayhead = resolveSourceTime(project, currentTime);
  const playheadSourceTime = resolvedPlayhead.mode === 'opening' ? 0 : resolvedPlayhead.sourceTime;
  const selectedClip = project.clips.find((clip) => clip.id === selectedClipId) ?? null;
  const selectedClipWindow = selectedClip ? getClipTimelineWindows(project).find(({clip}) => clip.id === selectedClip.id) : null;
  const splitSourceTime =
    selectedClip && selectedClipWindow && currentTime >= selectedClipWindow.start && currentTime <= selectedClipWindow.end
      ? selectedClip.safeStart + (currentTime - selectedClipWindow.start)
      : selectedClip
        ? (selectedClip.safeStart + selectedClip.safeEnd) / 2
        : 0;

  const addKeptRange = () => {
    if (!source) {
      return;
    }
    const start = clamp(rangeStart, 0, Math.max(0, source.duration - minClipDuration));
    const end = clamp(rangeEnd, start + minClipDuration, source.duration || start + minClipDuration);
    const clip: Clip = {
      id: `clip_${crypto.randomUUID().slice(0, 8)}`,
      sourceSrc: source.src,
      sourceName,
      rawStart: start,
      rawEnd: end,
      safeStart: start,
      safeEnd: end,
      timelineStart: getVisualTimelineDuration(project),
      boundaryMode: 'raw',
      volume: 1,
      fadeIn: 0.08,
      fadeOut: 0.08,
    };
    addClip(clip);
    selectClip(clip.id);
  };

  const rows = useMemo(
    () =>
      getClipTimelineWindows(project).map(({clip, index, start, end}) => ({
        clip,
        index,
        duration: getClipDuration(clip),
        outputStart: start,
        outputEnd: end,
      })),
    [project],
  );

  return (
    <div className="space-y-4">
      {selectedClip && (
        <div className="rounded border border-amber-200/50 bg-amber-300/10 p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-amber-100">Selected video clip audio</div>
              <div className="mt-1 font-mono text-[10px] text-slate-500">
                {selectedClip.sourceName ?? sourceName} · output{' '}
                {selectedClipWindow ? `${formatTime(selectedClipWindow.start)}-${formatTime(selectedClipWindow.end)}` : 'not on timeline'}
              </div>
            </div>
            <button
              onClick={() => updateClip(selectedClip.id, {volume: 1})}
              className="rounded border border-slate-700 px-2 py-1 text-[10px] font-black uppercase text-slate-300 hover:bg-slate-800"
            >
              Reset 100%
            </button>
          </div>
          <label className="flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
            <span>Mute this clip</span>
            <input
              type="checkbox"
              checked={selectedClip.volume <= 0}
              onChange={(event) => updateClip(selectedClip.id, {volume: event.currentTarget.checked ? 0 : 1})}
            />
          </label>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Clip volume</span>
              <span>{Math.round(selectedClip.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedClip.volume}
              onChange={(event) => updateClip(selectedClip.id, {volume: Number(event.currentTarget.value)})}
              className="w-full"
            />
          </div>
          <div className="mt-3 rounded border border-amber-200/25 bg-slate-950/55 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-black uppercase text-amber-100">Split selected clip</div>
                <div className="mt-1 font-mono text-[10px] text-slate-500">
                  split source at {formatTime(splitSourceTime)}
                  {selectedClipWindow && currentTime >= selectedClipWindow.start && currentTime <= selectedClipWindow.end
                    ? ' from playhead'
                    : ' midpoint'}
                </div>
              </div>
              <button
                disabled={selectedClip.safeEnd - selectedClip.safeStart < 0.5}
                onClick={() => splitClip(selectedClip.id, splitSourceTime)}
                className="inline-flex items-center gap-1.5 rounded bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
              >
                <Scissors size={14} />
                Split
              </button>
            </div>
            <div className="text-[11px] leading-5 text-slate-500">
              This creates another kept range from the same source file. Unused timestamps stay hidden; no video file is cut during preview.
            </div>
          </div>
        </div>
      )}

      <div className="rounded border border-slate-800 bg-slate-950/55 p-3">
        <div className="mb-2 text-sm font-black text-slate-100">Add kept range</div>
        <div className="mb-3 text-xs leading-5 text-slate-500">
          These ranges are the only source sections that play when clips exist. Everything else stays dimmed in the timeline.
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Source start" value={rangeStart} min={0} step={0.05} onChange={setRangeStart} />
          <NumberField label="Source end" value={rangeEnd} min={0.25} step={0.05} onChange={setRangeEnd} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            disabled={!source}
            onClick={() => setRangeStart(Number(playheadSourceTime.toFixed(2)))}
            className="rounded bg-slate-800 px-3 py-2 text-xs font-black text-slate-100 disabled:opacity-40"
          >
            Start at playhead
          </button>
          <button
            disabled={!source}
            onClick={() => setRangeEnd(Number(playheadSourceTime.toFixed(2)))}
            className="rounded bg-slate-800 px-3 py-2 text-xs font-black text-slate-100 disabled:opacity-40"
          >
            End at playhead
          </button>
        </div>
        <button
          disabled={!source}
          onClick={addKeptRange}
          className="mt-3 w-full rounded bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
        >
          Add kept range
        </button>
      </div>

      <div className="rounded border border-slate-800 bg-slate-950/55 p-3">
        <div className="mb-1 text-sm font-black text-slate-100">Clip order</div>
        <div className="mb-3 text-xs text-slate-500">
          Render/export will concatenate this list from top to bottom. Clip volume of 0% means muted source audio for that clip.
        </div>

        {rows.length === 0 ? (
          <div className="rounded border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-500">
            No kept ranges yet. The preview will play the full selected source video until you add clips.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(({clip, index, duration, outputStart, outputEnd}) => {
              const clipSourceDuration = sourceDuration || Math.max(clip.safeEnd, clip.rawEnd);
              const muted = clip.volume <= 0;

              return (
                <div
                  key={clip.id}
                  onClick={() => selectClip(clip.id)}
                  className={`rounded border p-3 ${
                    selectedClipId === clip.id ? 'border-amber-200 bg-amber-300/10' : 'border-slate-800 bg-slate-900'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-100">
                        Clip {index + 1} · {clip.sourceName ?? sourceName}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-slate-500">
                        output {formatTime(outputStart)}-{formatTime(outputEnd)} · source {formatTime(clip.safeStart)}-
                        {formatTime(clip.safeEnd)} · {formatTime(duration)}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        disabled={index === 0}
                        onClick={() => reorderClip(clip.id, index - 1)}
                        className="rounded bg-slate-800 p-1.5 text-slate-200 disabled:opacity-30"
                        title="Move clip earlier"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        disabled={index === rows.length - 1}
                        onClick={() => reorderClip(clip.id, index + 1)}
                        className="rounded bg-slate-800 p-1.5 text-slate-200 disabled:opacity-30"
                        title="Move clip later"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        onClick={() => addClip({...clip, id: `clip_${crypto.randomUUID().slice(0, 8)}`})}
                        className="rounded bg-slate-800 p-1.5 text-slate-200"
                        title="Duplicate clip"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => splitClip(clip.id, (clip.safeStart + clip.safeEnd) / 2)}
                        className="rounded bg-slate-800 p-1.5 text-slate-200"
                        title="Split clip in half"
                      >
                        <Scissors size={14} />
                      </button>
                      <button
                        onClick={() => deleteClip(clip.id)}
                        className="rounded bg-rose-500/15 p-1.5 text-rose-200"
                        title="Delete clip"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label="Source start"
                      value={clip.safeStart}
                      min={0}
                      max={clip.safeEnd - minClipDuration}
                      step={0.05}
                      onChange={(safeStart) =>
                        updateClip(clip.id, {
                          safeStart: clamp(safeStart, 0, clip.safeEnd - minClipDuration),
                        })
                      }
                    />
                    <NumberField
                      label="Source end"
                      value={clip.safeEnd}
                      min={clip.safeStart + minClipDuration}
                      max={clipSourceDuration}
                      step={0.05}
                      onChange={(safeEnd) =>
                        updateClip(clip.id, {
                          safeEnd: clamp(safeEnd, clip.safeStart + minClipDuration, clipSourceDuration),
                        })
                      }
                    />
                    <NumberField
                      label="Fade in"
                      value={clip.fadeIn}
                      min={0}
                      step={0.05}
                      onChange={(fadeIn) => updateClip(clip.id, {fadeIn: Math.max(0, fadeIn)})}
                    />
                    <NumberField
                      label="Fade out"
                      value={clip.fadeOut}
                      min={0}
                      step={0.05}
                      onChange={(fadeOut) => updateClip(clip.id, {fadeOut: Math.max(0, fadeOut)})}
                    />
                  </div>

                  <label className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
                    <span>Mute clip source audio</span>
                    <input
                      type="checkbox"
                      checked={muted}
                      onChange={(event) => updateClip(clip.id, {volume: event.currentTarget.checked ? 0 : 1})}
                    />
                  </label>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>Clip volume</span>
                      <span>{Math.round(clip.volume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={clip.volume}
                      onChange={(event) => updateClip(clip.id, {volume: Number(event.currentTarget.value)})}
                      className="w-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const OpeningPanel: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const setOpeningScreen = useEditorStore((state) => state.setOpeningScreen);
  const opening = project.openingScreen;

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/55 p-3 text-sm font-bold text-slate-200">
        <span>Insert opening before source video</span>
        <input
          type="checkbox"
          checked={opening.enabled}
          onChange={(event) => setOpeningScreen({...opening, enabled: event.currentTarget.checked})}
        />
      </label>

      <div className="aspect-[9/16] max-h-64 overflow-hidden rounded border border-slate-700 bg-black">
        <Player
          acknowledgeRemotionLicense
          component={OpeningTemplateComposition}
          durationInFrames={Math.max(1, Math.round(opening.duration * 30))}
          fps={30}
          compositionWidth={1080}
          compositionHeight={1920}
          loop
          controls
          inputProps={{
            templateId: opening.templateId,
            title: opening.props.title,
            subtitle: opening.props.subtitle,
            mood: opening.props.mood,
            background: opening.props.background,
          }}
          style={{width: '100%', height: '100%'}}
        />
      </div>

      <div className="grid grid-cols-1 gap-2">
        {openingTemplateOptions.map((template) => (
          <button
            key={template.id}
            onClick={() => setOpeningScreen({...opening, templateId: template.id})}
            className={`rounded border p-3 text-left ${
              opening.templateId === template.id
                ? 'border-cyan-400 bg-cyan-400/10'
                : 'border-slate-800 bg-slate-900 hover:bg-slate-800'
            }`}
          >
            <div className="text-sm font-black text-slate-100">{template.name}</div>
            <div className="mt-1 text-xs text-slate-500">{template.description}</div>
          </button>
        ))}
      </div>

      <div>
        <FieldLabel>Title</FieldLabel>
        <input
          value={opening.props.title}
          onChange={(event) =>
            setOpeningScreen({...opening, props: {...opening.props, title: event.currentTarget.value}})
          }
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
      </div>
      <div>
        <FieldLabel>Subtitle</FieldLabel>
        <input
          value={opening.props.subtitle}
          onChange={(event) =>
            setOpeningScreen({...opening, props: {...opening.props, subtitle: event.currentTarget.value}})
          }
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
      </div>
      <NumberField
        label="Duration seconds"
        value={opening.duration}
        min={1}
        step={0.25}
        onChange={(duration) => setOpeningScreen({...opening, duration})}
      />
    </div>
  );
};

const MusicPanel: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const addMusicTrack = useEditorStore((state) => state.addMusicTrack);
  const updateMusicTrack = useEditorStore((state) => state.updateMusicTrack);
  const removeMusicTrack = useEditorStore((state) => state.removeMusicTrack);
  const updateAllSourceAudio = useEditorStore((state) => state.updateAllSourceAudio);
  const [manifest, setManifest] = useState<MusicManifestItem[]>([]);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [musicSearch, setMusicSearch] = useState('upbeat lo-fi attribution');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importForm, setImportForm] = useState({
    name: '',
    artist: '',
    downloadUrl: '',
    sourceUrl: '',
    style: 'upbeat lo-fi',
    mood: 'positive',
    bpm: 0,
    vocal: 'instrumental' as MusicManifestItem['vocal'],
    energy: 'medium' as MusicManifestItem['energy'],
    licenseType: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionRequired: true,
    attribution: '',
    licenseConfirmed: false,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadManifest = useCallback(async () => {
    for (const manifestPath of ['/music/music-manifest.local.json', '/music/music-manifest.json']) {
      try {
        const response = await fetch(`${manifestPath}?t=${Date.now()}`);
        if (!response.ok) {
          continue;
        }
        const data = (await response.json()) as MusicManifestItem[];
        if (Array.isArray(data)) {
          setManifest(data);
          return;
        }
      } catch {
        // Fall through to the public manifest or empty state.
      }
    }
    setManifest([]);
  }, []);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  const preview = (track: Pick<MusicManifestItem, 'id' | 'src' | 'name'>) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (previewing === track.id) {
      audio.pause();
      setPreviewing(null);
      setPreviewStatus(null);
      return;
    }
    audio.src = track.src;
    audio.currentTime = 0;
    audio.volume = 0.85;
    audio.muted = false;
    void audio
      .play()
      .then(() => {
        setPreviewStatus(`Previewing ${track.name}`);
      })
      .catch((error: unknown) => {
        setPreviewStatus(error instanceof Error ? error.message : 'Could not play this track');
        setPreviewing(null);
      });
    setPreviewing(track.id);
  };

  const patchImportForm = (patch: Partial<typeof importForm>) => setImportForm((current) => ({...current, ...patch}));

  const importTrack = async () => {
    setImporting(true);
    setImportStatus(null);
    try {
      const importBody = {
        ...importForm,
        bpm: Number(importForm.bpm) || 0,
        tags: [importForm.style, importForm.vocal, importForm.energy].filter(Boolean),
      };
      const request =
        importFile instanceof File
          ? (() => {
              const formData = new FormData();
              formData.append('file', importFile);
              Object.entries(importBody).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                  formData.append(key, value.join(','));
                  return;
                }
                formData.append(key, String(value ?? ''));
              });
              return {
                method: 'POST',
                body: formData,
              };
            })()
          : {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(importBody),
            };
      const response = await fetch('/api/music/import', {
        ...request,
      });
      const data = (await response.json()) as {track?: MusicManifestItem; manifest?: MusicManifestItem[]; error?: string};
      if (!response.ok || !data.track) {
        throw new Error(data.error ?? 'Could not import this track');
      }
      setManifest(data.manifest ?? [data.track, ...manifest]);
      setImportStatus(`Imported ${data.track.name}.`);
      setImportForm((current) => ({
        ...current,
        name: '',
        artist: '',
        downloadUrl: '',
        sourceUrl: '',
        attribution: '',
        licenseConfirmed: false,
      }));
      setImportFile(null);
      await loadManifest();
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'Could not import this track');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        controls={Boolean(previewing)}
        className={previewing ? 'w-full accent-cyan-400' : 'hidden'}
        onEnded={() => {
          setPreviewing(null);
          setPreviewStatus(null);
        }}
      />
      {previewStatus && <div className="rounded border border-slate-800 bg-slate-950/55 p-2 text-xs text-slate-300">{previewStatus}</div>}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => updateAllSourceAudio({muted: true})}
          className="rounded bg-slate-100 px-3 py-2 text-xs font-black text-slate-950 hover:bg-white"
        >
          Mute source videos
        </button>
        <button
          onClick={() => updateAllSourceAudio({muted: false})}
          className="rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
        >
          Unmute sources
        </button>
      </div>

      <div className="space-y-3">
        <FieldLabel>Timeline music</FieldLabel>
        {project.music.map((track) => (
          <div key={track.id} className="rounded border border-slate-800 bg-slate-950/55 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="truncate text-sm font-black text-slate-100">{track.name}</div>
                <div className="text-[10px] font-bold text-slate-500">
                  {track.volumeAutomation?.enabled ? 'Speech-aware music bed' : `Flat ${Math.round(track.volume * 100)}%`}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => preview(track)} className="text-xs font-bold text-cyan-200">
                  {previewing === track.id ? 'Stop' : 'Preview'}
                </button>
                <button onClick={() => removeMusicTrack(track.id)} className="text-xs font-bold text-rose-300">
                  Remove
                </button>
              </div>
            </div>
            <MusicVolumeGraph project={project} track={track} onChange={(patch) => updateMusicTrack(track.id, patch)} />
            <details className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
              <summary className="cursor-pointer text-[11px] font-black uppercase text-slate-400">Advanced timing</summary>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <NumberField label="Start" value={track.start} onChange={(start) => updateMusicTrack(track.id, {start})} />
                <NumberField label="End" value={track.end} onChange={(end) => updateMusicTrack(track.id, {end})} />
                <NumberField label="Fade in" value={track.fadeIn} onChange={(fadeIn) => updateMusicTrack(track.id, {fadeIn})} />
                <NumberField label="Fade out" value={track.fadeOut} onChange={(fadeOut) => updateMusicTrack(track.id, {fadeOut})} />
              </div>
              <div className="mt-3">
                <VolumeSlider label="Flat fallback volume" value={track.volume} onChange={(volume) => updateMusicTrack(track.id, {volume})} />
              </div>
              <label className="mt-3 flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Duck under speech if graph is off</span>
                <input
                  type="checkbox"
                  checked={track.duckUnderSpeech}
                  disabled={track.volumeAutomation?.enabled}
                  onChange={(event) => updateMusicTrack(track.id, {duckUnderSpeech: event.currentTarget.checked})}
                />
              </label>
            </details>
          </div>
        ))}
      </div>

      <details open className="rounded border border-slate-800 bg-slate-950/55 p-3">
        <summary className="cursor-pointer text-sm font-black text-slate-100">Find attribution-friendly music</summary>
        <div className="mt-3">
          <FieldLabel>Codex music briefs</FieldLabel>
          <div className="grid gap-2">
            {musicBriefGuides.map((guide) => (
              <button
                key={guide.id}
                onClick={() => {
                  setMusicSearch(guide.searchPrompt);
                  patchImportForm({
                    style: guide.title,
                    vocal: guide.vocal,
                    energy: guide.energy,
                    attributionRequired: true,
                  });
                }}
                className="rounded border border-slate-800 bg-slate-900 p-3 text-left hover:border-cyan-300/70"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-100">{guide.title}</div>
                  <div className="rounded bg-slate-800 px-2 py-1 text-[10px] font-black uppercase text-slate-400">
                    {guide.bpmRange} bpm
                  </div>
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{guide.useWhen}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {guide.preferredSources.map((sourceId) => (
                    <span key={sourceId} className="rounded bg-cyan-400/10 px-2 py-1 text-[10px] font-black uppercase text-cyan-200">
                      {sourceName(sourceId)}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <FieldLabel>Search idea</FieldLabel>
          <input
            value={musicSearch}
            onChange={(event) => setMusicSearch(event.currentTarget.value)}
            placeholder="upbeat Gen Z pop, lo-fi study beat, vocals..."
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </div>
        <div className="mt-3 grid gap-2">
          {musicSourceCards.map((source) => (
            <a
              key={source.name}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-slate-800 bg-slate-900 p-3 hover:border-cyan-300/70"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-black text-slate-100">{source.name}</div>
                <div className="rounded bg-cyan-400/10 px-2 py-1 text-[10px] font-black uppercase text-cyan-200">Open</div>
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-400">{source.bestFor}</div>
              <div className="mt-1 text-[11px] leading-4 text-amber-200/85">{source.licenseNote}</div>
              <div className="mt-1 text-[10px] leading-4 text-slate-500">{source.caution}</div>
            </a>
          ))}
        </div>
        <div className="mt-3 rounded bg-slate-900 px-3 py-2 text-[11px] leading-5 text-slate-400">
          Search for: <span className="font-semibold text-slate-200">{musicSearch || 'creator music'}</span>. For YouTube Audio Library, download the MP3 from YouTube Studio and import it as a local file. For other sources, use either a local file or a direct audio URL from the source page.
        </div>
      </details>

      <details className="rounded border border-slate-800 bg-slate-950/55 p-3">
        <summary className="cursor-pointer text-sm font-black text-slate-100">Import a licensed / attribution track</summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Track name</FieldLabel>
            <input
              value={importForm.name}
              onChange={(event) => patchImportForm({name: event.currentTarget.value})}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <FieldLabel>Artist</FieldLabel>
            <input
              value={importForm.artist}
              onChange={(event) => patchImportForm({artist: event.currentTarget.value})}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div className="col-span-2">
            <FieldLabel>Downloaded audio file</FieldLabel>
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
              onChange={(event) => setImportFile(event.currentTarget.files?.[0] ?? null)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 file:mr-3 file:rounded file:border-0 file:bg-cyan-400 file:px-3 file:py-1 file:text-xs file:font-black file:text-slate-950"
            />
            {importFile && <div className="mt-1 text-[11px] font-semibold text-cyan-200">{importFile.name}</div>}
          </div>
          <div className="col-span-2">
            <FieldLabel>Direct audio download URL (optional if file selected)</FieldLabel>
            <input
              value={importForm.downloadUrl}
              onChange={(event) => patchImportForm({downloadUrl: event.currentTarget.value})}
              placeholder="https://.../track.mp3"
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
            <div className="mt-1 text-[10px] leading-4 text-slate-500">Do not paste ordinary YouTube video URLs. Use the official YouTube Studio download, then select the local MP3 above.</div>
          </div>
          <div className="col-span-2">
            <FieldLabel>Source / track page URL</FieldLabel>
            <input
              value={importForm.sourceUrl}
              onChange={(event) => patchImportForm({sourceUrl: event.currentTarget.value})}
              placeholder="Page where license/attribution is shown"
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <FieldLabel>Style</FieldLabel>
            <input
              value={importForm.style}
              onChange={(event) => patchImportForm({style: event.currentTarget.value})}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <NumberField label="BPM" value={importForm.bpm} min={0} step={1} onChange={(bpm) => patchImportForm({bpm})} />
          <div>
            <FieldLabel>Vocal</FieldLabel>
            <select
              value={importForm.vocal}
              onChange={(event) => patchImportForm({vocal: event.currentTarget.value as MusicManifestItem['vocal']})}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="instrumental">Instrumental</option>
              <option value="lyrics">Lyrics / vocals</option>
              <option value="either">Either</option>
            </select>
          </div>
          <div>
            <FieldLabel>Energy</FieldLabel>
            <select
              value={importForm.energy}
              onChange={(event) => patchImportForm({energy: event.currentTarget.value as MusicManifestItem['energy']})}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <FieldLabel>License</FieldLabel>
            <select
              value={importForm.licenseType}
              onChange={(event) =>
                patchImportForm({
                  licenseType: event.currentTarget.value,
                  attributionRequired: event.currentTarget.value !== 'CC0 / public domain',
                })
              }
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="CC BY 4.0">CC BY 4.0</option>
              <option value="CC BY 3.0">CC BY 3.0</option>
              <option value="CC BY-SA">CC BY-SA</option>
              <option value="Free with attribution">Free with attribution</option>
              <option value="CC0 / public domain">CC0 / public domain</option>
              <option value="Paid/user-provided license">Paid/user-provided license</option>
            </select>
          </div>
          <div>
            <FieldLabel>License URL</FieldLabel>
            <input
              value={importForm.licenseUrl}
              onChange={(event) => patchImportForm({licenseUrl: event.currentTarget.value})}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <label className="col-span-2 flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300">
            <span>Attribution required</span>
            <input
              type="checkbox"
              checked={importForm.attributionRequired}
              onChange={(event) => patchImportForm({attributionRequired: event.currentTarget.checked})}
            />
          </label>
          <div className="col-span-2">
            <FieldLabel>Attribution / credits text</FieldLabel>
            <textarea
              value={importForm.attribution}
              onChange={(event) => patchImportForm({attribution: event.currentTarget.value})}
              placeholder="Music: Track by Artist, licensed under CC BY 4.0, source URL..."
              className="min-h-20 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <label className="col-span-2 flex items-start gap-3 rounded border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
            <input
              type="checkbox"
              checked={importForm.licenseConfirmed}
              onChange={(event) => patchImportForm({licenseConfirmed: event.currentTarget.checked})}
              className="mt-1"
            />
            <span>I checked the source page and confirm this track can be used in this video/project under the license above.</span>
          </label>
        </div>
        <button
          disabled={importing}
          onClick={importTrack}
          className="mt-3 w-full rounded bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-45"
        >
          {importing ? 'Importing...' : importFile ? 'Import local audio file' : 'Download into local music library'}
        </button>
        {importStatus && <div className="mt-2 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">{importStatus}</div>}
      </details>

      <div className="grid gap-2">
        {manifest.length === 0 && (
          <div className="rounded border border-slate-800 bg-slate-950/55 p-4 text-sm leading-5 text-slate-400">
            Import a confirmed track above, or add licensed audio files to <span className="font-mono text-slate-200">public/music</span> and update{' '}
            <span className="font-mono text-slate-200">public/music/music-manifest.json</span>.
          </div>
        )}
        {manifest.map((track) => (
          <div key={track.id} className="rounded border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-black text-slate-100">{track.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {track.artist ? `${track.artist} · ` : ''}
                  {track.style ?? track.mood} · {track.vocal ?? 'either'} · {track.energy ?? 'medium'} · {track.bpm || '?'} bpm
                </div>
                <div className="mt-1 text-[11px] text-amber-200/85">
                  {track.licenseType ?? track.licence}
                  {track.attributionRequired ? ' · attribution required' : ' · no attribution required'}
                </div>
              </div>
              <button
                onClick={() => preview(track)}
                className="rounded bg-slate-800 px-2 py-1 text-xs font-bold text-slate-100 hover:bg-slate-700"
              >
                {previewing === track.id ? 'Stop' : 'Preview'}
              </button>
            </div>
            <button
              onClick={() => {
                const duration = Math.max(12, getVisualTimelineDuration(project));
                const musicTrackBase: MusicTrack = {
                  id: `music_${crypto.randomUUID().slice(0, 8)}`,
                  src: track.src,
                  name: track.name,
                  artist: track.artist,
                  sourceUrl: track.sourceUrl,
                  licenseType: track.licenseType ?? track.licence,
                  licenseUrl: track.licenseUrl,
                  licenseStatus: track.licenseStatus ?? 'user-provided',
                  attributionRequired: track.attributionRequired,
                  attribution: track.attribution,
                  style: track.style,
                  vocal: track.vocal,
                  energy: track.energy,
                  start: 0,
                  end: duration,
                  volume: 0.45,
                  muted: false,
                  fadeIn: 2,
                  fadeOut: 2,
                  duckUnderSpeech: true,
                };
                const musicTrack: MusicTrack = {
                  ...musicTrackBase,
                  volumeAutomation: createSpeechAwareMusicAutomation(project, musicTrackBase, {
                    focusVolume: 1,
                    backgroundVolume: 0.18,
                    rampDuration: 0.35,
                    mode: 'smooth-gaps',
                    liftGapThreshold: 1.15,
                  }),
                };
                addMusicTrack(musicTrack);
              }}
              className="mt-3 w-full rounded bg-rose-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-rose-300"
            >
              Add to timeline
            </button>
            {track.attribution && (
              <textarea
                readOnly
                value={track.attribution}
                className="mt-3 h-16 w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-[10px] leading-4 text-slate-400"
              />
            )}
          </div>
        ))}
      </div>

    </div>
  );
};

const LayerPanel: React.FC = () => {
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const project = useEditorStore((state) => state.project);
  const addLayer = useEditorStore((state) => state.addLayer);
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const selected = project.layers.find((layer) => layer.id === selectedLayerId);
  const patch = (patchValue: Partial<TimelineLayer>) => selected && updateLayer(selected.id, patchValue);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => addLayer('text')} className="rounded bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-700">
          Text
        </button>
        <button onClick={() => addLayer('caption')} className="rounded bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-700">
          Caption
        </button>
        <button onClick={() => addLayer('card')} className="rounded bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-700">
          Key idea
        </button>
        <button onClick={() => addLayer('lower-third')} className="rounded bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-700">
          Lower third
        </button>
        <button onClick={() => addLayer('keyword')} className="rounded bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-700">
          Keyword
        </button>
        <button onClick={() => addLayer('arrow')} className="rounded bg-slate-800 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-700">
          Arrow label
        </button>
      </div>

      {!selected ? (
        <div className="rounded border border-slate-800 bg-slate-950/55 p-4 text-sm text-slate-500">
          Select an overlay on the preview or timeline to edit its JSON properties.
        </div>
      ) : (
        <div className="space-y-3 rounded border border-slate-800 bg-slate-950/55 p-3">
          <div>
            <FieldLabel>Text</FieldLabel>
            <textarea
              value={selected.text}
              onChange={(event) => patch({text: event.currentTarget.value})}
              className="min-h-20 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Start" value={selected.start} onChange={(start) => patch({start})} />
            <NumberField label="End" value={selected.end} onChange={(end) => patch({end})} />
            <NumberField label="X" value={selected.x} step={1} onChange={(x) => patch({x})} />
            <NumberField label="Y" value={selected.y} step={1} onChange={(y) => patch({y})} />
            <NumberField label="Scale" value={selected.scale} step={0.05} onChange={(scale) => patch({scale})} />
            <NumberField label="Opacity" value={selected.opacity} min={0} max={1} step={0.05} onChange={(opacity) => patch({opacity})} />
            <NumberField label="Rotation" value={selected.rotation} step={1} onChange={(rotation) => patch({rotation})} />
            <NumberField label="Z index" value={selected.zIndex} step={1} onChange={(zIndex) => patch({zIndex})} />
          </div>
          <div>
            <FieldLabel>Animation</FieldLabel>
            <select
              value={selected.animation}
              onChange={(event) => patch({animation: event.currentTarget.value as TimelineLayer['animation']})}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="none">None</option>
              <option value="fade-up">Fade up</option>
              <option value="pop">Pop</option>
              <option value="slide-left">Slide left</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

const TranscriptPanel: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const transcript = useEditorStore((state) => state.transcript);
  const thoughts = useEditorStore((state) => state.thoughts);
  const candidates = useEditorStore((state) => state.candidates);
  const setTranscript = useEditorStore((state) => state.setTranscript);
  const setThoughts = useEditorStore((state) => state.setThoughts);
  const setCandidates = useEditorStore((state) => state.setCandidates);
  const addLayer = useEditorStore((state) => state.addLayer);
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const addClip = useEditorStore((state) => state.addClip);
  const [model, setModel] = useState('small');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transcribe = async () => {
    if (!project.sourceVideo) {
      return;
    }
    setBusy('transcribe');
    setError(null);
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          src: project.sourceVideo.src,
          model,
          projectId: project.projectId,
          provider: 'local-faster-whisper',
        }),
      });
      const data = (await response.json()) as {transcript?: TranscriptResult; error?: string};
      if (!response.ok || !data.transcript) {
        throw new Error(data.error ?? 'Transcription failed');
      }
      setTranscript(data.transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setBusy(null);
    }
  };

  const group = async () => {
    if (!transcript) {
      return;
    }
    setBusy('group');
    try {
      const response = await fetch('/api/transcripts/group', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({segments: transcript.segments}),
      });
      const data = (await response.json()) as {thoughts: typeof thoughts};
      setThoughts(data.thoughts);
    } finally {
      setBusy(null);
    }
  };

  const generateClips = async () => {
    if (!project.sourceVideo || thoughts.length === 0) {
      return;
    }
    setBusy('clips');
    setError(null);
    try {
      const response = await fetch('/api/clips/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          src: project.sourceVideo.src,
          thoughts,
          duration: project.sourceVideo.duration,
        }),
      });
      const data = (await response.json()) as {candidates?: ClipCandidate[]; error?: string};
      if (!response.ok || !data.candidates) {
        throw new Error(data.error ?? 'Clip generation failed');
      }
      setCandidates(data.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clip generation failed');
    } finally {
      setBusy(null);
    }
  };

  const generateCaptions = () => {
    if (transcript && project.clips.length > 0) {
      setTranscript(transcript);
      return;
    }

    const units = thoughts.length > 0 ? thoughts : transcript?.segments ?? [];
    units.slice(0, 20).forEach((unit) => {
      const layer = addLayer('caption');
      const linkedClipId =
        'id' in unit && typeof unit.id === 'string'
          ? project.clips.find((clip) => clip.thoughtId === unit.id || clip.id === unit.id)?.id
          : undefined;
      updateLayer(layer.id, {
        clipId: linkedClipId,
        start: 'timelineStart' in unit && typeof unit.timelineStart === 'number' ? unit.timelineStart : 'rawStart' in unit ? unit.rawStart : unit.start,
        end: 'timelineEnd' in unit && typeof unit.timelineEnd === 'number' ? unit.timelineEnd : 'rawEnd' in unit ? unit.rawEnd : unit.end,
        text: unit.text,
        x: 90,
        y: 1480,
        zIndex: 40,
      });
    });
  };

  const candidatePatch = (candidate: ClipCandidate, patch: Partial<ClipCandidate>) => {
    setCandidates(candidates.map((item) => (item.id === candidate.id ? {...item, ...patch} : item)));
  };

  const chooseVersion = (candidate: ClipCandidate, version: ClipCandidateVersion) => {
    candidatePatch(candidate, {bestVersionId: version.id});
    addClip({
      id: `clip_${crypto.randomUUID().slice(0, 8)}`,
      sourceSrc: candidate.thought.sourceSrc ?? project.sourceVideo?.src,
      sourceName: candidate.thought.source ?? project.sourceVideo?.name ?? project.sourceVideo?.src.split('/').at(-1),
      rawStart: version.rawStart,
      rawEnd: version.rawEnd,
      paddedStart: version.paddedStart,
      paddedEnd: version.paddedEnd,
      safeStart: version.safeStart,
      safeEnd: version.safeEnd,
      timelineStart: getVisualTimelineDuration(project),
      boundaryMode: version.boundaryMode,
      volume: version.volume,
      fadeIn: version.fadeIn,
      fadeOut: version.fadeOut,
      thoughtId: version.thoughtId,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-800 bg-slate-950/55 p-3">
        <FieldLabel>Local faster-whisper model</FieldLabel>
        <select
          value={model}
          onChange={(event) => setModel(event.currentTarget.value)}
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          {['tiny', 'base', 'small', 'medium', 'large-v3'].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          disabled={!project.sourceVideo || busy === 'transcribe'}
          onClick={transcribe}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
        >
          {busy === 'transcribe' ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
          Transcribe locally
        </button>
        <div className="mt-2 text-[11px] text-slate-500">Active provider: local-faster-whisper. Groq/OpenAI providers are stubbed for future use.</div>
      </div>

      {error && <div className="rounded border border-rose-500/50 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

      {transcript && (
        <div className="rounded border border-slate-800 bg-slate-950/55 p-3">
          <div className="text-sm font-black text-slate-100">
            Transcript · {transcript.language} · {transcript.segments.length} segments
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {transcript.provider} · {transcript.model} · {transcript.hardware?.device}/{transcript.hardware?.computeType}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={group} disabled={busy === 'group'} className="rounded bg-slate-800 px-3 py-2 text-xs font-black text-slate-100">
              Group sentences
            </button>
            <button onClick={generateCaptions} className="rounded bg-slate-800 px-3 py-2 text-xs font-black text-slate-100">
              Captions
            </button>
          </div>
          <div className="mt-3 max-h-52 space-y-2 overflow-auto rounded border border-slate-800 bg-slate-950 p-2">
            {transcript.segments.map((segment) => (
              <div key={segment.id} className="rounded bg-slate-900 px-2 py-1.5 text-xs text-slate-300">
                <div className="mb-0.5 flex items-center justify-between gap-2 font-mono text-[10px] text-slate-500">
                  <span>{segment.source ?? 'source'}</span>
                  <span>
                    {formatTime(segment.start)} - {formatTime(segment.end)}
                  </span>
                </div>
                {segment.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {thoughts.length > 0 && (
        <div className="rounded border border-slate-800 bg-slate-950/55 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-black text-slate-100">{thoughts.length} grouped thoughts</div>
            <button onClick={generateClips} disabled={busy === 'clips'} className="rounded bg-amber-300 px-3 py-2 text-xs font-black text-slate-950">
              {busy === 'clips' ? 'Analyzing...' : 'Generate clip cuts'}
            </button>
          </div>
          <div className="max-h-44 space-y-2 overflow-auto">
            {thoughts.map((thought) => (
              <div key={thought.id} className="rounded bg-slate-900 p-2 text-xs text-slate-300">
                <div className="font-mono text-[10px] text-slate-500">
                  {thought.source ? `${thought.source} · ` : ''}
                  {formatTime(thought.rawStart)} - {formatTime(thought.rawEnd)}
                  {typeof thought.timelineStart === 'number' && typeof thought.timelineEnd === 'number'
                    ? ` · output ${formatTime(thought.timelineStart)} - ${formatTime(thought.timelineEnd)}`
                    : ''}
                </div>
                {thought.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="space-y-3">
          <FieldLabel>Abrupt-cut experiment</FieldLabel>
          {candidates.slice(0, 8).map((candidate) => (
            <div key={candidate.id} className="rounded border border-slate-800 bg-slate-950/55 p-3">
              <div className="mb-2 text-xs font-bold text-slate-300">{candidate.thought.text}</div>
              <div className="grid grid-cols-3 gap-2">
                {candidate.versions.map((version) => (
                  <div key={version.id} className="rounded bg-slate-900 p-2">
                    <div className="text-[11px] font-black text-slate-100">{version.label}</div>
                    <div className="mt-1 font-mono text-[10px] text-slate-500">
                      {formatTime(version.safeStart)}
                      <br />
                      {formatTime(version.safeEnd)}
                    </div>
                    <div className="mt-2 min-h-8 text-[10px] text-amber-200">{version.risk.notes.join(', ') || 'low risk'}</div>
                    <label className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                      <input
                        type="checkbox"
                        checked={candidate.startsAbruptly ?? false}
                        onChange={(event) => candidatePatch(candidate, {startsAbruptly: event.currentTarget.checked})}
                      />
                      starts abruptly?
                    </label>
                    <label className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                      <input
                        type="checkbox"
                        checked={candidate.cutsSpeechEarly ?? false}
                        onChange={(event) => candidatePatch(candidate, {cutsSpeechEarly: event.currentTarget.checked})}
                      />
                      cuts speech early?
                    </label>
                    <button
                      onClick={() => chooseVersion(candidate, version)}
                      className="mt-2 w-full rounded bg-slate-700 px-2 py-1 text-[10px] font-black text-slate-100 hover:bg-slate-600"
                    >
                      Best version
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const JsonPanel: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const setProject = useEditorStore((state) => state.setProject);
  const applyJson = useEditorStore((state) => state.applyJson);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setDraft(JSON.stringify(project, null, 2));
  }, [project]);

  const save = async () => {
    const response = await fetch(`/api/projects/${project.projectId}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(project),
    });
    setStatus(response.ok ? 'Saved project JSON locally.' : 'Save failed.');
  };

  const load = async () => {
    const response = await fetch(`/api/projects/${project.projectId}`);
    if (!response.ok) {
      setStatus('No saved JSON found for this project id.');
      return;
    }
    setProject((await response.json()) as TimelineProject);
    setStatus('Loaded project JSON.');
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={save} className="inline-flex items-center justify-center gap-2 rounded bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950">
          <Save size={14} />
          Save JSON
        </button>
        <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded bg-slate-800 px-3 py-2 text-xs font-black text-slate-100">
          <FolderOpen size={14} />
          Load JSON
        </button>
      </div>
      <button
        onClick={() => {
          setProject(createEmptyProject());
          setStatus('New empty project created.');
        }}
        className="w-full rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
      >
        New project
      </button>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        className="h-[60vh] w-full rounded border border-slate-700 bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-200"
        spellCheck={false}
      />
      <button
        onClick={() => {
          try {
            applyJson(draft);
            setStatus('Applied JSON to editor state.');
          } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Invalid JSON.');
          }
        }}
        className="w-full rounded bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950"
      >
        Apply edited JSON
      </button>
      {status && <div className="text-xs text-slate-400">{status}</div>}
    </div>
  );
};

const CodexPanel: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const transcript = useEditorStore((state) => state.transcript);
  const thoughts = useEditorStore((state) => state.thoughts);
  const currentTime = useEditorStore((state) => state.currentTime);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [packedMarkdown, setPackedMarkdown] = useState('');
  const [packedPath, setPackedPath] = useState<string | null>(null);
  const [edlJson, setEdlJson] = useState('');
  const [edlPath, setEdlPath] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<{imageSrc: string; path: string} | null>(null);
  const [diagnosticStart, setDiagnosticStart] = useState(0);
  const [diagnosticEnd, setDiagnosticEnd] = useState(5);
  const [nFrames, setNFrames] = useState(10);

  const sourceName = project.sourceVideo?.src.split('/').at(-1) ?? 'source';

  const packTranscript = async () => {
    if (!transcript) {
      return;
    }
    setBusy('pack');
    setStatus(null);
    try {
      const response = await fetch('/api/codex/pack-transcript', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          projectId: project.projectId,
          sourceName,
          transcript,
          thoughts,
        }),
      });
      const data = (await response.json()) as {markdown?: string; path?: string; error?: string};
      if (!response.ok || !data.markdown || !data.path) {
        throw new Error(data.error ?? 'Failed to pack transcript');
      }
      setPackedMarkdown(data.markdown);
      setPackedPath(data.path);
      setStatus('Packed transcript saved for Codex.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to pack transcript');
    } finally {
      setBusy(null);
    }
  };

  const exportEdl = async () => {
    if (!project.sourceVideo) {
      return;
    }
    setBusy('edl');
    setStatus(null);
    try {
      const response = await fetch('/api/codex/edl', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({project}),
      });
      const data = (await response.json()) as {edl?: unknown; path?: string; error?: string};
      if (!response.ok || !data.edl || !data.path) {
        throw new Error(data.error ?? 'Failed to export EDL');
      }
      setEdlJson(JSON.stringify(data.edl, null, 2));
      setEdlPath(data.path);
      setStatus('Codex EDL exported.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to export EDL');
    } finally {
      setBusy(null);
    }
  };

  const createDiagnostic = async () => {
    if (!project.sourceVideo) {
      return;
    }
    setBusy('diagnostic');
    setStatus(null);
    try {
      const response = await fetch('/api/codex/diagnostics', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          src: project.sourceVideo.src,
          projectId: project.projectId,
          start: diagnosticStart,
          end: diagnosticEnd,
          nFrames,
          transcript,
          thoughts,
        }),
      });
      const data = (await response.json()) as {imageSrc?: string; path?: string; error?: string};
      if (!response.ok || !data.imageSrc || !data.path) {
        throw new Error(data.error ?? 'Failed to create diagnostic');
      }
      setDiagnostic({imageSrc: data.imageSrc, path: data.path});
      setStatus('Timeline diagnostic generated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to create diagnostic');
    } finally {
      setBusy(null);
    }
  };

  const usePlayheadWindow = () => {
    const start = Math.max(0, currentTime - 1.5);
    setDiagnosticStart(Number(start.toFixed(2)));
    setDiagnosticEnd(Number(Math.min(project.sourceVideo?.duration ?? currentTime + 3, currentTime + 3).toFixed(2)));
  };

  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-800 bg-slate-950/55 p-3">
        <div className="mb-3 text-sm font-black text-slate-100">Codex reading surface</div>
        <button
          disabled={!transcript || busy === 'pack'}
          onClick={packTranscript}
          className="inline-flex w-full items-center justify-center gap-2 rounded bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
        >
          {busy === 'pack' ? <Loader2 size={15} className="animate-spin" /> : <FileJson size={15} />}
          Pack transcript
        </button>
        {packedPath && <div className="mt-2 break-all text-[11px] text-slate-500">{packedPath}</div>}
        {packedMarkdown && (
          <textarea
            value={packedMarkdown}
            readOnly
            className="mt-3 h-36 w-full rounded border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] leading-4 text-slate-300"
          />
        )}
      </div>

      <div className="rounded border border-slate-800 bg-slate-950/55 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-black text-slate-100">Timeline diagnostic</div>
          <button onClick={usePlayheadWindow} className="rounded bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-200 hover:bg-slate-700">
            Use playhead
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="Start" value={diagnosticStart} min={0} onChange={setDiagnosticStart} />
          <NumberField label="End" value={diagnosticEnd} min={0.25} onChange={setDiagnosticEnd} />
          <NumberField label="Frames" value={nFrames} min={4} max={16} step={1} onChange={setNFrames} />
        </div>
        <button
          disabled={!project.sourceVideo || busy === 'diagnostic'}
          onClick={createDiagnostic}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
        >
          {busy === 'diagnostic' ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
          Generate filmstrip + waveform
        </button>
        {diagnostic && (
          <div className="mt-3">
            <Image
              src={diagnostic.imageSrc}
              alt="Timeline diagnostic"
              width={1800}
              height={646}
              unoptimized
              className="h-auto w-full rounded border border-slate-800"
            />
            <div className="mt-2 break-all text-[11px] text-slate-500">{diagnostic.path}</div>
          </div>
        )}
      </div>

      <div className="rounded border border-slate-800 bg-slate-950/55 p-3">
        <div className="mb-3 text-sm font-black text-slate-100">Export adapter</div>
        <button
          disabled={!project.sourceVideo || busy === 'edl'}
          onClick={exportEdl}
          className="inline-flex w-full items-center justify-center gap-2 rounded bg-slate-100 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"
        >
          {busy === 'edl' ? <Loader2 size={15} className="animate-spin" /> : <FileJson size={15} />}
          Export Codex EDL JSON
        </button>
        {edlPath && <div className="mt-2 break-all text-[11px] text-slate-500">{edlPath}</div>}
        {edlJson && (
          <textarea
            value={edlJson}
            readOnly
            className="mt-3 h-48 w-full rounded border border-slate-800 bg-slate-950 p-3 font-mono text-[10px] leading-4 text-slate-300"
          />
        )}
      </div>

      {status && <div className="rounded border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300">{status}</div>}
    </div>
  );
};

type EditorTab = 'source' | 'clips' | 'opening' | 'layers' | 'music' | 'transcript' | 'codex' | 'json';

export const ControlPanel: React.FC = () => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tab, setTab] = useState<EditorTab>('source');
  const tabItems = useMemo(
    () => [
      ['source', Upload, 'Source'],
      ['clips', Scissors, 'Clips'],
      ['opening', Sparkles, 'Opening'],
      ['layers', Layers, 'Layers'],
      ['music', Music, 'Music'],
      ['transcript', Captions, 'Transcript'],
      ['codex', Wand2, 'Codex'],
      ['json', FileJson, 'JSON'],
    ] as const,
    [],
  );

  useEffect(() => {
    const openPanel = (event: Event) => {
      const detail = (event as CustomEvent<{tab?: EditorTab}>).detail;
      if (!detail?.tab) {
        return;
      }
      setAdvancedOpen(true);
      setTab(detail.tab);
    };

    window.addEventListener('agentic-video-editor:open-panel', openPanel);
    return () => window.removeEventListener('agentic-video-editor:open-panel', openPanel);
  }, []);

  if (!advancedOpen) {
    return (
      <aside className="flex min-h-0 w-16 flex-col items-center border-l border-slate-800 bg-[#080d14] py-3">
        <button
          onClick={() => setAdvancedOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-300 hover:text-cyan-200"
          title="Advanced controls"
        >
          <Settings2 size={18} />
        </button>
        <a
          href="/templates"
          className="mt-2 flex h-11 w-11 items-center justify-center rounded border border-slate-800 bg-slate-950 text-slate-400 hover:border-cyan-300 hover:text-cyan-200"
          title="Template ideas"
        >
          <BookOpen size={18} />
        </a>
        <a
          href="/music"
          className="mt-2 flex h-11 w-11 items-center justify-center rounded border border-slate-800 bg-slate-950 text-slate-400 hover:border-rose-300 hover:text-rose-200"
          title="Music ideas"
        >
          <Music size={18} />
        </a>
        <div className="mt-auto rotate-180 pb-2 text-[10px] font-black uppercase tracking-normal text-slate-600 [writing-mode:vertical-rl]">
          Advanced hidden
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 w-[420px] flex-col border-l border-slate-800 bg-[#0b1017]">
      <div className="border-b border-slate-800 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-100">
            <ArrowRight size={16} className="text-cyan-300" />
            Advanced controls
          </div>
          <button
            onClick={() => setAdvancedOpen(false)}
            className="rounded border border-slate-700 px-2 py-1 text-[10px] font-black uppercase text-slate-300 hover:bg-slate-800"
          >
            Hide
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tabItems.map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={tabButton(tab === id)}>
              <Icon className="mx-auto mb-1" size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {tab === 'source' && <SourcePanel />}
        {tab === 'clips' && <ClipsPanel />}
        {tab === 'opening' && <OpeningPanel />}
        {tab === 'layers' && <LayerPanel />}
        {tab === 'music' && <MusicPanel />}
        {tab === 'transcript' && <TranscriptPanel />}
        {tab === 'codex' && <CodexPanel />}
        {tab === 'json' && <JsonPanel />}
      </div>

      <div className="border-t border-slate-800 p-3 text-[11px] leading-4 text-slate-500">
        This app previews timeline JSON live. Codex remains the main brain for analysis, edit decisions, and future export orchestration.
      </div>
    </aside>
  );
};
