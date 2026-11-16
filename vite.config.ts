import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { handleCheckPro } from './api/check-pro.js';
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

function stripeDevApi(secret: string): Plugin {
  return {
    name: 'stripe-dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? '';
        if (!raw.startsWith('/api/check-pro')) {
          next();
          return;
        }
        const email = new URL(raw, 'http://127.0.0.1').searchParams.get('email') ?? '';
        void handleCheckPro(email, secret).then((result) => {
          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(result.body));
        });
      });
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const paymentLink = env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || '';
  const stripeSecret = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
  return {
    define: {
      'process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK': JSON.stringify(paymentLink),
    },
    plugins: [guideSource(), guideMdx(), react(), prerenderRoutes(), stripeDevApi(stripeSecret)],
    server: {
      port: 5173,
      strictPort: true,
    },
    test: {
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    },
  };
});
