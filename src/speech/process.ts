import { spawn } from 'node:child_process';

export class ProcessFailure extends Error {
  constructor(readonly code: number | null) {
    super('Local speech process failed');
  }
}

export type SpeechCommand = (
  command: string,
  args: string[],
  input?: string,
  interactive?: boolean,
  captureStderr?: boolean,
) => Promise<void | string>;

// Speech subprocesses never need provider keys. Their stdout is suppressed except for the recorder UI.
export const runSpeechCommand: SpeechCommand = async (
  command,
  args,
  input,
  interactive = false,
  captureStderr = false,
) => {
  return await new Promise<string | undefined>((resolve, reject) => {
    let stderr = '';
    const child = spawn(command, args, {
      stdio: interactive
        ? ['inherit', 'inherit', 'inherit']
        : ['pipe', 'ignore', captureStderr ? 'pipe' : 'ignore'],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        LANG: process.env.LANG,
        HF_HUB_OFFLINE: '1',
        TRANSFORMERS_OFFLINE: '1',
      },
    });
    child.once('error', reject);
    if (captureStderr) {
      child.stderr?.on('data', (chunk: Buffer) => {
        if (stderr.length < 64 * 1024)
          stderr += chunk.toString('utf8').slice(0, 64 * 1024 - stderr.length);
      });
    }
    child.once('close', (code) =>
      code === 0 ? resolve(captureStderr ? stderr : undefined) : reject(new ProcessFailure(code)),
    );
    if (!interactive) child.stdin?.end(input);
  });
};
