import {spawn} from 'node:child_process';

export const runFfmpeg = (args: string[]) =>
  new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
    const child = spawn('ffmpeg', args, {stdio: ['ignore', 'pipe', 'pipe']});
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
      if (code === 0) {
        resolve({stdout, stderr});
      } else {
        reject(new Error(stderr || `ffmpeg exited with ${code}`));
      }
    });
  });
