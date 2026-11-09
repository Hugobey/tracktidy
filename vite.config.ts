import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { prerenderDist } from './scripts/prerender-routes.ts';

function prerenderRoutes() {
  return {
    name: 'prerender-routes',
    apply: 'build' as const,
    closeBundle() {
      prerenderDist();
    },
  };
}

export default defineConfig({
  plugins: [react(), prerenderRoutes()],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
