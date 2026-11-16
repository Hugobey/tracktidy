import { capturePostHogLog } from './posthog-client.ts';

type ProcessingLogAttributes = Record<string, string | boolean>;

export const posthogProcessingLogger = {
  info(message: string, attributes: ProcessingLogAttributes): void {
    capturePostHogLog('info', message, attributes);
  },
  warn(message: string, attributes: ProcessingLogAttributes): void {
    capturePostHogLog('warn', message, attributes);
  },
};
