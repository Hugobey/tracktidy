import { describe, expect, it } from 'vitest';
import { withTimeout } from '../src/lib/audio.ts';

describe('analysis timeout', () => {
  it('stops work that never finishes and explains why', async () => {
    await expect(withTimeout(new Promise(() => undefined), 15, 'Reading was stopped.')).rejects.toThrow(
      'Reading was stopped.',
    );
  });

  it('returns the result when the work finishes first', async () => {
    await expect(withTimeout(Promise.resolve('ready'), 50, 'stopped')).resolves.toBe('ready');
  });
});
