import type {TranscriptSegment, TranscriptThought} from '@/types/timeline';

const connectorStarts = /^(and|but|so|because|therefore|which|then)\b/i;
const endsWithPunctuation = /[.!?]"?$/;
const danglingTail = /\b(and|but|because|so|which|then|to|of|for|with|the|a|an)$/i;

const shouldMerge = (previous: TranscriptSegment, next: TranscriptSegment, minGap: number) => {
  const gap = next.start - previous.end;
  if (gap < minGap) {
    return true;
  }
  if (!endsWithPunctuation.test(previous.text.trim())) {
    return true;
  }
  if (connectorStarts.test(next.text.trim())) {
    return true;
  }
  if (danglingTail.test(previous.text.trim())) {
    return true;
  }
  return false;
};

export const groupTranscriptSegments = (
  segments: TranscriptSegment[],
  options: {gapThreshold?: number; minimumDuration?: number} = {},
): TranscriptThought[] => {
  const gapThreshold = options.gapThreshold ?? 0.45;
  const minimumDuration = options.minimumDuration ?? 2;
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const thoughts: TranscriptThought[] = [];
  let bucket: TranscriptSegment[] = [];

  const flush = () => {
    if (bucket.length === 0) {
      return;
    }
    thoughts.push({
      id: `thought_${thoughts.length + 1}`,
      rawStart: bucket[0].start,
      rawEnd: bucket[bucket.length - 1].end,
      text: bucket
        .map((segment) => segment.text.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
      segmentIds: bucket.map((segment) => segment.id),
    });
    bucket = [];
  };

  for (const segment of sorted) {
    if (bucket.length === 0) {
      bucket.push(segment);
      continue;
    }
    const previous = bucket[bucket.length - 1];
    const currentDuration = previous.end - bucket[0].start;
    if (shouldMerge(previous, segment, gapThreshold) || currentDuration < minimumDuration) {
      bucket.push(segment);
    } else {
      flush();
      bucket.push(segment);
    }
  }
  flush();

  for (let index = 0; index < thoughts.length - 1; index += 1) {
    const thought = thoughts[index];
    const next = thoughts[index + 1];
    if (thought.rawEnd - thought.rawStart < minimumDuration || danglingTail.test(thought.text)) {
      next.rawStart = thought.rawStart;
      next.text = `${thought.text} ${next.text}`.replace(/\s+/g, ' ').trim();
      next.segmentIds = [...thought.segmentIds, ...next.segmentIds];
      thoughts.splice(index, 1);
      index -= 1;
    }
  }

  return thoughts.map((thought, index) => ({...thought, id: `thought_${index + 1}`}));
};
