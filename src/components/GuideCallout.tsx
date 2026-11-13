import type { ReactNode } from 'react';
import { Button } from './Button.tsx';

type Props = {
  type?: string;
  children?: ReactNode;
};

export function GuideCallout({ type, children }: Props) {
  const promo = type === 'tool-promo';
  return (
    <aside className={promo ? 'guide-callout guide-callout-tool' : 'guide-callout'} data-testid="guide-callout">
      <div className="guide-callout-copy">{children}</div>
      {promo ? (
        <Button to="/#upload">Clean a track</Button>
      ) : null}
    </aside>
  );
}
