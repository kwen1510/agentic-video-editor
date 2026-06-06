import type {BoundaryMode, Clip, ClipCandidate, ClipCandidateVersion, TranscriptThought} from '@/types/timeline';
import {measureWindowEnergy} from '@/lib/audio/energy';
import {detectSilences, nearestSilenceEndAfter, nearestSilenceStartBefore, type SilenceWindow} from '@/lib/audio/silence';

const highEnergyThresholdDb = -28;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const clipFromThought = (
  thought: TranscriptThought,
  mode: BoundaryMode,
  duration: number,
  silences: SilenceWindow[],
): Clip => {
  const rawStart = clamp(thought.rawStart, 0, duration);
  const rawEnd = clamp(thought.rawEnd, rawStart, duration);
  const paddedStart = clamp(rawStart - 0.4, 0, duration);
  const paddedEnd = clamp(rawEnd + 0.5, paddedStart, duration);

  if (mode === 'raw') {
    return {
      id: `${thought.id}_raw`,
      rawStart,
      rawEnd,
      paddedStart,
      paddedEnd,
      safeStart: rawStart,
      safeEnd: rawEnd,
      boundaryMode: 'raw',
      volume: 1,
      fadeIn: 0.15,
      fadeOut: 0.2,
      thoughtId: thought.id,
    };
  }

  if (mode === 'padded') {
    return {
      id: `${thought.id}_padded`,
      rawStart,
      rawEnd,
      paddedStart,
      paddedEnd,
      safeStart: paddedStart,
      safeEnd: paddedEnd,
      boundaryMode: 'padded',
      volume: 1,
      fadeIn: 0.15,
      fadeOut: 0.2,
      thoughtId: thought.id,
    };
  }

  const snappedStart = nearestSilenceStartBefore(silences, paddedStart, 1);
  const snappedEnd = nearestSilenceEndAfter(silences, paddedEnd, 1);

  return {
    id: `${thought.id}_silence`,
    rawStart,
    rawEnd,
    paddedStart,
    paddedEnd,
    safeStart: clamp(snappedStart ?? paddedStart, 0, paddedStart),
    safeEnd: clamp(snappedEnd ?? paddedEnd, paddedEnd, duration),
    boundaryMode: 'silence-snapped',
    volume: 1,
    fadeIn: 0.15,
    fadeOut: 0.2,
    thoughtId: thought.id,
  };
};

const scoreClip = async (inputPath: string, clip: Clip, hasNearbySilence: boolean): Promise<ClipCandidateVersion['risk']> => {
  const startEnergy = await measureWindowEnergy(inputPath, clip.safeStart, 0.3);
  const endEnergy = await measureWindowEnergy(inputPath, Math.max(0, clip.safeEnd - 0.3), 0.3);
  const possibleAbruptStart = startEnergy.maxVolumeDb !== null && startEnergy.maxVolumeDb > highEnergyThresholdDb;
  const possibleEarlyEnding = endEnergy.maxVolumeDb !== null && endEnergy.maxVolumeDb > highEnergyThresholdDb;
  const boundaryRisk = !hasNearbySilence;
  const notes = [
    possibleAbruptStart ? 'possible abrupt start' : null,
    possibleEarlyEnding ? 'possible early ending' : null,
    boundaryRisk ? 'no nearby silence point detected' : null,
  ].filter(Boolean) as string[];

  return {
    possibleAbruptStart,
    possibleEarlyEnding,
    boundaryRisk,
    startMaxVolumeDb: startEnergy.maxVolumeDb,
    endMaxVolumeDb: endEnergy.maxVolumeDb,
    notes,
  };
};

export const buildClipCandidates = async (
  inputPath: string,
  thoughts: TranscriptThought[],
  duration: number,
): Promise<ClipCandidate[]> => {
  let silences: SilenceWindow[] = [];
  try {
    silences = await detectSilences(inputPath);
  } catch {
    silences = [];
  }

  const candidates: ClipCandidate[] = [];
  for (const thought of thoughts) {
    const versions: ClipCandidateVersion[] = [];
    for (const [mode, label] of [
      ['raw', 'Raw Cut'],
      ['padded', 'Padded Cut'],
      ['silence-snapped', 'Silence-Snapped Cut'],
    ] as const) {
      const clip = clipFromThought(thought, mode, duration, silences);
      const hasNearbySilence =
        nearestSilenceStartBefore(silences, clip.paddedStart ?? clip.rawStart, 1) !== null ||
        nearestSilenceEndAfter(silences, clip.paddedEnd ?? clip.rawEnd, 1) !== null;
      versions.push({
        ...clip,
        label,
        risk: await scoreClip(inputPath, clip, hasNearbySilence),
      });
    }
    candidates.push({
      id: `candidate_${candidates.length + 1}`,
      thought,
      versions,
    });
  }
  return candidates;
};
