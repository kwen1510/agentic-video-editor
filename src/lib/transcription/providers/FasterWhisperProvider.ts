import {spawn} from 'node:child_process';
import path from 'node:path';
import type {TranscriptResult} from '@/types/timeline';
import type {TranscriptionModel, TranscriptionProvider} from '../types';

export class FasterWhisperProvider implements TranscriptionProvider {
  id = 'local-faster-whisper';

  transcribe(inputPath: string, options: {model?: TranscriptionModel; outputPath?: string} = {}) {
    const model = options.model ?? 'small';
    const outputPath = options.outputPath ?? path.join(process.cwd(), 'transcripts', `${path.parse(inputPath).name}.transcript.json`);

    return new Promise<TranscriptResult>((resolve, reject) => {
      const child = spawn('python', [
        path.join(process.cwd(), 'scripts', 'transcribe.py'),
        '--input',
        inputPath,
        '--model',
        model,
        '--output',
        outputPath,
      ]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || stdout || `Transcription failed with exit code ${code}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout.trim()) as TranscriptResult);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}
