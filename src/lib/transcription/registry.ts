import {FasterWhisperProvider} from './providers/FasterWhisperProvider';
import {GroqWhisperProvider} from './providers/GroqWhisperProvider';
import {OpenAIWhisperProvider} from './providers/OpenAIWhisperProvider';
import type {TranscriptionProvider, TranscriptionRegistryConfig} from './types';

const providers: Record<TranscriptionRegistryConfig['provider'], TranscriptionProvider> = {
  'local-faster-whisper': new FasterWhisperProvider(),
  'groq-whisper': new GroqWhisperProvider(),
  'openai-whisper': new OpenAIWhisperProvider(),
};

export const transcriptionRegistryConfig: TranscriptionRegistryConfig = {
  provider: 'local-faster-whisper',
};

export const getTranscriptionProvider = (providerId = transcriptionRegistryConfig.provider) => {
  const provider = providers[providerId as TranscriptionRegistryConfig['provider']];
  if (!provider) {
    throw new Error(`Unknown transcription provider: ${providerId}`);
  }
  return provider;
};
