import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import { defineConfig } from 'vitest/config';
import { prerenderDist } from './scripts/prerender-routes.ts';

function guideSource() {
  return {
    name: 'guide-source',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('.mdx') || !id.includes('guide-source')) return;
      return { code: `export default ${JSON.stringify(code)}`, map: null };
    },
  };
}

function guideMdx() {
  const plugin = mdx({
    remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm],
  });
  return {
    ...plugin,
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (id.includes('guide-source')) return;
      return plugin.transform.call(this, code, id);
    },
  };
}

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
  plugins: [guideSource(), guideMdx(), react(), prerenderRoutes()],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
