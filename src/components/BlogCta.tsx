import { Button } from './Button.tsx';
import { BLOG_CTA, BLOG_CTA_ACTION } from '../lib/blog-cta.ts';

export function BlogCta({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? 'blog-cta blog-cta-compact' : 'blog-cta'} aria-label="Clean a track" data-testid={compact ? 'blog-cta-side' : 'blog-cta'}>
      <p className="kicker kicker-blue">TrackTidy</p>
      <p className="blog-cta-copy">{BLOG_CTA}</p>
      <Button to="/app">{BLOG_CTA_ACTION}</Button>
    </section>
  );
}
