import type {TranscriptResult, TranscriptSegment, TranscriptThought} from '@/types/timeline';

type PackedUnit = {
  id: string;
  start: number;
  end: number;
  text: string;
  segmentIds?: string[];
};

export type PackedTranscriptInput = {
  projectId: string;
  sourceName?: string;
  transcript?: TranscriptResult | null;
  thoughts?: TranscriptThought[];
};

const formatPackedTime = (seconds: number) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  return safe.toFixed(2).padStart(6, '0');
};

const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim();

const segmentToUnit = (segment: TranscriptSegment): PackedUnit => ({
  id: segment.id,
  start: segment.start,
  end: segment.end,
  text: cleanText(segment.text),
  segmentIds: [segment.id],
});

const thoughtToUnit = (thought: TranscriptThought): PackedUnit => ({
  id: thought.id,
  start: thought.rawStart,
  end: thought.rawEnd,
  text: cleanText(thought.text),
  segmentIds: thought.segmentIds,
});

export const buildPackedTranscriptMarkdown = ({
  projectId,
  sourceName = 'source',
  transcript,
  thoughts = [],
}: PackedTranscriptInput) => {
  const thoughtUnits = thoughts.map(thoughtToUnit).filter((unit) => unit.text);
  const segmentUnits = (transcript?.segments ?? []).map(segmentToUnit).filter((unit) => unit.text);
  const units = thoughtUnits.length > 0 ? thoughtUnits : segmentUnits;
  const duration = transcript?.duration ?? units.at(-1)?.end ?? 0;
  const language = transcript?.language ?? 'unknown';
  const provider = transcript?.provider ?? 'unknown-provider';
  const model = transcript?.model ?? 'unknown-model';

  const lines = [
    '# Packed Transcript',
    '',
    `Project: ${projectId}`,
    `Source: ${sourceName}`,
    `Language: ${language}`,
    `Provider: ${provider}`,
    `Model: ${model}`,
    `Duration: ${duration.toFixed(2)}s`,
    `Units: ${units.length}`,
    '',
    'Use these ranges as the primary Codex reading surface for edit decisions. The timeline JSON remains the source of truth.',
    '',
    `## ${sourceName}`,
  ];

  if (units.length === 0) {
    lines.push('  _no transcript units available_');
  }

  for (const unit of units) {
    const segmentIds = unit.segmentIds?.length ? ` {${unit.segmentIds.join(',')}}` : '';
    lines.push(`  [${formatPackedTime(unit.start)}-${formatPackedTime(unit.end)}] ${unit.id}${segmentIds} ${unit.text}`);
  }

  lines.push('');
  return lines.join('\n');
};
