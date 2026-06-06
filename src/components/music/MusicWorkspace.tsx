'use client';

import React, {useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, Check, Copy, ExternalLink, Music, Pause, Play, ShieldCheck, SlidersHorizontal} from 'lucide-react';
import {createSpeechAwareMusicAutomation, getTimelineDuration} from '@/lib/timeline';
import {musicBriefGuides, musicSourceCards, sourceName, type MusicBriefGuide} from '@/lib/music/catalog';
import {useEditorStore} from '@/store/editorStore';
import type {MusicManifestItem, MusicTrack} from '@/types/timeline';

const sourceById = new Map(musicSourceCards.map((source) => [source.id, source]));

const accentClasses = [
  'border-cyan-300/35 bg-cyan-300/10 text-cyan-100',
  'border-rose-300/35 bg-rose-300/10 text-rose-100',
  'border-amber-300/35 bg-amber-300/10 text-amber-100',
  'border-emerald-300/35 bg-emerald-300/10 text-emerald-100',
  'border-violet-300/35 bg-violet-300/10 text-violet-100',
  'border-sky-300/35 bg-sky-300/10 text-sky-100',
];

const guideJson = (guide: MusicBriefGuide) => ({
  musicIntent: {
    action: 'find-and-use-track',
    preset: guide.id,
    title: guide.title,
    searchPrompt: guide.searchPrompt,
    sampleTrackId: guide.sampleTrackId,
    vocal: guide.vocal,
    energy: guide.energy,
    bpmRange: guide.bpmRange,
    preferredSources: guide.preferredSources.map(sourceName),
    mix: {
      defaultVolume: guide.defaultVolume,
      duckUnderSpeech: guide.duckUnderSpeech,
      fadeIn: 2,
      fadeOut: 2,
    },
    licenseWorkflow: {
      requireSourcePage: true,
      requireAttributionCapture: true,
      creditsHint: guide.creditsHint,
    },
  },
});

const trackJson = (track: MusicManifestItem) => ({
  musicIntent: {
    action: 'replace-current-music',
    selectedTrack: {
      id: track.id,
      name: track.name,
      artist: track.artist ?? '',
      src: track.src,
      mood: track.mood,
      bpm: track.bpm,
      sourceUrl: track.sourceUrl ?? '',
      license: track.licenseType ?? track.licence,
      licenseUrl: track.licenseUrl ?? '',
      attribution: track.attribution,
    },
    mix: {
      useVolumeGraph: true,
      noSpeechVolume: track.energy === 'high' ? 0.9 : 0.75,
      speechBedVolume: 0.18,
      fadeIn: 1.25,
      fadeOut: 2,
    },
  },
});

const localTrackRank = (track: MusicManifestItem) => {
  const searchable = `${track.id} ${track.name} ${track.mood} ${track.style ?? ''} ${track.energy ?? ''} ${(track.tags ?? []).join(' ')}`.toLowerCase();
  if (track.id === 'moonpurr-paper-airplane-parade' || searchable.includes('short') || track.energy === 'high') {
    return 0;
  }
  if (searchable.includes('positive') || track.mood === 'positive') {
    return 1;
  }
  if (searchable.includes('lo-fi') || searchable.includes('calm')) {
    return 2;
  }
  return 3;
};

const CopyButton: React.FC<{value: unknown; label?: string}> = ({value, label = 'Copy for Codex'}) => {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        const copyPromise = navigator.clipboard?.writeText(JSON.stringify(value, null, 2));
        if (!copyPromise) {
          return;
        }
        void copyPromise.then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        });
      }}
      className="inline-flex h-9 items-center gap-2 rounded border border-slate-700 px-3 text-xs font-black text-slate-200 hover:bg-slate-800"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : label}
    </button>
  );
};

export const MusicWorkspace: React.FC = () => {
  const project = useEditorStore((state) => state.project);
  const patchProject = useEditorStore((state) => state.patchProject);
  const [tracks, setTracks] = useState<MusicManifestItem[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<string | null>(null);
  const [appliedTrackId, setAppliedTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceGroups = useMemo(
    () => [
      {
        title: 'Best Starting Points',
        ids: ['youtube-audio-library', 'moonpurr', 'free-music-archive'],
      },
      {
        title: 'Reliable Attribution Libraries',
        ids: ['dig-ccmixter', 'openverse-audio', 'anvil-island'],
      },
      {
        title: 'Platform / Creator Libraries',
        ids: ['bensound', 'incompetech'],
      },
    ],
    [],
  );
  const sortedTracks = useMemo(
    () =>
      [...tracks].sort((first, second) => {
        const rank = localTrackRank(first) - localTrackRank(second);
        if (rank !== 0) {
          return rank;
        }
        return (second.bpm ?? 0) - (first.bpm ?? 0);
      }),
    [tracks],
  );

  useEffect(() => {
    let cancelled = false;
    const loadTracks = async () => {
      for (const manifestPath of ['/music/music-manifest.local.json', '/music/music-manifest.json']) {
        try {
          const response = await fetch(`${manifestPath}?t=${Date.now()}`);
          if (!response.ok) {
            continue;
          }
          const data = (await response.json()) as MusicManifestItem[];
          if (!cancelled && Array.isArray(data)) {
            setTracks(data);
            return;
          }
        } catch {
          // Try the next manifest.
        }
      }
      if (!cancelled) {
        setTracks([]);
      }
    };

    void loadTracks();
    return () => {
      cancelled = true;
    };
  }, []);

  const previewTrack = (track: MusicManifestItem) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (playingTrackId === track.id) {
      audio.pause();
      setPlayingTrackId(null);
      setPlayerStatus(null);
      return;
    }

    audio.src = track.src;
    audio.currentTime = 0;
    audio.volume = 0.9;
    audio.muted = false;
    setPlayingTrackId(track.id);
    setPlayerStatus(`Playing ${track.name}`);
    void audio
      .play()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not play this track';
        setPlayingTrackId(null);
        setPlayerStatus(
          message.toLowerCase().includes("user didn't interact") || message.toLowerCase().includes('notallowed')
            ? 'Click Play in the browser to start audio preview.'
            : message,
        );
      });
  };

  const timelineTrackFromManifest = (track: MusicManifestItem): MusicTrack => {
    const timelineDuration = Math.max(30, getTimelineDuration(project));
    const baseTrack: MusicTrack = {
      id: `music_${track.id}`,
      src: track.src,
      name: track.name,
      artist: track.artist,
      sourceUrl: track.sourceUrl,
      licenseType: track.licenseType ?? track.licence,
      licenseUrl: track.licenseUrl,
      licenseStatus: track.licenseStatus ?? 'user-provided',
      attributionRequired: track.attributionRequired ?? true,
      attribution: track.attribution,
      style: track.style ?? track.mood,
      vocal: track.vocal ?? 'instrumental',
      energy: track.energy ?? (track.mood === 'positive' ? 'high' : 'medium'),
      start: 0,
      end: timelineDuration,
      volume: 0.2,
      fadeIn: 1.25,
      fadeOut: 2,
      duckUnderSpeech: true,
    };

    return {
      ...baseTrack,
      volumeAutomation: createSpeechAwareMusicAutomation(project, baseTrack, {
        focusVolume: track.energy === 'high' ? 0.9 : 0.75,
        backgroundVolume: baseTrack.volume,
        rampDuration: 0.35,
        mode: 'smooth-gaps',
        liftGapThreshold: 1.15,
      }),
    };
  };

  const applyTrackInEditor = (track: MusicManifestItem) => {
    patchProject({music: [timelineTrackFromManifest(track)]});
    setAppliedTrackId(track.id);
  };

  return (
    <main className="min-h-screen bg-[#0d1117] text-slate-100">
      <div className="border-b border-slate-800 px-5 py-4">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-cyan-200">
          <ArrowLeft size={14} />
          Editor
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-normal text-slate-100">Music Workspace</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Preview local tracks, copy a Codex-ready brief, then import only tracks with confirmed license and attribution text.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/templates" className="rounded bg-slate-800 px-3 py-2 text-xs font-black uppercase text-slate-300 hover:bg-slate-700">
              Templates
            </Link>
            <Link href="/" className="rounded bg-cyan-400 px-3 py-2 text-xs font-black uppercase text-slate-950">
              Editor
            </Link>
          </div>
        </div>
      </div>

      <section className="grid gap-4 p-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <section className="mb-4 rounded border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-black uppercase text-slate-200">
                  <Music size={16} className="text-rose-200" />
                  Licensed sample soundtracks
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">Real downloaded MP3 samples with source pages and attribution kept in the manifest.</p>
              </div>
              {playerStatus && <div className="rounded bg-slate-900 px-3 py-2 text-xs font-bold text-cyan-100">{playerStatus}</div>}
            </div>
            <audio
              ref={audioRef}
              controls={Boolean(playingTrackId)}
              className={playingTrackId ? 'mt-3 w-full accent-rose-400' : 'hidden'}
              onEnded={() => {
                setPlayingTrackId(null);
                setPlayerStatus(null);
              }}
            />
            <div className="mt-3 grid gap-3">
              {sortedTracks.length === 0 && (
                <div className="rounded border border-dashed border-slate-700 bg-slate-900/45 p-4 text-sm leading-6 text-slate-400">
                  Add confirmed audio files to <span className="font-mono text-slate-200">public/music</span> and list them in{' '}
                  <span className="font-mono text-slate-200">music-manifest.json</span>.
                </div>
              )}
              {sortedTracks.map((track) => (
                <article key={track.id} className="grid gap-3 rounded border border-slate-800 bg-slate-900 p-3 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-black text-slate-100">{track.name}</h2>
                      <span className="rounded bg-cyan-400/10 px-2 py-1 text-[10px] font-black uppercase text-cyan-200">{track.mood}</span>
                      <span className="rounded bg-slate-800 px-2 py-1 text-[10px] font-black uppercase text-slate-400">{track.bpm} bpm</span>
                      {track.id === 'moonpurr-paper-airplane-parade' && (
                        <span className="rounded bg-amber-300 px-2 py-1 text-[10px] font-black uppercase text-slate-950">Short-form pick</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {track.licenseType ?? track.licence}
                      {track.attribution ? ` · ${track.attribution}` : ''}
                    </p>
                    {track.sourceUrl && (
                      <a
                        href={track.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-200 hover:text-cyan-100"
                      >
                        Source page
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <button
                      onClick={() => previewTrack(track)}
                      className="inline-flex h-9 items-center gap-2 rounded bg-rose-300 px-3 text-xs font-black text-slate-950 hover:bg-rose-200"
                    >
                      {playingTrackId === track.id ? <Pause size={14} /> : <Play size={14} />}
                      {playingTrackId === track.id ? 'Stop' : 'Play'}
                    </button>
                    <button
                      onClick={() => applyTrackInEditor(track)}
                      className="inline-flex h-9 items-center rounded bg-cyan-400 px-3 text-xs font-black text-slate-950 hover:bg-cyan-300"
                    >
                      {appliedTrackId === track.id ? 'Using now' : 'Use in current edit'}
                    </button>
                    <CopyButton value={trackJson(track)} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-slate-200">
            <SlidersHorizontal size={16} className="text-cyan-200" />
            Codex Music Briefs
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {musicBriefGuides.map((guide, index) => {
                const sampleTrack = tracks.find((track) => track.id === guide.sampleTrackId);
                return (
                  <article key={guide.id} className="rounded border border-slate-800 bg-slate-950 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className={`inline-flex rounded border px-2 py-1 text-[10px] font-black uppercase ${accentClasses[index % accentClasses.length]}`}>
                          {guide.tone}
                        </div>
                        <h2 className="mt-3 text-base font-black text-slate-100">{guide.title}</h2>
                      </div>
                      <CopyButton value={guideJson(guide)} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{guide.useWhen}</p>
                    {sampleTrack && (
                      <div className="mt-3 rounded border border-slate-800 bg-slate-900 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-black uppercase text-cyan-200">Licensed sample</div>
                            <div className="mt-1 text-sm font-black text-slate-100">{sampleTrack.name}</div>
                            <div className="mt-1 text-[11px] leading-4 text-slate-500">
                              {sampleTrack.artist} · {sampleTrack.licenseType ?? sampleTrack.licence}
                            </div>
                            {sampleTrack.sourceUrl && (
                              <a
                                href={sampleTrack.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-200 hover:text-cyan-100"
                              >
                                Source page
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => previewTrack(sampleTrack)}
                              className="inline-flex h-9 items-center gap-2 rounded bg-rose-300 px-3 text-xs font-black text-slate-950 hover:bg-rose-200"
                            >
                              {playingTrackId === sampleTrack.id ? <Pause size={14} /> : <Play size={14} />}
                              {playingTrackId === sampleTrack.id ? 'Stop' : 'Play sample'}
                            </button>
                            <button
                              onClick={() => applyTrackInEditor(sampleTrack)}
                              className="inline-flex h-9 items-center rounded bg-cyan-400 px-3 text-xs font-black text-slate-950 hover:bg-cyan-300"
                            >
                              {appliedTrackId === sampleTrack.id ? 'Using now' : 'Use sample'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 rounded bg-slate-900 p-3 text-xs leading-5 text-slate-300">{guide.searchPrompt}</div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase">
                      <div className="rounded bg-slate-900 px-2 py-2 text-slate-400">{guide.bpmRange} bpm</div>
                      <div className="rounded bg-slate-900 px-2 py-2 text-slate-400">{guide.energy}</div>
                      <div className="rounded bg-slate-900 px-2 py-2 text-slate-400">{guide.vocal}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {guide.preferredSources.map((sourceId) => (
                        <span key={sourceId} className="rounded bg-cyan-400/10 px-2 py-1 text-[10px] font-black uppercase text-cyan-200">
                          {sourceName(sourceId)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-amber-100/85">{guide.creditsHint}</p>
                  </article>
                );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-slate-200">
              <ShieldCheck size={16} className="text-emerald-200" />
              License Checklist
            </div>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-400">
              <div className="rounded bg-slate-900 p-3">Use the original track page as the source of truth.</div>
              <div className="rounded bg-slate-900 p-3">Capture title, artist, source URL, license URL, and attribution text.</div>
              <div className="rounded bg-slate-900 p-3">Avoid non-commercial licenses for public/commercial templates unless the user confirms the use is non-commercial.</div>
              <div className="rounded bg-slate-900 p-3">Keep the attribution in timeline JSON so export can place it in ending credits.</div>
            </div>
          </section>

          {sourceGroups.map((group) => (
            <section key={group.title} className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-slate-200">
                <Music size={16} className="text-rose-200" />
                {group.title}
              </div>
              <div className="grid gap-3">
                {group.ids.map((sourceId) => {
                  const source = sourceById.get(sourceId);
                  if (!source) {
                    return null;
                  }

                  return (
                    <a
                      key={source.id}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-slate-800 bg-slate-900 p-3 hover:border-cyan-300/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-black text-slate-100">{source.name}</h3>
                          <div className="mt-1 text-[10px] font-black uppercase text-slate-500">{source.licenseFamily}</div>
                        </div>
                        <ExternalLink size={14} className="mt-0.5 shrink-0 text-slate-500" />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{source.bestFor}</p>
                      <p className="mt-2 text-[11px] leading-4 text-amber-100/85">{source.licenseNote}</p>
                      <p className="mt-1 text-[10px] leading-4 text-slate-500">{source.caution}</p>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </aside>
      </section>
    </main>
  );
};
