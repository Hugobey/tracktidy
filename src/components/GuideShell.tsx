import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './Button.tsx';
import { Logo } from './Logo.tsx';
import { SiteFooter } from './SiteFooter.tsx';
import { SiteHead } from './SiteHead.tsx';
import { SiteNav } from './SiteNav.tsx';

type Props = {
  title: string;
  description: string;
  path: string;
  ogType?: 'website' | 'article';
  image?: string;
  jsonLd?: Record<string, unknown> | null;
  children: ReactNode;
};

export function GuideShell({ title, description, path, ogType = 'website', image, jsonLd = null, children }: Props) {
  return (
    <div className="page guides-page">
      <SiteHead title={title} description={description} path={path} ogType={ogType} image={image} jsonLd={jsonLd} />
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="nav">
        <div className="wrap nav-inner">
          <Link to="/" className="logo-link" aria-label="TrackTidy, home">
            <Logo />
          </Link>
          <SiteNav current="guides" />
          <Button to="/#upload">Clean your first track</Button>
        </div>
      </header>
      <main id="content" className="guides-main">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
