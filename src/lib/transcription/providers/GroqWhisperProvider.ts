import type {TranscriptResult} from '@/types/timeline';
import type {TranscriptionProvider} from '../types';

export class GroqWhisperProvider implements TranscriptionProvider {
  id = 'groq-whisper';

  async transcribe(): Promise<TranscriptResult> {
    throw new Error('Groq transcription provider is reserved for future integration and is not implemented yet.');
  }
}
