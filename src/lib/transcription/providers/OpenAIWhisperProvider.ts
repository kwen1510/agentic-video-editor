import type {TranscriptResult} from '@/types/timeline';
import type {TranscriptionProvider} from '../types';

export class OpenAIWhisperProvider implements TranscriptionProvider {
  id = 'openai-whisper';

  async transcribe(): Promise<TranscriptResult> {
    throw new Error('OpenAI Whisper provider is reserved for future integration and is not implemented yet.');
  }
}
