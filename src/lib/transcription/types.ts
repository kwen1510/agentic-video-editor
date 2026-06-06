import type {TranscriptResult} from '@/types/timeline';

export type TranscriptionModel = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';

export interface TranscriptionProvider {
  id: string;
  transcribe(inputPath: string, options?: {model?: TranscriptionModel; outputPath?: string}): Promise<TranscriptResult>;
}

export type TranscriptionRegistryConfig = {
  provider: 'local-faster-whisper' | 'groq-whisper' | 'openai-whisper';
};
