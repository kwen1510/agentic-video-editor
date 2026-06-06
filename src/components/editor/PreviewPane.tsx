'use client';

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {Music, Pause, Play, Plus, RotateCcw} from 'lucide-react';
import {EndingTemplateComposition, OpeningTemplateComposition} from '@/components/remotion/OpeningTemplates';
import {
  activeClipFadeAt,
  activeVideoVolume,
  formatTime,
  getActiveTransitionWindow,
  getOpeningDuration,
  getSourceForSrc,
  getTimelineDuration,
  musicVolumeAt,
  resolveSourceTime,
} from '@/lib/timeline';
import {useEditorStore} from '@/store/editorStore';
import type {MusicTrack, TimelineLayer, TimelineProject} from '@/types/timeline';

const designWidth = 1080;
const designHeight = 1920;
const fps = 30;

const classNames = (...items: Array<string | false | null | undefined>) => items.filter(Boolean).join(' ');

const LayerOverlay: React.FC<{
  layer: TimelineLayer;
  selected: boolean;
  currentTime: number;
  onSelect: () => void;
  onMove: (patch: Pick<TimelineLayer, 'x' | 'y'>) => void;
  onTextChange: (text: string) => void;
}> = ({layer, selected, currentTime, onSelect, onMove, onTextChange}) => {
  const drag = useRef<{startX: number; startY: number; layerX: number; layerY: number} | null>(null);
  const isCaption = layer.type === 'caption';
  const renderY = isCaption ? Math.max(140, Math.min(designHeight - 96, layer.y)) : layer.y;
  const fadeIn = Math.max(0, Math.min(1, (currentTime - layer.start) / 0.22));
  const fadeOut = Math.max(0, Math.min(1, (layer.end - currentTime) / 0.22));
  const entry = fadeIn;
  const animationOffset =
    layer.animation === 'fade-up'
      ? {x: 0, y: (1 - entry) * 18, scale: 1}
      : layer.animation === 'slide-left'
        ? {x: (1 - entry) * 24, y: 0, scale: 1}
        : layer.animation === 'pop'
          ? {x: 0, y: 0, scale: 0.92 + entry * 0.08}
          : {x: 0, y: 0, scale: 1};

  return (
    <div
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect();
        drag.current = {
          startX: event.clientX,
          startY: event.clientY,
          layerX: layer.x,
          layerY: layer.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextText = window.prompt(layer.type === 'caption' ? 'Edit caption text' : 'Edit layer text', layer.text);
        if (nextText !== null) {
          onTextChange(nextText);
        }
      }}
      onPointerMove={(event) => {
        if (!drag.current) {
          return;
        }
        const preview = event.currentTarget.closest('[data-preview-surface]');
        const rect = preview?.getBoundingClientRect();
        if (!rect) {
          return;
        }
        const scaleX = designWidth / rect.width;
        const scaleY = designHeight / rect.height;
        onMove({
          x: Math.round(drag.current.layerX + (event.clientX - drag.current.startX) * scaleX),
          y: Math.round(drag.current.layerY + (event.clientY - drag.current.startY) * scaleY),
        });
      }}
      onPointerUp={(event) => {
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      className={classNames(
        'absolute select-none touch-none rounded px-3 py-2 text-left shadow-[0_14px_40px_rgba(0,0,0,0.38)]',
        selected && 'ring-2 ring-cyan-300',
        isCaption && 'bg-black/70 text-white',
        layer.type === 'lower-third' && 'bg-cyan-400 text-slate-950',
        layer.type === 'card' && 'bg-white text-slate-950',
        layer.type === 'keyword' && 'bg-amber-300 text-slate-950',
        layer.type === 'arrow' && 'bg-transparent text-white shadow-none',
        layer.type === 'text' && 'bg-slate-950/80 text-white',
      )}
      style={{
        left: `${(layer.x / designWidth) * 100}%`,
        top: isCaption ? 'auto' : `${(renderY / designHeight) * 100}%`,
        bottom: isCaption ? `${((designHeight - renderY) / designHeight) * 100}%` : 'auto',
        opacity: layer.opacity * fadeIn * fadeOut,
        transform: `translate3d(${animationOffset.x}px,${animationOffset.y}px,0) rotate(${layer.rotation}deg) scale(${
          layer.scale * animationOffset.scale
        })`,
        transformOrigin: isCaption ? 'left bottom' : 'left top',
        zIndex: layer.zIndex,
        width: isCaption ? 'min(78%, calc(100% - 32px))' : 'auto',
        maxWidth: isCaption ? '78%' : '64%',
        fontSize: isCaption ? 'clamp(13px, 6cqw, 26px)' : 'clamp(15px, 7cqw, 30px)',
        fontWeight: isCaption ? 850 : 900,
        lineHeight: 1.14,
        textAlign: isCaption ? 'center' : 'left',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
      }}
      title="Drag to move overlay"
    >
      {layer.type === 'arrow' ? (
        <div className="flex items-center gap-3">
          <span className="h-0.5 w-20 bg-current" />
          <span className="text-sm font-black uppercase">{layer.text}</span>
        </div>
      ) : (
        layer.text
      )}
    </div>
  );
};

const MusicTrackAudio: React.FC<{track: MusicTrack; ducking: boolean}> = ({track, ducking}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTime = useEditorStore((state) => state.currentTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const volume = musicVolumeAt(track, currentTime, ducking);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = volume;
    if (currentTime < track.start || currentTime > track.end || !isPlaying || volume <= 0) {
      audio.pause();
      return;
    }

    const expected = currentTime - track.start;
    if (Math.abs(audio.currentTime - expected) > 0.25) {
      audio.currentTime = Math.max(0, expected);
    }
    void audio.play().catch(() => undefined);
  }, [currentTime, isPlaying, track.end, track.start, volume]);

  return <audio ref={audioRef} src={track.src} preload="auto" />;
};

const TransitionOverlay: React.FC<{
  project: TimelineProject;
  currentTime: number;
}> = ({project, currentTime}) => {
  const activeTransition = getActiveTransitionWindow(project, currentTime);
  if (!activeTransition) {
    return null;
  }

  const duration = Math.max(0.05, activeTransition.end - activeTransition.start);
  const progress = Math.max(0, Math.min(1, (currentTime - activeTransition.start) / duration));
  const pulse = 1 - Math.abs(progress * 2 - 1);
  const style = activeTransition.transition.style;

  if (style === 'letterbox-reveal') {
    const barHeight = 28 - pulse * 13;
    return (
      <div className="pointer-events-none absolute inset-0 z-[70]">
        <div className="absolute inset-x-0 top-0 bg-black" style={{height: `${barHeight}%`}} />
        <div className="absolute inset-x-0 bottom-0 bg-black" style={{height: `${barHeight}%`}} />
      </div>
    );
  }

  if (style === 'whip-pan') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[70]"
        style={{
          opacity: 0.72 * pulse,
          transform: `translateX(${(progress - 0.5) * -56}px)`,
          background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.34) 0 3px, transparent 3px 18px)',
          mixBlendMode: 'screen',
        }}
      />
    );
  }

  if (style === 'zoom-through') {
    return (
      <div className="pointer-events-none absolute inset-0 z-[70] overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 rounded-full border-4 border-white/70"
          style={{
            width: 90 + progress * 620,
            height: 90 + progress * 620,
            opacity: Math.max(0, 0.9 - progress),
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 ${48 + pulse * 90}px rgba(255,255,255,${0.28 + pulse * 0.42})`,
          }}
        />
        <div className="absolute inset-0 bg-black" style={{opacity: 0.18 * pulse}} />
      </div>
    );
  }

  if (style === 'film-burn-flash') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[70]"
        style={{
          opacity: 0.95 * pulse,
          background:
            'radial-gradient(circle at 28% 50%, rgba(255,255,255,0.94), rgba(251,146,60,0.86) 24%, rgba(239,68,68,0.32) 44%, transparent 72%)',
          mixBlendMode: 'screen',
        }}
      />
    );
  }

  if (style === 'ad-stinger') {
    return (
      <div className="pointer-events-none absolute inset-0 z-[70] overflow-hidden">
        <div
          className="absolute inset-y-0 -left-1/3 w-2/3 bg-cyan-300"
          style={{
            opacity: 0.88 * pulse,
            transform: `translateX(${progress * 178}%) skewX(-16deg)`,
          }}
        />
        <div
          className="absolute inset-y-0 -right-1/3 w-2/3 bg-amber-300"
          style={{
            opacity: 0.84 * pulse,
            transform: `translateX(${progress * -178}%) skewX(-16deg)`,
          }}
        />
        <div
          className="absolute inset-0 bg-slate-950"
          style={{
            opacity: 0.24 * pulse,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[70] bg-slate-950"
      style={{opacity: (style === 'cross-dissolve' ? 0.22 : 0.34) * pulse}}
    />
  );
};

export const PreviewPane: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const currentTime = useEditorStore((state) => state.currentTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const setPlaying = useEditorStore((state) => state.setPlaying);
  const updateSourceVideo = useEditorStore((state) => state.updateSourceVideo);
  const addLayer = useEditorStore((state) => state.addLayer);
  const updateLayer = useEditorStore((state) => state.updateLayer);
  const selectLayer = useEditorStore((state) => state.selectLayer);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<PlayerRef>(null);
  const frameLoop = useRef<number | null>(null);
  const lastTick = useRef<number | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const timelineDuration = Math.max(1, getTimelineDuration(project));
  const openingDuration = getOpeningDuration(project);
  const resolved = useMemo(() => resolveSourceTime(project, currentTime), [currentTime, project]);
  const activeVideoSrc = resolved.sourceSrc ?? project.sourceVideo?.src ?? null;
  const activeSourceVideo = useMemo(() => getSourceForSrc(project, activeVideoSrc), [activeVideoSrc, project]);
  const activeLayers = project.layers.filter((layer) => currentTime >= layer.start && currentTime < layer.end);
  const activeVideoOpacity = resolved.mode === 'opening' || resolved.mode === 'ending' ? 1 : activeClipFadeAt(project, currentTime);
  const sourceAudioVolume = activeVideoVolume(project, currentTime);
  const ducking = resolved.mode !== 'opening' && sourceAudioVolume > 0.02;

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }
    if (resolved.mode === 'opening' || resolved.mode === 'ending') {
      const localTime = resolved.mode === 'opening' ? currentTime : resolved.sourceTime;
      player.seekTo(Math.round(localTime * fps));
      if (isPlaying) {
        void player.play();
      } else {
        player.pause();
      }
    } else {
      player.pause();
    }
  }, [currentTime, isPlaying, resolved.mode, resolved.sourceTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSourceVideo || !activeVideoSrc) {
      return;
    }
    video.volume = sourceAudioVolume;
    video.muted = activeSourceVideo.muted || sourceAudioVolume <= 0;
    if (resolved.mode === 'opening' || resolved.mode === 'ending' || !isPlaying) {
      video.pause();
      return;
    }
    if (Math.abs(video.currentTime - resolved.sourceTime) > 0.22) {
      video.currentTime = Math.max(0, resolved.sourceTime);
    }
    void video.play().catch(() => undefined);
  }, [activeSourceVideo, activeVideoSrc, isPlaying, project, resolved.mode, resolved.sourceTime, sourceAudioVolume]);

  useEffect(() => {
    if (!isPlaying) {
      if (frameLoop.current) {
        cancelAnimationFrame(frameLoop.current);
      }
      frameLoop.current = null;
      lastTick.current = null;
      return;
    }

    const tick = (timestamp: number) => {
      if (lastTick.current === null) {
        lastTick.current = timestamp;
      }
      const delta = (timestamp - lastTick.current) / 1000;
      lastTick.current = timestamp;
      const next = Math.min(timelineDuration, currentTime + delta);
      setCurrentTime(next);
      if (next >= timelineDuration) {
        setPlaying(false);
        return;
      }
      frameLoop.current = requestAnimationFrame(tick);
    };

    frameLoop.current = requestAnimationFrame(tick);
    return () => {
      if (frameLoop.current) {
        cancelAnimationFrame(frameLoop.current);
      }
    };
  }, [currentTime, isPlaying, setCurrentTime, setPlaying, timelineDuration]);

  return (
    <section className="flex min-h-0 flex-col border-r border-slate-800 bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="text-sm font-black uppercase tracking-normal text-slate-100">JSON Video Editor</h1>
          <p className="mt-0.5 text-xs text-slate-400">Live preview only. Final MP4 export is intentionally separate.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/templates"
            className="inline-flex items-center gap-2 rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
          >
            Templates
          </a>
          <a
            href="/music"
            className="inline-flex items-center gap-2 rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
          >
            <Music size={15} />
            Music
          </a>
          <button
            onClick={() => addLayer('text')}
            className="inline-flex items-center gap-2 rounded bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300"
          >
            <Plus size={15} />
            Text
          </button>
          <button
            onClick={() => {
              setCurrentTime(0);
              setPlaying(false);
            }}
            className="inline-flex items-center gap-2 rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
          >
            <RotateCcw size={15} />
            Reset
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#111720] p-4">
        <div
          data-preview-surface
          onPointerDown={() => selectLayer(null)}
          className="relative aspect-[9/16] h-full max-h-[76vh] overflow-hidden rounded border border-slate-700 bg-black shadow-2xl"
          style={{containerType: 'size'}}
        >
          {project.openingScreen.enabled && resolved.mode === 'opening' ? (
            <Player
              ref={playerRef}
              acknowledgeRemotionLicense
              component={OpeningTemplateComposition}
              durationInFrames={Math.max(1, Math.round(project.openingScreen.duration * fps))}
              compositionWidth={designWidth}
              compositionHeight={designHeight}
              fps={fps}
              controls={false}
              loop={false}
              inputProps={{
                templateId: project.openingScreen.templateId,
                title: project.openingScreen.props.title,
                subtitle: project.openingScreen.props.subtitle,
                mood: project.openingScreen.props.mood,
                background: project.openingScreen.props.background,
              }}
              style={{width: '100%', height: '100%'}}
            />
          ) : project.endingScreen?.enabled && resolved.mode === 'ending' ? (
            <Player
              ref={playerRef}
              acknowledgeRemotionLicense
              component={EndingTemplateComposition}
              durationInFrames={Math.max(1, Math.round(project.endingScreen.duration * fps))}
              compositionWidth={designWidth}
              compositionHeight={designHeight}
              fps={fps}
              controls={false}
              loop={false}
              inputProps={{
                templateId: project.endingScreen.templateId,
                title: project.endingScreen.props.title,
                subtitle: project.endingScreen.props.subtitle,
                credits: project.endingScreen.props.credits,
                mood: project.endingScreen.props.mood,
                background: project.endingScreen.props.background,
              }}
              style={{width: '100%', height: '100%'}}
            />
          ) : activeVideoSrc ? (
            <video
              ref={videoRef}
              src={activeVideoSrc}
              className="h-full w-full bg-black object-contain"
              style={{opacity: activeVideoOpacity}}
              playsInline
              preload="auto"
              onLoadedMetadata={(event) => {
                setVideoReady(true);
                const duration = event.currentTarget.duration;
                if (
                  project.sourceVideo &&
                  activeVideoSrc === project.sourceVideo.src &&
                  Number.isFinite(duration) &&
                  Math.abs(project.sourceVideo.duration - duration) > 0.2
                ) {
                  updateSourceVideo(activeVideoSrc, {duration});
                }
              }}
            />
          ) : project.sourceVideo ? (
            <div className="h-full w-full bg-black" />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-8 text-center text-sm font-semibold text-slate-500">
              Upload or select a source video to start previewing edits.
            </div>
          )}

          {activeLayers.map((layer) => (
            <LayerOverlay
              key={layer.id}
              layer={layer}
              selected={selectedLayerId === layer.id}
              currentTime={currentTime}
              onSelect={() => selectLayer(layer.id)}
              onMove={(patch) => updateLayer(layer.id, patch)}
              onTextChange={(text) => updateLayer(layer.id, {text})}
            />
          ))}

          {project.music.map((track) => (
            <MusicTrackAudio key={track.id} track={track} ducking={ducking} />
          ))}

          <TransitionOverlay project={project} currentTime={currentTime} />

        </div>
      </div>

      <div className="border-t border-slate-800 bg-[#0b1017] px-4 py-3">
        <div className="mb-2 flex items-center gap-3">
          <button
            onClick={() => setPlaying(!isPlaying)}
            disabled={!project.sourceVideo && !project.openingScreen.enabled}
            className="inline-flex h-9 w-9 items-center justify-center rounded bg-white text-slate-950 hover:bg-slate-200 disabled:opacity-40"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <div className="w-28 font-mono text-xs text-slate-300">{formatTime(currentTime)}</div>
          <input
            type="range"
            min={0}
            max={timelineDuration}
            step={0.01}
            value={Math.min(currentTime, timelineDuration)}
            onChange={(event) => setCurrentTime(Number(event.currentTarget.value))}
            className="w-full"
          />
          <div className="w-28 text-right font-mono text-xs text-slate-500">{formatTime(timelineDuration)}</div>
        </div>
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span>Opening {project.openingScreen.enabled ? `${openingDuration.toFixed(1)}s` : 'off'}</span>
          <span>{videoReady || !project.sourceVideo || project.sourceVideo.duration > 0 ? 'Preview ready' : 'Loading video metadata'}</span>
        </div>
      </div>
    </section>
  );
};
